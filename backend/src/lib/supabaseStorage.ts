import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

export const supabaseStorage = createClient(
  supabaseUrl || 'http://localhost',
  supabaseServiceKey || 'development-placeholder-key'
);
