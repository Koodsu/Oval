/**
 * Shared date/time formatting utilities.
 * Import from here instead of defining locally in each component/screen.
 */

/**
 * Full pod meetup time: "Sat, Mar 15, 2:00 PM"
 * Used on pod detail views and pod cards.
 */
export function formatPodTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Smart relative meetup time for feed cards: "Today 2:00 PM", "Tomorrow 2:00 PM",
 * "Sat 2:00 PM" (within this week), or "Mar 15 2:00 PM" (beyond this week).
 */
export function formatMeetupTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 86_400_000);
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  if (date < tomorrowStart) return `Today ${timeStr}`;
  if (date < new Date(tomorrowStart.getTime() + 86_400_000)) return `Tomorrow ${timeStr}`;
  if (date < weekEnd) {
    const dayStr = date.toLocaleDateString(undefined, { weekday: 'short' });
    return `${dayStr} ${timeStr}`;
  }
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${timeStr}`;
}

/**
 * Compact message thread timestamp: time only for today ("2:34 PM"),
 * or month+day for older messages ("Mar 12").
 * Used in the messages inbox list.
 */
export function formatThreadTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Compact date+time for invite cards: "Mar 15, 2:00 PM"
 */
export function formatInviteTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Chat date separator label: "Today", "Yesterday", or "Monday, March 15"
 */
export function formatChatDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

/**
 * Pod/DM chat day separator: "TODAY · 4:30 PM", "YESTERDAY · …", or weekday + date + time.
 * Use with small-caps styling in the UI.
 */
export function formatPodChatDateSeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  if (dateOnly.getTime() === today.getTime()) return `TODAY · ${timeStr}`;
  if (dateOnly.getTime() === yesterday.getTime()) return `YESTERDAY · ${timeStr}`;
  const day = d.toLocaleDateString(undefined, { weekday: 'short' });
  const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${day} · ${md} · ${timeStr}`;
}
