import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import {
  syncMemberStats,
  syncAllApprovedMembers,
} from '@/lib/match-stats-sync';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  if (!process.env.NEXON_OPEN_API_KEY) {
    return NextResponse.json(
      { error: 'NEXON_OPEN_API_KEY가 설정되지 않았습니다.' },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));

  if (body.userId) {
    const result = await syncMemberStats(body.userId);
    if (!result) {
      return NextResponse.json({ error: '전적 조회에 실패했습니다.' }, { status: 404 });
    }
    return NextResponse.json({ synced: [result] });
  }

  const { synced, failed } = await syncAllApprovedMembers();
  return NextResponse.json({ synced, failed, total: synced.length + failed.length });
}
