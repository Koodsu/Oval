import prisma from '../prisma';
import { ReportReason, ReportSeverity, ReportStatus, severityForReason } from '../lib/reportReasons';
import { sendModerationReportEmail } from '../lib/emailService';
import { hashEmailIdentity } from '../lib/identity';

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
  severity?: ReportSeverity;
  limit?: number;
  cursor?: string;
}

export interface AdminReportPatch {
  status?: ReportStatus;
  adminNotes?: string;
  removeContent?: boolean;
  accountAction?: 'SUSPEND' | 'BAN' | 'RESTORE';
}

export async function createReport(
  reporterId: string,
  payload: CreateReportPayload
): Promise<{ id: string; status: string; severity: ReportSeverity }> {
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
  let reportedContent: string | null = null;

  if (messageId) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, podId: true, userId: true, content: true },
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
    reportedContent = message.content.slice(0, 2000);
    targetType = 'POD_MESSAGE';

    if (podId && message.podId !== podId) {
      throw new Error('Message does not belong to the specified pod');
    }
  }

  if (directMessageId) {
    const dm = await prisma.directMessage.findUnique({
      where: { id: directMessageId },
      select: { id: true, threadId: true, senderId: true, content: true, thread: { select: { userAId: true, userBId: true } } },
    });
    if (!dm) throw new Error('Direct message not found');
    if (dm.thread.userAId !== reporterId && dm.thread.userBId !== reporterId) {
      throw new Error('You can only report messages from your conversations');
    }
    if (!targetUserId) targetUserId = dm.senderId;
    if (targetUserId === reporterId) throw new Error("You cannot report your own message");
    resolvedDirectMessageId = dm.id;
    reportedContent = dm.content.slice(0, 2000);
    targetType = 'DIRECT_MESSAGE';
  }

  if (clubMessageId) {
    const message = await prisma.clubMessage.findUnique({
      where: { id: clubMessageId },
      select: { id: true, clubId: true, userId: true, content: true, club: { select: { members: { where: { userId: reporterId }, select: { id: true } } } } },
    });
    if (!message) throw new Error('Club message not found');
    if (message.club.members.length === 0) throw new Error('You can only report messages in clubs you belong to');
    if (!targetUserId) targetUserId = message.userId;
    if (targetUserId === reporterId) throw new Error("You cannot report your own message");
    resolvedClubId = resolvedClubId ?? message.clubId;
    resolvedClubMessageId = message.id;
    reportedContent = message.content.slice(0, 2000);
    targetType = 'CLUB_MESSAGE';
    if (clubId && message.clubId !== clubId) throw new Error('Message does not belong to the specified club');
  }

  if (clubOfficerMessageId) {
    const message = await prisma.clubOfficerMessage.findUnique({
      where: { id: clubOfficerMessageId },
      select: { id: true, clubId: true, userId: true, content: true, club: { select: { members: { where: { userId: reporterId }, select: { id: true, role: true } } } } },
    });
    if (!message) throw new Error('Officer message not found');
    if (message.club.members.length === 0) throw new Error('You can only report messages in clubs you belong to');
    if (!targetUserId) targetUserId = message.userId;
    if (targetUserId === reporterId) throw new Error("You cannot report your own message");
    resolvedClubId = resolvedClubId ?? message.clubId;
    resolvedClubOfficerMessageId = message.id;
    reportedContent = message.content.slice(0, 2000);
    targetType = 'CLUB_OFFICER_MESSAGE';
    if (clubId && message.clubId !== clubId) throw new Error('Message does not belong to the specified club');
  }

  if (clubAnnouncementId) {
    const announcement = await prisma.clubAnnouncement.findUnique({
      where: { id: clubAnnouncementId },
      select: { id: true, clubId: true, userId: true, content: true },
    });
    if (!announcement) throw new Error('Announcement not found');
    if (!targetUserId) targetUserId = announcement.userId;
    if (targetUserId === reporterId) throw new Error("You cannot report your own announcement");
    resolvedClubId = resolvedClubId ?? announcement.clubId;
    resolvedClubAnnouncementId = announcement.id;
    reportedContent = announcement.content.slice(0, 2000);
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
  const severity = severityForReason(reason);

  const duplicate = await prisma.report.findFirst({
    where: {
      reporterId,
      reason,
      status: { in: ['OPEN', 'REVIEWING'] },
      createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      targetUserId,
      podId: resolvedPodId,
      messageId: resolvedMessageId,
      directMessageId: resolvedDirectMessageId,
      clubId: resolvedClubId,
      clubMessageId: resolvedClubMessageId,
      clubOfficerMessageId: resolvedClubOfficerMessageId,
      clubAnnouncementId: resolvedClubAnnouncementId,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (duplicate) {
    return {
      id: duplicate.id,
      status: duplicate.status,
      severity: duplicate.severity as ReportSeverity,
    };
  }

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
      severity,
      details: trimmedDetails,
      reportedContent,
      status: 'OPEN',
    },
  });

  if (process.env.NODE_ENV === 'test') {
    await notifyModerationReport(report.id);
  } else {
    void notifyModerationReport(report.id).catch((err) => {
      console.error('[reports] Failed to send moderation report email:', err);
    });
  }

  return { id: report.id, status: report.status, severity };
}

