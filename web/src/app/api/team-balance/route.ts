import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { supabase } from '@/lib/supabase';
import {
  balanceQuickTeams,
  type BalanceMode,
  type MemberWithStats,
  type QuickType,
} from '@/lib/team-balance';

const QUICK_TYPES: QuickType[] = ['33', '44', '55'];

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await req.json();
  const mode: BalanceMode = body.mode ?? 'kd';
  const quickType: QuickType = body.quickType ?? '44';
  const quickCount = Number(body.quickCount ?? 2);
  const memberIds: string[] = body.memberIds ?? [];

  if (!QUICK_TYPES.includes(quickType)) {
    return NextResponse.json({ error: '퀵 타입은 33·44·55 중 하나여야 합니다.' }, { status: 400 });
  }

  if (!Number.isInteger(quickCount) || quickCount < 1 || quickCount > 20) {
    return NextResponse.json({ error: '퀵 수는 1~20 사이 정수여야 합니다.' }, { status: 400 });
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
    const result = balanceQuickTeams(members, mode, quickType, quickCount);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '팀 분배 실패' },
      { status: 400 }
    );
  }
}
