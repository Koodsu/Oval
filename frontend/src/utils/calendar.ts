import { ClubMeetingWithMeta } from '../types';

function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function formatCalendarDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildClubCalendarIcs(
  club: { id: string; name: string },
  meetings: ClubMeetingWithMeta[]
): string {
  const generatedAt = formatCalendarDate(new Date());
  const calendarName = `${club.name} - Oval`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Oval//Club Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeCalendarText(calendarName)}`,
  ];

  for (const meeting of meetings) {
    const start = new Date(meeting.meetingTime);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const description = [
      meeting.description,
      `Club: ${club.name}`,
      `View in Oval: https://www.theovalapp.com/clubs/${encodeURIComponent(club.id)}`,
    ].filter(Boolean).join('\n\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${meeting.id}@theovalapp.com`,
      `DTSTAMP:${generatedAt}`,
      `DTSTART:${formatCalendarDate(start)}`,
      `DTEND:${formatCalendarDate(end)}`,
      `SUMMARY:${escapeCalendarText(meeting.title)}`,
      `DESCRIPTION:${escapeCalendarText(description)}`,
      `LOCATION:${escapeCalendarText(meeting.location)}`,
      `URL:https://www.theovalapp.com/clubs/${encodeURIComponent(club.id)}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
