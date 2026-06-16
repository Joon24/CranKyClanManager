import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { supabase } from '@/lib/supabase';
import { fetchMatchStats, fetchOuid, MATCH_DISPLAY_SIZE, MATCH_SAMPLE_SIZE } from '@/lib/nexon';
import { calculateSuspicion } from '@/lib/suspicion';
import { syncMemberStats, syncMemberStatsByNickname } from '@/lib/match-stats-sync';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ouid: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { ouid: ouidOrNickname } = await params;
  const isOuid = /^[a-f0-9-]+$/i.test(ouidOrNickname);
  const searchNickname = isOuid ? undefined : ouidOrNickname.trim();

  let ouid = isOuid ? ouidOrNickname : null;
  if (!ouid) {
    ouid = await fetchOuid(ouidOrNickname);
    if (!ouid) {
      return NextResponse.json({ error: '유저를 찾을 수 없습니다.' }, { status: 404 });
    }
  }

  let syncedMember: { nickname: string; userId: string } | null = null;

  const { data: userByOuid } = await supabase
    .from('users')
    .select('id, sudden_nickname')
    .eq('ouid', ouid)
    .eq('status', 'approved')
    .maybeSingle();

  const { data: userByNick } = !userByOuid
    ? await supabase
        .from('users')
        .select('id, sudden_nickname')
        .eq('sudden_nickname', ouidOrNickname)
        .eq('status', 'approved')
        .maybeSingle()
    : { data: null };

  const user = userByOuid ?? userByNick;

  if (user) {
    const synced = await syncMemberStats(user.id);
    if (!synced) {
      return NextResponse.json({ error: '전적 조회 실패' }, { status: 404 });
    }
    syncedMember = { nickname: synced.nickname, userId: synced.userId };

    const stats = await fetchMatchStats(ouid, searchNickname);
    if (!stats) {
      return NextResponse.json({ error: '전적 조회 실패' }, { status: 404 });
    }
    const suspicion = calculateSuspicion(stats);

    return NextResponse.json({
      ...stats,
      suspicion,
      matchSampleSize: MATCH_SAMPLE_SIZE,
      syncedMember,
      disclaimer: `KD · 승률은 최근 ${MATCH_DISPLAY_SIZE}경기, 의심지표는 최근 ${MATCH_SAMPLE_SIZE}판 기준 참고용입니다. 공식 제재 확인이 아닙니다.`,
    });
  }

  if (!isOuid) {
    const synced = await syncMemberStatsByNickname(ouidOrNickname);
    if (synced) {
      syncedMember = { nickname: synced.nickname, userId: synced.userId };
      const stats = await fetchMatchStats(ouid, searchNickname);
      if (stats) {
        const suspicion = calculateSuspicion(stats);
        return NextResponse.json({
          ...stats,
          suspicion,
          matchSampleSize: MATCH_SAMPLE_SIZE,
          syncedMember,
          disclaimer: `KD · 승률은 최근 ${MATCH_DISPLAY_SIZE}경기, 의심지표는 최근 ${MATCH_SAMPLE_SIZE}판 기준 참고용입니다. 공식 제재 확인이 아닙니다.`,
        });
      }
    }
  }

  const stats = await fetchMatchStats(ouid, searchNickname);
  if (!stats) {
    return NextResponse.json({ error: '전적 조회 실패' }, { status: 404 });
  }

  const suspicion = calculateSuspicion(stats);

  return NextResponse.json({
    ...stats,
    suspicion,
    matchSampleSize: MATCH_SAMPLE_SIZE,
    syncedMember,
    disclaimer: `KD · 승률은 최근 ${MATCH_DISPLAY_SIZE}경기, 의심지표는 최근 ${MATCH_SAMPLE_SIZE}판 기준 참고용입니다. 공식 제재 확인이 아닙니다.`,
  });
}
