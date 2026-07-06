import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let warnedMissingEnv = false;

/** Returns null when env is missing (e.g. tests); pod chat falls back to polling. */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Loud in dev: this is exactly how "realtime doesn't work" shipped once —
    // both env vars missing means every client silently degrades to polling.
    if (__DEV__ && !warnedMissingEnv) {
      warnedMissingEnv = true;
      console.warn(
        '[realtime] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set — ' +
          'live updates are DISABLED and the app will poll instead. Set both in ' +
          'frontend/.env (dev) and eas.json build env (production builds).',
      );
    }
    return null;
  }
  if (!client) {
    client = createClient(url, anonKey);
  }
  return client;
}
