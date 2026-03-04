import prisma from '../prisma';
import { ReportReason, ReportStatus } from '../lib/reportReasons';

export interface CreateReportPayload {
  podId?: string;
  messageId?: string;
  targetUserId?: string;
  reason: ReportReason;
  details?: string;
}

export interface AdminReportFilters {
  status?: ReportStatus;
  limit?: number;
  cursor?: string;
}

export interface AdminReportPatch {
  status?: ReportStatus;
  adminNotes?: string;
}

export async function createReport(
  reporterId: string,
  payload: CreateReportPayload
): Promise<{ id: string; status: string }> {
  const { podId, messageId, targetUserId: payloadTargetUserId, reason, details } = payload;

  if (!podId && !messageId && !payloadTargetUserId) {
    throw new Error('At least one of podId, messageId, or targetUserId is required');
  }

  let targetUserId = payloadTargetUserId ?? null;
  let resolvedPodId = podId ?? null;
  let resolvedMessageId = messageId ?? null;

  if (messageId) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, podId: true, userId: true },
    });
    if (!message) {
      throw new Error('Message not found');
    }
    if (!targetUserId) {
      targetUserId = message.userId;
    }
    if (targetUserId === reporterId) {
      throw new Error("You cannot report your own message");
    }
    resolvedPodId = resolvedPodId ?? message.podId;
    resolvedMessageId = message.id;

    if (podId && message.podId !== podId) {
      throw new Error('Message does not belong to the specified pod');
    }
  }

  if (payloadTargetUserId && payloadTargetUserId === reporterId) {
    throw new Error("You cannot report yourself");
  }

  if (podId && !messageId) {
    const pod = await prisma.pod.findUnique({ where: { id: podId } });
    if (!pod) {
      throw new Error('Pod not found');
    }
    resolvedPodId = pod.id;
  }

  const trimmedDetails =
    typeof details === 'string' && details.trim().length > 0
      ? details.trim().slice(0, 1000)
      : null;

  const report = await prisma.report.create({
    data: {
      reporterId,
      targetUserId,
      podId: resolvedPodId,
      messageId: resolvedMessageId,
      reason,
      details: trimmedDetails,
      status: 'OPEN',
    },
  });

  return { id: report.id, status: report.status };
}

export async function listMyReports(reporterId: string) {
  const reports = await prisma.report.findMany({
    where: { reporterId },
    select: {
      id: true,
      reason: true,
      status: true,
      createdAt: true,
      podId: true,
      messageId: true,
      targetUserId: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return reports;
}

export async function adminListReports(filters: AdminReportFilters) {
  const { status, limit = 50, cursor } = filters;
  const take = Math.min(50, Math.max(1, limit));

  const where = status ? { status } : {};

  const reports = await prisma.report.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      target: { select: { id: true, name: true, email: true } },
      pod: {
        select: {
          id: true,
          activity: { select: { title: true } },
          location: true,
        },
      },
      message: { select: { id: true, content: true, createdAt: true } },
    },
  });

  const hasMore = reports.length > take;
  const items = hasMore ? reports.slice(0, take) : reports;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return {
    reports: items.map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      details: r.details,
      adminNotes: r.adminNotes,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      reporter: r.reporter,
      target: r.target,
      pod: r.pod,
      message: r.message ? { id: r.message.id, content: r.message.content.slice(0, 200), createdAt: r.message.createdAt } : null,
      podId: r.podId,
      messageId: r.messageId,
      targetUserId: r.targetUserId,
    })),
    nextCursor,
  };
}

export async function adminUpdateReport(id: string, patch: AdminReportPatch) {
  const { status, adminNotes } = patch;

  const data: { status?: string; adminNotes?: string; resolvedAt?: Date } = {};
  if (status) data.status = status;
  if (adminNotes !== undefined) data.adminNotes = adminNotes;
  if (status === 'RESOLVED' || status === 'DISMISSED') {
    data.resolvedAt = new Date();
  }

  const report = await prisma.report.update({
    where: { id },
    data,
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      target: { select: { id: true, name: true, email: true } },
      pod: { select: { id: true, activity: { select: { title: true } } } },
      message: { select: { id: true, content: true } },
    },
  });

  return report;
}