export async function listMyReports(reporterId: string) {
  const reports = await prisma.report.findMany({
    where: { reporterId },
    select: {
      id: true,
      reason: true,
      severity: true,
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
  const { status, severity, limit = 50, cursor } = filters;
  const take = Math.min(50, Math.max(1, limit));

  const where: { status?: ReportStatus; severity?: ReportSeverity } = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;

  const reports = await prisma.report.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ severity: 'asc' }, { status: 'asc' }, { createdAt: 'desc' }],
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      target: {
        select: {
          id: true,
          name: true,
          email: true,
          accountStatus: true,
          accountStatusChangedAt: true,
          moderationReason: true,
        },
      },
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
      severity: r.severity,
      status: r.status,
      details: r.details,
      adminNotes: r.adminNotes,
      moderationEmailSentAt: r.moderationEmailSentAt,
      contentRemovedAt: r.contentRemovedAt,
      accountAction: r.accountAction,
      accountActionAt: r.accountActionAt,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      reporter: r.reporter,
      target: r.target,
      pod: r.pod,
      message: r.message ? { id: r.message.id, content: r.message.content.slice(0, 200), createdAt: r.message.createdAt } : null,
      reportedContent: r.reportedContent?.slice(0, 2000) ?? null,
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

export async function adminGetReport(id: string) {
  return prisma.report.findUnique({
    where: { id },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      target: {
        select: {
          id: true,
          name: true,
          email: true,
          accountStatus: true,
          accountStatusChangedAt: true,
          moderationReason: true,
        },
      },
      pod: {
        select: {
          id: true,
          location: true,
          activity: { select: { title: true } },
        },
      },
      message: { select: { id: true, content: true, createdAt: true } },
    },
  });
}

export async function adminUpdateReport(id: string, patch: AdminReportPatch) {
  const { status, adminNotes, removeContent, accountAction } = patch;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.report.findUnique({ where: { id } });
    if (!existing) {
      const notFound = new Error('Report not found') as Error & { code?: string };
      notFound.code = 'P2025';
      throw notFound;
    }

    let contentRemovedAt = existing.contentRemovedAt;
    if (removeContent && !contentRemovedAt) {
      if (existing.messageId) {
        await tx.message.deleteMany({ where: { id: existing.messageId } });
      } else if (existing.directMessageId) {
        await tx.directMessage.deleteMany({ where: { id: existing.directMessageId } });
      } else if (existing.clubMessageId) {
        await tx.clubMessage.deleteMany({ where: { id: existing.clubMessageId } });
      } else if (existing.clubOfficerMessageId) {
        await tx.clubOfficerMessage.deleteMany({ where: { id: existing.clubOfficerMessageId } });
      } else if (existing.clubAnnouncementId) {
        await tx.clubAnnouncement.deleteMany({ where: { id: existing.clubAnnouncementId } });
      } else {
        throw new Error('This report does not point to removable content');
      }
      contentRemovedAt = new Date();
    }

    if (accountAction) {
      if (!existing.targetUserId) {
        throw new Error('This report does not have a target user');
      }
      const target = await tx.user.findUnique({
        where: { id: existing.targetUserId },
        select: { id: true, email: true },
      });
      if (!target) throw new Error('Target user not found');

      const reason = (adminNotes?.trim() || `${existing.reason} report ${existing.id}`).slice(0, 1000);
      const accountStatus =
        accountAction === 'SUSPEND' ? 'SUSPENDED' :
        accountAction === 'BAN' ? 'BANNED' :
        'ACTIVE';

      await tx.user.update({
        where: { id: target.id },
        data: {
          accountStatus,
          accountStatusChangedAt: new Date(),
          moderationReason: accountStatus === 'ACTIVE' ? null : reason,
          tokenVersion: { increment: 1 },
        },
      });

      const emailHash = hashEmailIdentity(target.email);
      if (accountAction === 'BAN') {
        await tx.bannedIdentity.upsert({
          where: { emailHash },
          create: { emailHash, reason, reportId: existing.id },
          update: { reason, reportId: existing.id },
        });
      } else if (accountAction === 'RESTORE') {
        await tx.bannedIdentity.deleteMany({ where: { emailHash } });
      }
    }

    const data: {
      status?: string;
      adminNotes?: string;
      resolvedAt?: Date | null;
      contentRemovedAt?: Date | null;
      accountAction?: string;
      accountActionAt?: Date;
    } = {};
    if (status) data.status = status;
    if (adminNotes !== undefined) data.adminNotes = adminNotes;
    if (status === 'RESOLVED' || status === 'DISMISSED') {
      data.resolvedAt = new Date();
    } else if (status === 'OPEN' || status === 'REVIEWING') {
      data.resolvedAt = null;
    }
    if (contentRemovedAt) data.contentRemovedAt = contentRemovedAt;
    if (accountAction) {
      data.accountAction = accountAction;
      data.accountActionAt = new Date();
    }

    await tx.report.update({ where: { id }, data });
  });

  return adminGetReport(id);
}

async function notifyModerationReport(reportId: string): Promise<void> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      target: { select: { id: true, name: true, email: true } },
      pod: {
        select: {
          id: true,
          location: true,
          activity: { select: { title: true } },
        },
      },
      message: { select: { id: true, content: true, createdAt: true } },
    },
  });

  if (!report) return;

  await sendModerationReportEmail({
    id: report.id,
    severity: report.severity,
    reason: report.reason,
    status: report.status,
    targetType: report.targetType,
    details: report.details,
    createdAt: report.createdAt,
    reporter: report.reporter,
    target: report.target,
    pod: report.pod,
    message: report.message,
    reportedContent: report.reportedContent,
    directMessageId: report.directMessageId,
    clubId: report.clubId,
    clubMessageId: report.clubMessageId,
    clubOfficerMessageId: report.clubOfficerMessageId,
    clubAnnouncementId: report.clubAnnouncementId,
  });

  await prisma.report.update({
    where: { id: report.id },
    data: { moderationEmailSentAt: new Date() },
  });
}
