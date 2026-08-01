import prisma from '../prisma';
import { cleanupAvatarUrl } from './avatarStorage';

/**
 * Full account deletion, shared by the in-app path (DELETE /users/me) and the
 * public web deletion flow required by Google Play. Handles club ownership
 * succession, report anonymization, message cleanup, and avatar storage
 * cleanup. Returns false if the user no longer exists.
 */

function deletionSuccessorRank(role: string): number {
  if (role === 'OWNER') return 4;
  if (role === 'ADMIN') return 3;
  if (role === 'OFFICER') return 2;
  return 1;
}

export async function deleteUserAccount(userId: string): Promise<boolean> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  if (!existing) return false;

  await prisma.$transaction(async (tx) => {
    const ownedClubs = await tx.club.findMany({
      where: { createdById: userId },
      include: {
        members: {
          where: { userId: { not: userId } },
          select: { userId: true, role: true, joinedAt: true },
        },
      },
    });

    for (const club of ownedClubs) {
      const successor = [...club.members].sort((a, b) => {
        const rankDifference = deletionSuccessorRank(b.role) - deletionSuccessorRank(a.role);
        return rankDifference || a.joinedAt.getTime() - b.joinedAt.getTime();
      })[0];

      if (!successor) {
        await tx.club.delete({ where: { id: club.id } });
        continue;
      }

      await tx.club.update({
        where: { id: club.id },
        data: { createdById: successor.userId },
      });
      // Repair any legacy creator/role mismatch before appointing the
      // successor. The partial unique index permits exactly one OWNER.
      await tx.clubMember.updateMany({
        where: { clubId: club.id, role: 'OWNER', userId: { not: successor.userId } },
        data: { role: 'ADMIN' },
      });
      await tx.clubMember.updateMany({
        where: { clubId: club.id, userId: successor.userId },
        data: { role: 'OWNER' },
      });
      await tx.clubRole.updateMany({
        where: { clubId: club.id, createdById: userId },
        data: { createdById: successor.userId },
      });
      await tx.clubMeeting.updateMany({
        where: { clubId: club.id, createdById: userId },
        data: { createdById: successor.userId },
      });
      await tx.clubMemberRole.updateMany({
        where: { clubId: club.id, assignedById: userId },
        data: { assignedById: successor.userId },
      });
    }

    const clubsWithRemainingAuthorship = await tx.club.findMany({
      where: {
        OR: [
          { roles: { some: { createdById: userId } } },
          { meetings: { some: { createdById: userId } } },
        ],
      },
      select: { id: true, createdById: true },
    });

    for (const club of clubsWithRemainingAuthorship) {
      await tx.clubRole.updateMany({
        where: { clubId: club.id, createdById: userId },
        data: { createdById: club.createdById },
      });
      await tx.clubMeeting.updateMany({
        where: { clubId: club.id, createdById: userId },
        data: { createdById: club.createdById },
      });
    }

    const assignmentClubIds = Array.from(new Set(
      (await tx.clubMemberRole.findMany({
        where: { assignedById: userId },
        select: { clubId: true },
      })).map((assignment) => assignment.clubId)
    ));
    for (const clubId of assignmentClubIds) {
      const club = await tx.club.findUnique({ where: { id: clubId }, select: { createdById: true } });
      if (club) {
        await tx.clubMemberRole.updateMany({
          where: { clubId, assignedById: userId },
          data: { assignedById: club.createdById },
        });
      }
    }

    const [podMessageIds, directMessageIds, clubMessageIds, officerMessageIds, announcementIds] =
      await Promise.all([
        tx.message.findMany({ where: { userId }, select: { id: true } }),
        tx.directMessage.findMany({ where: { senderId: userId }, select: { id: true } }),
        tx.clubMessage.findMany({ where: { userId }, select: { id: true } }),
        tx.clubOfficerMessage.findMany({ where: { userId }, select: { id: true } }),
        tx.clubAnnouncement.findMany({ where: { userId }, select: { id: true } }),
      ]);

    await Promise.all([
      tx.report.updateMany({
        where: { messageId: { in: podMessageIds.map((item) => item.id) } },
        data: { messageId: null },
      }),
      tx.report.updateMany({
        where: { directMessageId: { in: directMessageIds.map((item) => item.id) } },
        data: { directMessageId: null },
      }),
      tx.report.updateMany({
        where: { clubMessageId: { in: clubMessageIds.map((item) => item.id) } },
        data: { clubMessageId: null },
      }),
      tx.report.updateMany({
        where: { clubOfficerMessageId: { in: officerMessageIds.map((item) => item.id) } },
        data: { clubOfficerMessageId: null },
      }),
      tx.report.updateMany({
        where: { clubAnnouncementId: { in: announcementIds.map((item) => item.id) } },
        data: { clubAnnouncementId: null },
      }),
    ]);
    await tx.noShowReport.deleteMany({
      where: { OR: [{ reporterId: userId }, { targetUserId: userId }] },
    });

    await tx.message.deleteMany({ where: { userId } });
    await tx.directMessage.deleteMany({ where: { senderId: userId } });
    await tx.clubAnnouncement.deleteMany({ where: { userId } });
    await tx.clubMessage.deleteMany({ where: { userId } });
    await tx.clubOfficerMessage.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  await cleanupAvatarUrl(existing.avatarUrl);
  return true;
}
