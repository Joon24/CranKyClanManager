import { NextResponse } from 'next/server';
import { requireAdmin, getAdminDisplayName } from '@/lib/api-auth';
import { botSendEmbed } from '@/lib/bot-api';
import { logActivity } from '@/lib/supabase';
import type { EmbedMessage } from '@/lib/embed-types';
import { toDiscordPayload, validateMessage } from '@/lib/embed-payload';

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await req.json();
  const { channelId, message } = body as { channelId?: string; message?: EmbedMessage };

  if (!channelId) {
    return NextResponse.json({ error: '채널을 선택해 주세요.' }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: '메시지 데이터가 없습니다.' }, { status: 400 });
  }

  const validationError = validateMessage(message);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const payload = toDiscordPayload(message);
  const adminName = getAdminDisplayName(auth.session!);

  try {
    const result = await botSendEmbed({
      channelId,
      content: payload.content,
      embeds: payload.embeds,
      components: payload.components,
      flags: payload.flags,
    });

    const embedCount = payload.embeds.length;
    await logActivity(
      '임베드 전송',
      `채널 ${channelId} · 임베드 ${embedCount}개`,
      auth.session!.user!.discordId ?? undefined,
      adminName
    );

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '임베드 전송 실패' },
      { status: 500 }
    );
  }
}
