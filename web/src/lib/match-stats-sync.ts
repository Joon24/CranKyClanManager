import { supabase } from '@/lib/supabase';
import { fetchMatchStats, fetchOuid, MATCH_SAMPLE_SIZE } from '@/lib/nexon';
import { calculateSuspicion } from '@/lib/suspicion';

export interface SyncedMemberStats {
  userId: string;
  nickname: string;
  kd: number;
  win_rate: number;
  suspicion_level: string;
  suspicion_score: number;
  match_count: number;
}

export async function syncMemberStats(userId: string): Promise<SyncedMemberStats | null> {
  const { data: user } = await supabase
    .from('users')
    .select('id, sudden_nickname, ouid')
    .eq('id', userId)
    .single();

  if (!user?.sudden_nickname) return null;

  let ouid = user.ouid;
  if (!ouid) {
    ouid = await fetchOuid(user.sudden_nickname);
    if (ouid) {
      await supabase.from('users').update({ ouid }).eq('id', userId);
    }
  }

  if (!ouid) return null;

  const stats = await fetchMatchStats(ouid);
  if (!stats) return null;

  const suspicion = calculateSuspicion(stats);

  await supabase.from('match_stats').upsert(
    {
      user_id: userId,
      ouid,
      kd: stats.displayKd,
      win_rate: stats.displayWinRate,
      rank_name: stats.rankName,
      tier_name: stats.tierName,
      recent_matches: stats.recentMatches,
      suspicion_score: suspicion.score,
      suspicion_level: suspicion.level,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  return {
    userId,
    nickname: user.sudden_nickname,
    kd: stats.displayKd,
    win_rate: stats.displayWinRate,
    suspicion_level: suspicion.level,
    suspicion_score: suspicion.score,
    match_count: stats.recentMatches.length,
  };
}

export async function syncMemberStatsByNickname(nickname: string): Promise<SyncedMemberStats | null> {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('sudden_nickname', nickname)
    .eq('status', 'approved')
    .maybeSingle();

  if (!user) return null;
  return syncMemberStats(user.id);
}

export async function syncAllApprovedMembers(): Promise<{
  synced: SyncedMemberStats[];
  failed: string[];
}> {
  const { data: members } = await supabase
    .from('users')
    .select('id, sudden_nickname')
    .eq('status', 'approved');

  const synced: SyncedMemberStats[] = [];
  const failed: string[] = [];

  for (const member of members ?? []) {
    try {
      const result = await syncMemberStats(member.id);
      if (result) synced.push(result);
      else failed.push(member.sudden_nickname ?? member.id);
    } catch {
      failed.push(member.sudden_nickname ?? member.id);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  return { synced, failed };
}

export { MATCH_SAMPLE_SIZE };
