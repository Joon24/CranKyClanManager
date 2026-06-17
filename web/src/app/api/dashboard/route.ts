import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);

  const [
    { count: totalMembers },
    { count: pendingApps },
    { count: todayJoins },
    { data: warningRows },
    { count: reviewTargets },
    { data: recentLogs },
    { data: pendingList },
    { data: approvedUsers },
    { data: weekUsers },
    { data: todayJoinList },
    { data: reviewTargetList },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .or('member_type.eq.member,member_type.is.null'),
    supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .or('member_type.eq.member,member_type.is.null')
      .gte('created_at', today.toISOString()),
    supabase.from('warnings').select('user_id, point, reason, created_at'),
    supabase
      .from('match_stats')
      .select('*', { count: 'exact', head: true })
      .eq('suspicion_level', 'review'),
    supabase
      .from('activity_logs')
      .select('id, action, description, created_by, created_at, users(sudden_nickname)')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('applications')
      .select('id, sudden_nickname, position, age, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('users').select('position').eq('status', 'approved').or('member_type.eq.member,member_type.is.null'),
    supabase
      .from('users')
      .select('created_at')
      .eq('status', 'approved')
      .or('member_type.eq.member,member_type.is.null')
      .gte('created_at', weekAgo.toISOString()),
    supabase
      .from('users')
      .select('id, sudden_nickname, server_nickname, position, created_at')
      .eq('status', 'approved')
      .or('member_type.eq.member,member_type.is.null')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('match_stats')
      .select(
        'suspicion_score, suspicion_level, kd, win_rate, users(id, sudden_nickname, server_nickname, position)'
      )
      .eq('suspicion_level', 'review')
      .order('suspicion_score', { ascending: false }),
  ]);

  const warningUserIds = new Set((warningRows ?? []).map((w) => w.user_id));

  const warningByUser = new Map<
    string,
    { count: number; points: number; latestReason: string; latestAt: string }
  >();
  for (const row of warningRows ?? []) {
    const current = warningByUser.get(row.user_id) ?? {
      count: 0,
      points: 0,
      latestReason: row.reason,
      latestAt: row.created_at,
    };
    current.count += 1;
    current.points += row.point ?? 1;
    if (row.created_at >= current.latestAt) {
      current.latestReason = row.reason;
      current.latestAt = row.created_at;
    }
    warningByUser.set(row.user_id, current);
  }

  let warningUserList: {
    id: string;
    sudden_nickname: string;
    server_nickname: string | null;
    position: string;
    warning_count: number;
    warning_points: number;
    latest_reason: string;
  }[] = [];

  if (warningByUser.size > 0) {
    const { data: warnedUsers } = await supabase
      .from('users')
      .select('id, sudden_nickname, server_nickname, position')
      .eq('status', 'approved')
      .in('id', [...warningByUser.keys()]);

    warningUserList = (warnedUsers ?? [])
      .map((user) => {
        const stats = warningByUser.get(user.id)!;
        return {
          id: user.id,
          sudden_nickname: user.sudden_nickname,
          server_nickname: user.server_nickname,
          position: user.position,
          warning_count: stats.count,
          warning_points: stats.points,
          latest_reason: stats.latestReason,
        };
      })
      .sort((a, b) => b.warning_points - a.warning_points);
  }

  const reviewList = (reviewTargetList ?? [])
    .map((row) => {
      const user = Array.isArray(row.users) ? row.users[0] : row.users;
      if (!user) return null;
      return {
        id: user.id,
        sudden_nickname: user.sudden_nickname,
        server_nickname: user.server_nickname,
        position: user.position,
        suspicion_score: row.suspicion_score,
        kd: row.kd,
        win_rate: row.win_rate,
      };
    })
    .filter(Boolean);

  const positionCount = { S: 0, R: 0, M: 0, T: 0, other: 0 };
  for (const u of approvedUsers ?? []) {
    const p = u.position as keyof typeof positionCount;
    if (p === 'S' || p === 'R' || p === 'M' || p === 'T') positionCount[p]++;
    else positionCount.other++;
  }

  const joinTrend: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const count = (weekUsers ?? []).filter((u) => {
      const t = new Date(u.created_at).getTime();
      return t >= d.getTime() && t < next.getTime();
    }).length;
    joinTrend.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      count,
    });
  }

  const maxTrend = Math.max(...joinTrend.map((t) => t.count), 1);

  return NextResponse.json({
    totalMembers: totalMembers ?? 0,
    pendingApps: pendingApps ?? 0,
    todayJoins: todayJoins ?? 0,
    warningUsers: warningUserIds.size,
    reviewTargets: reviewTargets ?? 0,
    positionCount,
    joinTrend,
    maxTrend,
    recentLogs: recentLogs ?? [],
    pendingList: pendingList ?? [],
    todayJoinList: todayJoinList ?? [],
    warningUserList,
    reviewTargetList: reviewList,
  });
}
