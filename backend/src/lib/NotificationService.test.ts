import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePreferences, DEFAULT_PREFS } from './NotificationService';

// ── Expo mock ────────────────────────────────────────────────────────────────
// vi.hoisted ensures these are available when the hoisted vi.mock() factory runs
const { mockSend, mockChunk, mockPodFindUnique, mockPodFindMany, mockPodUpdateMany } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue([]),
  mockChunk: vi.fn((msgs: unknown[]) => [msgs]),
  mockPodFindUnique: vi.fn(),
  mockPodFindMany: vi.fn(),
  mockPodUpdateMany: vi.fn().mockResolvedValue({ count: 1 }),
}));

vi.mock('expo-server-sdk', () => {
  // Use a regular function (not arrow) so `new Expo()` works as a constructor.
  function Expo(this: Record<string, unknown>) {
    this.chunkPushNotifications = mockChunk;
    this.sendPushNotificationsAsync = mockSend;
  }
  Expo.isExpoPushToken = (t: string) => typeof t === 'string' && t.startsWith('ExponentPushToken[');
  return { Expo };
});

vi.mock('../prisma', () => ({
  default: {
    pod: {
      findUnique: (...args: unknown[]) => mockPodFindUnique(...args),
      findMany: (...args: unknown[]) => mockPodFindMany(...args),
      updateMany: (...args: unknown[]) => mockPodUpdateMany(...args),
    },
  },
}));

// ── parsePreferences unit tests ──────────────────────────────────────────────
describe('parsePreferences', () => {
  it('returns DEFAULT_PREFS when input is null', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFS);
  });

  it('returns DEFAULT_PREFS when input is undefined', () => {
    expect(parsePreferences(undefined)).toEqual(DEFAULT_PREFS);
  });

  it('returns DEFAULT_PREFS when input is invalid JSON', () => {
    expect(parsePreferences('not-json')).toEqual(DEFAULT_PREFS);
  });

  it('parses valid JSON preferences', () => {
    const raw = JSON.stringify({ podJoin: false, newMessage: true, meetupReminder: false });
    expect(parsePreferences(raw)).toEqual({ ...DEFAULT_PREFS, podJoin: false, newMessage: true, meetupReminder: false });
  });

  it('treats missing keys as true (default on)', () => {
    const raw = JSON.stringify({ podJoin: false });
    const result = parsePreferences(raw);
    expect(result.podJoin).toBe(false);
    expect(result.newMessage).toBe(true);
    expect(result.meetupReminder).toBe(true);
  });

  it('handles all-true preferences', () => {
    const raw = JSON.stringify({ podJoin: true, newMessage: true, meetupReminder: true });
    expect(parsePreferences(raw)).toEqual({ ...DEFAULT_PREFS, podJoin: true, newMessage: true, meetupReminder: true });
  });
});

// ── NotificationService behaviour tests ─────────────────────────────────────
describe('NotificationService.notifyPodJoin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue([]);
    mockChunk.mockImplementation((msgs: unknown[]) => [msgs]);
    mockPodUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('does not throw when pod is not found', async () => {
    mockPodFindUnique.mockResolvedValue(null);
    const { NotificationService } = await import('./NotificationService');
    await expect(NotificationService.notifyPodJoin('pod1', 'user1')).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not send when joiner is the creator', async () => {
    mockPodFindUnique.mockResolvedValue({
      id: 'pod1',
      creator: { id: 'user1', name: 'Creator', pushToken: 'ExponentPushToken[xxx]', notificationPreferences: null },
      activity: { title: 'Morning Coffee Walk' },
      members: [{ user: { id: 'user1', name: 'Creator' } }],
      maxMembers: 4,
    });
    const { NotificationService } = await import('./NotificationService');
    await NotificationService.notifyPodJoin('pod1', 'user1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not send when creator has no pushToken', async () => {
    mockPodFindUnique.mockResolvedValue({
      id: 'pod1',
      creator: { id: 'creator1', name: 'Creator', pushToken: null, notificationPreferences: null },
      activity: { title: 'Morning Coffee Walk' },
      members: [
        { user: { id: 'creator1', name: 'Creator' } },
        { user: { id: 'joiner1', name: 'Joiner' } },
      ],
      maxMembers: 4,
    });
    const { NotificationService } = await import('./NotificationService');
    await NotificationService.notifyPodJoin('pod1', 'joiner1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not send when creator has podJoin pref disabled', async () => {
    mockPodFindUnique.mockResolvedValue({
      id: 'pod1',
      creator: {
        id: 'creator1',
        name: 'Creator',
        pushToken: 'ExponentPushToken[xxx]',
        notificationPreferences: JSON.stringify({ podJoin: false, newMessage: true, meetupReminder: true }),
      },
      activity: { title: 'Morning Coffee Walk' },
      members: [
        { user: { id: 'creator1', name: 'Creator' } },
        { user: { id: 'joiner1', name: 'Joiner' } },
      ],
      maxMembers: 4,
    });
    const { NotificationService } = await import('./NotificationService');
    await NotificationService.notifyPodJoin('pod1', 'joiner1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends notification to creator when all conditions met', async () => {
    mockPodFindUnique.mockResolvedValue({
      id: 'pod1',
      creator: {
        id: 'creator1',
        name: 'Creator',
        pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxx]',
        notificationPreferences: null,
      },
      activity: { title: 'Morning Coffee Walk' },
      members: [
        { user: { id: 'creator1', name: 'Creator' } },
        { user: { id: 'joiner1', name: 'Joiner' } },
      ],
      maxMembers: 4,
    });
    const { NotificationService } = await import('./NotificationService');
    await NotificationService.notifyPodJoin('pod1', 'joiner1');
    expect(mockChunk).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxx]',
          data: expect.objectContaining({ type: 'pod_join', podId: 'pod1' }),
        }),
      ])
    );
    expect(mockSend).toHaveBeenCalled();
  });
});

