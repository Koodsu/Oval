import { useCallback, useEffect, useRef, useState } from 'react';

const TYPING_TTL_MS = 5500;

export function realtimeUserId(payload: Record<string, unknown>): string | null {
  return typeof payload.userId === 'string' && payload.userId ? payload.userId : null;
}

/**
 * Tracks typing presence from realtime payloads on the client. The backend is
 * serverless, so typing state cannot safely live in a process-local map.
 */
export function useRealtimeTyping(scopeKey: string, currentUserId?: string) {
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const removeTypingUser = useCallback((userId: string | null) => {
    if (!userId) return;
    const timer = timersRef.current.get(userId);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(userId);
    setTypingUserIds((current) => current.filter((id) => id !== userId));
  }, []);

  const markTyping = useCallback(
    (payload: Record<string, unknown>) => {
      const userId = realtimeUserId(payload);
      if (!userId || userId === currentUserId) return;

      const currentTimer = timersRef.current.get(userId);
      if (currentTimer) clearTimeout(currentTimer);
      setTypingUserIds((current) => (current.includes(userId) ? current : [...current, userId]));
      timersRef.current.set(
        userId,
        setTimeout(() => {
          timersRef.current.delete(userId);
          setTypingUserIds((current) => current.filter((id) => id !== userId));
        }, TYPING_TTL_MS),
      );
    },
    [currentUserId],
  );

  useEffect(() => {
    setTypingUserIds([]);
    return () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer);
      timersRef.current.clear();
    };
  }, [scopeKey]);

  return { typingUserIds, markTyping, removeTypingUser };
}
