export interface NotificationCopy {
  title: string;
  body: string;
}

export const PUSH_CHANNELS = {
  plans: 'plans',
  messages: 'messages',
  clubs: 'clubs',
  discovery: 'discovery',
} as const;

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function notificationPreview(content: string | null | undefined, fallback = 'Sent a message'): string {
  const normalized = content?.replace(/\s+/g, ' ').trim() || fallback;
  return normalized.length > 110 ? `${normalized.slice(0, 107)}...` : normalized;
}

export function podJoinCopy(
  joinerName: string,
  planTitle: string,
  memberCount: number,
  maxMembers: number,
  when: string,
): NotificationCopy {
  return {
    title: `${joinerName} joined ${planTitle}`,
    body: `${memberCount} of ${maxMembers} spots filled${when ? ` · ${when}` : ''}`,
  };
}

export function podInviteCopy(
  senderName: string,
  planTitle: string,
  when: string,
  location: string,
  spotsLeft: number,
): NotificationCopy {
  const details = [when, location, `${spotsLeft} ${pluralize(spotsLeft, 'spot')} left`].filter(Boolean);
  return {
    title: `${senderName} invited you to ${planTitle}`,
    body: details.join(' · '),
  };
}

export function podUpdateCopy(
  planTitle: string,
  changedFields: string[],
  when: string,
  location: string,
): NotificationCopy {
  const changedTime = changedFields.includes('meetupTime');
  const changedLocation = changedFields.includes('location');
  const title =
    changedTime && !changedLocation
      ? `${planTitle} moved to ${when}`
      : changedLocation && !changedTime
        ? `New location for ${planTitle}`
        : `${planTitle} was updated`;
  return { title, body: [when, location].filter(Boolean).join(' · ') };
}

export function podCancelledCopy(planTitle: string, when: string): NotificationCopy {
  return {
    title: `${planTitle} was canceled`,
    body: when ? `${when} is no longer happening.` : 'This plan is no longer happening.',
  };
}

export function podMessageCopy(senderName: string, planTitle: string, preview?: string): NotificationCopy {
  return {
    title: `${senderName} · ${planTitle}`,
    body: notificationPreview(preview),
  };
}

export function directMessageCopy(senderName: string, preview?: string): NotificationCopy {
  return { title: senderName, body: notificationPreview(preview) };
}

export function friendRequestCopy(senderName: string): NotificationCopy {
  return {
    title: `${senderName} sent you a friend request`,
    body: 'Open your Inbox to respond.',
  };
}

export function meetupReminderCopy(
  planTitle: string,
  time: string,
  location: string,
  memberCount: number,
): NotificationCopy {
  return {
    title: `${planTitle} starts in 1 hour`,
    body: `${time} at ${location} · ${memberCount} ${pluralize(memberCount, 'person', 'people')} going`,
  };
}

export function recapPromptCopy(planTitle: string): NotificationCopy {
  return {
    title: `How was ${planTitle}?`,
    body: 'Tap to rate it—it takes about 10 seconds.',
  };
}

export function waitlistSpotCopy(planTitle: string): NotificationCopy {
  return {
    title: `A spot opened in ${planTitle}`,
    body: 'Join within 30 minutes before it goes to the next person.',
  };
}

export function waitlistTwinCopy(
  planTitle: string,
  when: string,
  location: string,
): NotificationCopy {
  return {
    title: `Another ${planTitle} opened`,
    body: [when, location, 'You have first look.'].filter(Boolean).join(' · '),
  };
}

export function firstPlanNudgeCopy(
  planTitle: string,
  time: string,
  location: string,
  peopleLine: string,
): NotificationCopy {
  return {
    title: 'Your first Oval plan is today',
    body: `${planTitle} · ${time} at ${location} · ${peopleLine}`,
  };
}

export function demandConversionCopy(peopleCount: number, activityTitle: string): NotificationCopy {
  return {
    title: `${peopleCount} people are up for ${activityTitle}`,
    body: 'Pick a time and start the plan.',
  };
}

