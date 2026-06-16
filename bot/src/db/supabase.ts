import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

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
