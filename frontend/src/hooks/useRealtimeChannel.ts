import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '../lib/supabase';

/**
 * Subscribes to a Supabase Realtime broadcast topic and invokes `onEvent`
 * whenever one of `events` fires. Events are content-free pings — callers
 * react by refetching through the authenticated REST API.
 *
 * Returns whether the channel is currently connected, so callers can relax
 * their polling interval when realtime is live and tighten it when it isn't.
 */
export function useRealtimeChannel(
  topic: string | null,
  events: string[],
  onEvent: (event: string) => void,
): boolean {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  const eventsKey = events.join(',');

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !topic) return;

    const channel = supabase.channel(topic);
    for (const event of eventsKey.split(',')) {
      if (!event) continue;
      channel.on('broadcast', { event }, () => handlerRef.current(event));
    }
    channel.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED');
    });

    return () => {
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [topic, eventsKey]);

  return connected;
}

export const REALTIME_CHAT_EVENTS = ['new_message', 'message_update', 'typing'];
export const REALTIME_INBOX_EVENTS = ['inbox_updated'];
