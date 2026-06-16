import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

/** @deprecated use getSupabase() */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabase(), prop);
  },
});

export async function logActivity(
  action: string,
  description: string,
  userId?: string,
  createdBy?: string
) {
  await supabase.from('activity_logs').insert({
    user_id: userId ?? null,
    action,
    description,
    created_by: createdBy ?? null,
  });
}
