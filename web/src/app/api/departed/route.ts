import { NextResponse } from 'next/server';
import { requireAdmin, getAdminDisplayName } from '@/lib/api-auth';
import { supabase, logActivity } from '@/lib/supabase';
import { adminWebhook } from '@/lib/webhook';
import { botBan, botUnban } from '@/lib/bot-api';

const DEPARTED_STATUSES = ['left', 'kicked', 'blocked'] as const;

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .in('status', DEPARTED_STATUSES)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

async function registerBlacklist(params: {
  discordUserId: string;
  reason: string;
  adminName: string;
  userId?: string;
  nickname?: string;
}) {
  const { discordUserId, reason, adminName, userId, nickname } = params;
  const now = new Date().toISOString();

  const updatePayload = {
    status: 'blocked' as const,
    blacklist_reason: reason,
    blacklisted_at: now,
    blacklisted_by: adminName,
  };

  if (userId) {
    const { error } = await supabase.from('users').update(updatePayload).eq('id', userId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('users').upsert(
      {
        discord_user_id: discordUserId,
        discord_username: nickname ?? `user_${discordUserId.slice(-6)}`,
        sudden_nickname: nickname ?? null,
        ...updatePayload,
      },
      { onConflict: 'discord_user_id' }
    );
    if (error) throw new Error(error.message);
  }

  try {
    await botBan({ discordUserId, reason });
  } catch (e) {
    console.error('Bot ban failed:', e);
  }

  const displayName = nickname ?? discordUserId;

  await adminWebhook.blacklistRegistered([
    { name: '대상', value: displayName, inline: true },
    { name: '유저ID', value: discordUserId, inline: true },
    { name: '처리자', value: adminName, inline: true },
    { name: '사유', value: reason, inline: false },
  ]);

  await logActivity(
    '블랙리스트 등록',
    `${displayName} (${discordUserId}) - ${reason}`,
    userId,
    adminName
  );
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await req.json();
  const adminName = getAdminDisplayName(auth.session!);
  const { action, userId, discordUserId, reason, nickname } = body;

  if (!action) {
    return NextResponse.json({ error: 'action required' }, { status: 400 });
  }

  switch (action) {
    case 'blacklist': {
      if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
      }
      const blacklistReason = (reason ?? '').trim() || '관리자 블랙리스트 등록';

      const { data: user } = await supabase
        .from('users')
        .select('discord_user_id, sudden_nickname, status')
        .eq('id', userId)
        .single();

      if (!user?.discord_user_id) {
        return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
      }
      if (user.status === 'blocked') {
        return NextResponse.json({ error: '이미 블랙리스트에 등록된 사용자입니다.' }, { status: 400 });
      }

      await registerBlacklist({
        userId,
        discordUserId: user.discord_user_id,
        reason: blacklistReason,
        adminName,
        nickname: user.sudden_nickname ?? undefined,
      });
      break;
    }

    case 'blacklist_by_id': {
      const id = (discordUserId ?? '').trim();
      if (!/^\d{17,20}$/.test(id)) {
        return NextResponse.json(
          { error: '올바른 Discord 유저 ID를 입력해 주세요. (17~20자리 숫자)' },
          { status: 400 }
        );
      }

      const blacklistReason = (reason ?? '').trim() || '관리자 블랙리스트 등록';

      const { data: existing } = await supabase
        .from('users')
        .select('id, status, sudden_nickname')
        .eq('discord_user_id', id)
        .maybeSingle();

      if (existing?.status === 'blocked') {
        return NextResponse.json({ error: '이미 블랙리스트에 등록된 유저 ID입니다.' }, { status: 400 });
      }

      await registerBlacklist({
        userId: existing?.id,
        discordUserId: id,
        reason: blacklistReason,
        adminName,
        nickname: nickname?.trim() || existing?.sudden_nickname || undefined,
      });
      break;
    }

    case 'unblacklist': {
      if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
      }

      const { data: user } = await supabase
        .from('users')
        .select('discord_user_id, sudden_nickname, status')
        .eq('id', userId)
        .single();

      if (!user) {
        return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
      }
      if (user.status !== 'blocked') {
        return NextResponse.json({ error: '블랙리스트에 등록되지 않은 사용자입니다.' }, { status: 400 });
      }

      await supabase
        .from('users')
        .update({
          status: 'left',
          blacklist_reason: null,
          blacklisted_at: null,
          blacklisted_by: null,
        })
        .eq('id', userId);

      if (user.discord_user_id) {
        try {
          await botUnban({ discordUserId: user.discord_user_id });
        } catch (e) {
          console.error('Bot unban failed:', e);
        }
      }

      const displayName = user.sudden_nickname ?? user.discord_user_id;

      await adminWebhook.blacklistRemoved([
        { name: '대상', value: displayName, inline: true },
        { name: '유저ID', value: user.discord_user_id, inline: true },
        { name: '처리자', value: adminName, inline: true },
      ]);

      await logActivity(
        '블랙리스트 해제',
        `${displayName} (${user.discord_user_id})`,
        userId,
        adminName
      );
      break;
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