export function demandPlanCreatedCopy(
  planTitle: string,
  dayLabel: string,
  time?: string,
  location?: string,
): NotificationCopy {
  return {
    title: `${planTitle} is happening ${dayLabel}`,
    body: time && location
      ? `${time} at ${location}. Join while spots are open.`
      : 'Join while spots are open.',
  };
}

export function weeklyPlanningCopy(
  attendedCount: number,
  newPeopleCount: number,
  joinableCount: number,
): NotificationCopy | null {
  // A push should always offer a useful next action. Retrospective-only and
  // completely empty weeks stay silent.
  if (joinableCount === 0) return null;
  if (attendedCount === 0) {
    return {
      title: `${joinableCount} ${pluralize(joinableCount, 'plan')} ${joinableCount === 1 ? 'matches' : 'match'} your interests`,
      body: "See what's forming around campus this week.",
    };
  }

  const socialLine = newPeopleCount > 0
    ? `You met ${newPeopleCount} new ${pluralize(newPeopleCount, 'person', 'people')}. `
    : '';
  return {
    title: `You made it to ${attendedCount} ${pluralize(attendedCount, 'plan')} this week`,
    body: `${socialLine}${joinableCount} more ${pluralize(joinableCount, 'plan')} ${joinableCount === 1 ? 'matches' : 'match'} your interests this week.`,
  };
}

export function clubMessageCopy(
  senderName: string,
  clubName: string,
  channelName: string,
  preview: string,
  mentionLabel?: string,
): NotificationCopy {
  return mentionLabel
    ? {
        title: `${senderName} mentioned ${mentionLabel}`,
        body: `${clubName} · #${channelName}: ${notificationPreview(preview)}`,
      }
    : {
        title: `${senderName} · ${clubName} #${channelName}`,
        body: notificationPreview(preview),
      };
}

export function clubRoleChangeCopy(clubName: string, newRole: string): NotificationCopy {
  const roleLabels: Record<string, string> = {
    OWNER: 'owner',
    ADMIN: 'admin',
    OFFICER: 'officer',
    MEMBER: 'member',
  };
  const role = roleLabels[newRole] ?? newRole.toLowerCase();
  return {
    title: role === 'owner'
      ? `You're now the owner of ${clubName}`
      : `You're now an ${role} in ${clubName}`.replace('an member', 'a member'),
    body: role === 'member'
      ? 'Your club permissions have been updated.'
      : 'Open the club to see your updated permissions.',
  };
}

export function clubMeetingCreatedCopy(
  clubName: string,
  meetingTitle: string,
  meetingDate: string,
  location: string,
): NotificationCopy {
  return {
    title: `${clubName} added ${meetingTitle}`,
    body: `${meetingDate} · ${location}`,
  };
}

export function clubAnnouncementCopy(clubName: string, content: string): NotificationCopy {
  return {
    title: `New from ${clubName}`,
    body: notificationPreview(content, 'A new announcement was posted.'),
  };
}

export function clubRemovalCopy(clubName: string): NotificationCopy {
  return {
    title: `You're no longer in ${clubName}`,
    body: 'Your club membership was updated.',
  };
}

export function clubAttendanceOpenCopy(meetingTitle: string, clubName: string): NotificationCopy {
  return {
    title: `Check in to ${meetingTitle}`,
    body: `${clubName} is meeting now.`,
  };
}

export function clubRsvpCopy(meetingTitle: string, clubName: string, meetingDate: string): NotificationCopy {
  return {
    title: `Are you going to ${meetingTitle}?`,
    body: `${clubName} · ${meetingDate}`,
  };
}

export function clubOutreachCopy(clubName: string, content: string): NotificationCopy {
  return {
    title: `Message from ${clubName}`,
    body: notificationPreview(content, 'Your club shared an update.'),
  };
}
