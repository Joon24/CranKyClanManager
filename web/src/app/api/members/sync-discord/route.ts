import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { syncDiscordClanMembers } from '@/lib/discord-member-sync';

export async function POST() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const adminName = auth.session!.user!.username ?? '관리자';

  try {
    const result = await syncDiscordClanMembers(adminName);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Discord 동기화 실패' },
      { status: 500 }
    );
  }
}
