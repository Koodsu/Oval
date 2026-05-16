import prisma from '../prisma';
import { ReportReason, ReportStatus } from '../lib/reportReasons';

export interface CreateReportPayload {
  podId?: string;
  messageId?: string;
  directMessageId?: string;
  clubId?: string;
  clubMessageId?: string;
  clubOfficerMessageId?: string;
  clubAnnouncementId?: string;
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
  const {
    podId,
    messageId,
    directMessageId,
    clubId,
    clubMessageId,
    clubOfficerMessageId,
    clubAnnouncementId,
    targetUserId: payloadTargetUserId,
    reason,
    details,
  } = payload;

  if (
    !podId &&
    !messageId &&
    !directMessageId &&
    !clubId &&
    !clubMessageId &&
    !clubOfficerMessageId &&
    !clubAnnouncementId &&
    !payloadTargetUserId
  ) {
    throw new Error('At least one report target is required');
  }

  let targetUserId = payloadTargetUserId ?? null;
  let resolvedPodId = podId ?? null;
  let resolvedMessageId = messageId ?? null;
  let resolvedDirectMessageId = directMessageId ?? null;
  let resolvedClubId = clubId ?? null;
  let resolvedClubMessageId = clubMessageId ?? null;
  let resolvedClubOfficerMessageId = clubOfficerMessageId ?? null;
  let resolvedClubAnnouncementId = clubAnnouncementId ?? null;
  let targetType: string | null = payloadTargetUserId ? 'USER' : null;

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
    targetType = 'POD_MESSAGE';

    if (podId && message.podId !== podId) {
      throw new Error('Message does not belong to the specified pod');
    }
  }

  if (directMessageId) {
    const dm = await prisma.directMessage.findUnique({
      where: { id: directMessageId },
      select: { id: true, threadId: true, senderId: true, thread: { select: { userAId: true, userBId: true } } },
    });
    if (!dm) throw new Error('Direct message not found');
    if (dm.thread.userAId !== reporterId && dm.thread.userBId !== reporterId) {
      throw new Error('You can only report messages from your conversations');
    }
    if (!targetUserId) targetUserId = dm.senderId;
    if (targetUserId === reporterId) throw new Error("You cannot report your own message");
    resolvedDirectMessageId = dm.id;
    targetType = 'DIRECT_MESSAGE';
  }

  if (clubMessageId) {
    const message = await prisma.clubMessage.findUnique({
      where: { id: clubMessageId },
      select: { id: true, clubId: true, userId: true, club: { select: { members: { where: { userId: reporterId }, select: { id: true } } } } },
    });
    if (!message) throw new Error('Club message not found');
    if (message.club.members.length === 0) throw new Error('You can only report messages in clubs you belong to');
    if (!targetUserId) targetUserId = message.userId;
    if (targetUserId === reporterId) throw new Error("You cannot report your own message");
    resolvedClubId = resolvedClubId ?? message.clubId;
    resolvedClubMessageId = message.id;
    targetType = 'CLUB_MESSAGE';
    if (clubId && message.clubId !== clubId) throw new Error('Message does not belong to the specified club');
  }

  if (clubOfficerMessageId) {
    const message = await prisma.clubOfficerMessage.findUnique({
      where: { id: clubOfficerMessageId },
      select: { id: true, clubId: true, userId: true, club: { select: { members: { where: { userId: reporterId }, select: { id: true, role: true } } } } },
    });
    if (!message) throw new Error('Officer message not found');
    if (message.club.members.length === 0) throw new Error('You can only report messages in clubs you belong to');
    if (!targetUserId) targetUserId = message.userId;
    if (targetUserId === reporterId) throw new Error("You cannot report your own message");
    resolvedClubId = resolvedClubId ?? message.clubId;
    resolvedClubOfficerMessageId = message.id;
    targetType = 'CLUB_OFFICER_MESSAGE';
    if (clubId && message.clubId !== clubId) throw new Error('Message does not belong to the specified club');
  }

  if (clubAnnouncementId) {
    const announcement = await prisma.clubAnnouncement.findUnique({
      where: { id: clubAnnouncementId },
      select: { id: true, clubId: true, userId: true },
    });
    if (!announcement) throw new Error('Announcement not found');
    if (!targetUserId) targetUserId = announcement.userId;
    if (targetUserId === reporterId) throw new Error("You cannot report your own announcement");
    resolvedClubId = resolvedClubId ?? announcement.clubId;
    resolvedClubAnnouncementId = announcement.id;
    targetType = 'CLUB_ANNOUNCEMENT';
    if (clubId && announcement.clubId !== clubId) throw new Error('Announcement does not belong to the specified club');
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
    targetType = targetType ?? 'POD';
  }

  if (clubId && !clubMessageId && !clubOfficerMessageId && !clubAnnouncementId) {
    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) throw new Error('Club not found');
    resolvedClubId = club.id;
    targetType = targetType ?? 'CLUB';
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
      directMessageId: resolvedDirectMessageId,
      clubId: resolvedClubId,
      clubMessageId: resolvedClubMessageId,
      clubOfficerMessageId: resolvedClubOfficerMessageId,
      clubAnnouncementId: resolvedClubAnnouncementId,
      targetType,
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
      directMessageId: true,
      clubId: true,
      clubMessageId: true,
      clubOfficerMessageId: true,
      clubAnnouncementId: true,
      targetType: true,
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
      directMessageId: r.directMessageId,
      clubId: r.clubId,
      clubMessageId: r.clubMessageId,
      clubOfficerMessageId: r.clubOfficerMessageId,
      clubAnnouncementId: r.clubAnnouncementId,
      targetType: r.targetType,
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
