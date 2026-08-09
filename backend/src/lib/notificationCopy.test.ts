import { describe, expect, it } from 'vitest';
import {
  clubAttendanceOpenCopy,
  clubOutreachCopy,
  clubRoleChangeCopy,
  demandPlanCreatedCopy,
  firstPlanNudgeCopy,
  friendRequestCopy,
  notificationPreview,
  podUpdateCopy,
  waitlistTwinCopy,
  weeklyPlanningCopy,
} from './notificationCopy';

describe('notificationPreview', () => {
  it('collapses whitespace and caps lock-screen copy', () => {
    const preview = notificationPreview(`  hello\n\n${'x'.repeat(140)}  `);
    expect(preview).not.toContain('\n');
    expect(preview).toHaveLength(110);
    expect(preview.endsWith('...')).toBe(true);
  });
});

describe('weeklyPlanningCopy', () => {
  it('never prints empty-week zero statistics', () => {
    expect(weeklyPlanningCopy(0, 0, 3)).toEqual({
      title: '3 plans match your interests',
      body: "See what's forming around campus this week.",
    });
    expect(weeklyPlanningCopy(0, 0, 1)?.title).toBe('1 plan matches your interests');
  });

  it('uses correct singular wording', () => {
    expect(weeklyPlanningCopy(1, 1, 1)).toEqual({
      title: 'You made it to 1 plan this week',
      body: 'You met 1 new person. 1 more plan matches your interests this week.',
    });
  });

  it('stays silent without a useful next action', () => {
    expect(weeklyPlanningCopy(2, 3, 0)).toBeNull();
    expect(weeklyPlanningCopy(0, 0, 0)).toBeNull();
  });
});

describe('podUpdateCopy', () => {
  it('names a time-only change', () => {
    expect(podUpdateCopy('Pickup Basketball', ['meetupTime'], 'Friday at 7:30 PM', 'RPAC')).toEqual({
      title: 'Pickup Basketball moved to Friday at 7:30 PM',
      body: 'Friday at 7:30 PM · RPAC',
    });
  });
});

describe('clubRoleChangeCopy', () => {
  it.each([
    ['OWNER', "You're now the owner of Coding Club"],
    ['ADMIN', "You're now an admin in Coding Club"],
    ['OFFICER', "You're now an officer in Coding Club"],
    ['MEMBER', "You're now a member in Coding Club"],
  ])('uses the real %s role label', (role, title) => {
    expect(clubRoleChangeCopy('Coding Club', role).title).toBe(title);
  });
});

describe('transactional copy', () => {
  it('keeps invitations and time-sensitive prompts specific and actionable', () => {
    expect(friendRequestCopy('Maya')).toEqual({
      title: 'Maya sent you a friend request',
      body: 'Open your Inbox to respond.',
    });
    expect(waitlistTwinCopy('Coffee Crawl', 'Saturday at 11:00 AM', 'Short North')).toEqual({
      title: 'Another Coffee Crawl opened',
      body: 'Saturday at 11:00 AM · Short North · You have first look.',
    });
    expect(firstPlanNudgeCopy('Coffee Crawl', '11:00 AM', 'Short North', 'Maya is going')).toEqual({
      title: 'Your first Oval plan is today',
      body: 'Coffee Crawl · 11:00 AM at Short North · Maya is going',
    });
  });

  it('keeps discovery and club copy concise', () => {
    expect(demandPlanCreatedCopy('Pickup Soccer', 'tomorrow', '7:00 PM', 'Lincoln Tower Park')).toEqual({
      title: 'Pickup Soccer is happening tomorrow',
      body: '7:00 PM at Lincoln Tower Park. Join while spots are open.',
    });
    expect(clubAttendanceOpenCopy('Weekly meeting', 'Oval Builders')).toEqual({
      title: 'Check in to Weekly meeting',
      body: 'Oval Builders is meeting now.',
    });
    expect(clubOutreachCopy('Oval Builders', ' Room changed\n to Enarson 204 ')).toEqual({
      title: 'Message from Oval Builders',
      body: 'Room changed to Enarson 204',
    });
  });
});