describe('NotificationService.notifyNewMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue([]);
    mockChunk.mockImplementation((msgs: unknown[]) => [msgs]);
  });

  it('does not throw when pod is not found', async () => {
    mockPodFindUnique.mockResolvedValue(null);
    const { NotificationService } = await import('./NotificationService');
    await expect(NotificationService.notifyNewMessage('pod1', 'user1')).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips members without push tokens', async () => {
    mockPodFindUnique.mockResolvedValue({
      id: 'pod1',
      activity: { title: 'Study Session' },
      members: [
        { user: { id: 'sender1', name: 'Sender', pushToken: null, notificationPreferences: null } },
        { user: { id: 'other1', name: 'Other', pushToken: null, notificationPreferences: null } },
      ],
    });
    const { NotificationService } = await import('./NotificationService');
    await NotificationService.notifyNewMessage('pod1', 'sender1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips the sender themselves', async () => {
    mockPodFindUnique.mockResolvedValue({
      id: 'pod1',
      activity: { title: 'Study Session' },
      members: [
        { user: { id: 'sender1', name: 'Sender', pushToken: 'ExponentPushToken[xxx]', notificationPreferences: null } },
      ],
    });
    const { NotificationService } = await import('./NotificationService');
    await NotificationService.notifyNewMessage('pod1', 'sender1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips members with newMessage pref disabled', async () => {
    mockPodFindUnique.mockResolvedValue({
      id: 'pod1',
      activity: { title: 'Study Session' },
      members: [
        { user: { id: 'sender1', name: 'Sender', pushToken: null, notificationPreferences: null } },
        {
          user: {
            id: 'other1',
            name: 'Other',
            pushToken: 'ExponentPushToken[yyy]',
            notificationPreferences: JSON.stringify({ podJoin: true, newMessage: false, meetupReminder: true }),
          },
        },
      ],
    });
    const { NotificationService } = await import('./NotificationService');
    await NotificationService.notifyNewMessage('pod1', 'sender1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends to eligible members', async () => {
    const token = 'ExponentPushToken[zzzzzzzzzzzzzzzzzzzzz]';
    mockPodFindUnique.mockResolvedValue({
      id: 'pod1',
      activity: { title: 'Study Session' },
      members: [
        { user: { id: 'sender1', name: 'Alice', pushToken: null, notificationPreferences: null } },
        { user: { id: 'other1', name: 'Bob', pushToken: token, notificationPreferences: null } },
      ],
    });
    const { NotificationService } = await import('./NotificationService');
    await NotificationService.notifyNewMessage('pod1', 'sender1');
    expect(mockChunk).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ to: token })])
    );
    expect(mockSend).toHaveBeenCalled();
  });
});

describe('NotificationService.sendMeetupReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue([]);
    mockChunk.mockImplementation((msgs: unknown[]) => [msgs]);
  });

  it('does not throw when no pods are in window', async () => {
    mockPodFindMany.mockResolvedValue([]);
    const { NotificationService } = await import('./NotificationService');
    await expect(NotificationService.sendMeetupReminders()).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips members without tokens', async () => {
    mockPodFindMany.mockResolvedValue([
      {
        id: 'pod1',
        activity: { title: 'Run' },
        location: 'RPAC',
        members: [
          { user: { id: 'u1', pushToken: null, notificationPreferences: null } },
        ],
      },
    ]);
    const { NotificationService } = await import('./NotificationService');
    await NotificationService.sendMeetupReminders();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends reminders to members with tokens and pref enabled', async () => {
    const token = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
    mockPodFindMany.mockResolvedValue([
      {
        id: 'pod1',
        activity: { title: 'Morning Run' },
        location: 'RPAC',
        members: [
          { user: { id: 'u1', pushToken: token, notificationPreferences: null } },
        ],
      },
    ]);
    const { NotificationService } = await import('./NotificationService');
    await NotificationService.sendMeetupReminders();
    expect(mockPodUpdateMany).toHaveBeenCalledWith({
      where: { id: 'pod1', meetupReminderSentAt: null },
      data: { meetupReminderSentAt: expect.any(Date) },
    });
    expect(mockChunk).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ to: token, title: 'Meetup in 1 hour!' }),
      ])
    );
    expect(mockSend).toHaveBeenCalled();
  });
});
