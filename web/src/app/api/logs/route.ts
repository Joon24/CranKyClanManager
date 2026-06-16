import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const type = req.nextUrl.searchParams.get('type');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10);

  let query = supabase
    .from('activity_logs')
    .select('*, users(sudden_nickname, discord_username)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (type) {
    query = query.ilike('action', `%${type}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
