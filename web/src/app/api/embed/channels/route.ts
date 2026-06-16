import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { botGetChannels } from '@/lib/bot-api';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const channels = await botGetChannels();
    return NextResponse.json(channels);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '채널 목록 조회 실패' },
      { status: 500 }
    );
  }
}
