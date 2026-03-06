import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Startup validation — warn about critical missing env vars
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.error('❌ NEXT_PUBLIC_APP_URL is not set. CORS and QR codes will use fallback URLs.');
  }
}

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Return a dummy client during build — realtime won't work without real credentials
    console.warn(
      '⚠️  NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
      'Realtime features (order updates, kitchen notifications) will not work.'
    );
    _supabase = createClient('https://placeholder.supabase.co', 'placeholder');
  } else {
    _supabase = createClient(url, key);
  }

  return _supabase;
}

// Legacy export for backward compatibility
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
