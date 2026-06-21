import { buildClubCalendarIcs } from './calendar';
import { ClubMeetingWithMeta } from '../types';

describe('buildClubCalendarIcs', () => {
  it('creates an Apple Calendar compatible event and escapes text', () => {
    const meeting = {
      id: 'meeting-1',
      clubId: 'club-1',
      title: 'Planning, Pizza',
      description: 'Line one\nLine two',
      location: 'Room 1; Union',
      meetingTime: '2026-06-10T22:00:00.000Z',
      visibility: 'PUBLIC',
      isPublic: true,
      targetRoleIds: [],
      createdById: 'user-1',
      createdAt: '2026-06-01T12:00:00.000Z',
      rsvpCounts: { going: 0, maybe: 0, notGoing: 0 },
      myRsvp: null,
      attendeeCount: 0,
    } satisfies ClubMeetingWithMeta;

    const result = buildClubCalendarIcs(
      { id: 'club-1', name: 'Oval Club' },
      [meeting]
    );

    expect(result).toContain('BEGIN:VCALENDAR\r\n');
    expect(result).toContain('DTSTART:20260610T220000Z');
    expect(result).toContain('SUMMARY:Planning\\, Pizza');
    expect(result).toContain('LOCATION:Room 1\\; Union');
    expect(result).toContain('DESCRIPTION:Line one\\nLine two');
    expect(result).toContain('END:VCALENDAR\r\n');
  });
});
