import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { supabase } from '@/lib/supabase';
import {
  balanceQuickLobbies,
  type BalanceMode,
  type MemberWithStats,
} from '@/lib/team-balance';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await req.json();
  const mode: BalanceMode = body.mode ?? 'kd';
  const memberIds: string[] = body.memberIds ?? [];

  if (memberIds.length < 2) {
    return NextResponse.json({ error: '최소 2명 이상 선택해 주세요.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, sudden_nickname, position, match_stats(kd, tier_name)')
    .in('id', memberIds)
    .eq('status', 'approved');

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? '조회 실패' }, { status: 500 });
  }

  const members = data.map((d) => ({
    ...d,
    match_stats: Array.isArray(d.match_stats) ? d.match_stats[0] ?? null : d.match_stats,
  })) as MemberWithStats[];

  try {
    const result = balanceQuickLobbies(members, mode);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '팀 분배 실패' },
      { status: 400 }
    );
  }
}
