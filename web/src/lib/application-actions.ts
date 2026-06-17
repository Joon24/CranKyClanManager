import { supabase, logActivity } from '@/lib/supabase';
import { botApprove, botReject, botBan } from '@/lib/bot-api';
import { adminWebhook } from '@/lib/webhook';
import { buildServerNickname, type Position } from '@shared/types';
import { fetchMatchStats, fetchOuid } from '@/lib/nexon';
import { calculateSuspicion } from '@/lib/suspicion';

interface ApproveParams {
  applicationId: string;
  adminName: string;
}

export async function approveApplication({ applicationId, adminName }: ApproveParams) {
  const { data: app, error } = await supabase
    .from('applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (error || !app) throw new Error('신청을 찾을 수 없습니다.');
  if (app.status !== 'pending' && app.status !== 'on_hold') {
    throw new Error('이미 처리된 신청입니다.');
  }

  const { data: blockedUser } = await supabase
    .from('users')
    .select('id')
    .eq('discord_user_id', app.discord_user_id)
    .eq('status', 'blocked')
    .maybeSingle();

  if (blockedUser) {
    throw new Error('블랙리스트에 등록된 사용자입니다. 승인할 수 없습니다.');
  }

  const serverNickname = buildServerNickname(
    app.sudden_nickname,
    app.position as Position,
    app.age
  );

  // 1. 봇 먼저: 별명 변경 + 역할 지급 + DM (실패 시 승인 중단)
  const botResult = await botApprove({
    discordUserId: app.discord_user_id,
    suddenNickname: app.sudden_nickname,
    position: app.position,
    age: app.age,
  });

  // 2. DB 저장
  let ouid =
    app.api_check_status === 'success'
      ? null
      : await fetchOuid(app.sudden_nickname);

  if (!ouid) {
    const { data: userData } = await supabase
      .from('users')
      .select('ouid')
      .eq('discord_user_id', app.discord_user_id)
      .maybeSingle();
    ouid = userData?.ouid ?? null;
  }

  const memberRoleId = process.env.DISCORD_MEMBER_ROLE_ID ?? '';

  const { data: user, error: userError } = await supabase
    .from('users')
    .upsert(
      {
        discord_user_id: app.discord_user_id,
        discord_username: app.sudden_nickname,
        sudden_nickname: app.sudden_nickname,
        ouid,
        age: app.age,
        position: app.position,
        server_nickname: botResult.serverNickname ?? serverNickname,
        role: memberRoleId,
        status: 'approved',
        member_type: 'member',
      },
      { onConflict: 'discord_user_id' }
    )
    .select()
    .single();

  if (userError || !user) throw new Error('유저 정보 저장 실패');

  const { error: approveError } = await supabase
    .from('applications')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: adminName,
    })
    .eq('id', applicationId);

  if (approveError) throw new Error(`신청 상태 업데이트 실패: ${approveError.message}`);

  const { error: cleanupError } = await supabase
    .from('applications')
    .update({
      status: 'rejected',
      approved_by: adminName,
      admin_memo: '중복 신청 (승인된 다른 신청 존재)',
    })
    .eq('discord_user_id', app.discord_user_id)
    .eq('status', 'pending')
    .neq('id', applicationId);

  if (cleanupError) {
    console.warn('Duplicate pending cleanup failed:', cleanupError.message);
  }

  if (ouid) {
    const stats = await fetchMatchStats(ouid);
    if (stats) {
      const suspicion = calculateSuspicion(stats);
      await supabase.from('match_stats').upsert(
        {
          user_id: user.id,
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
    }
  }

  // 3. 웹훅 알림
  await adminWebhook.applicationApproved([
    { name: '닉네임', value: app.sudden_nickname, inline: true },
    { name: '나이', value: String(app.age), inline: true },
    { name: '포지션', value: app.position, inline: true },
    { name: '서버별명', value: botResult.serverNickname, inline: true },
    { name: '승인자', value: adminName, inline: true },
    { name: 'DM', value: botResult.dmSent ? '발송 완료' : '발송 실패 (DM 차단 가능)', inline: true },
    ...(botResult.warnings?.length
      ? [{ name: '주의', value: botResult.warnings.join(' / '), inline: false }]
      : []),
  ]);

  await adminWebhook.nicknameChanged([
    { name: '대상', value: app.sudden_nickname, inline: true },
    { name: '변경 별명', value: botResult.serverNickname, inline: true },
    { name: '처리자', value: adminName, inline: true },
  ]);

  await logActivity('관리자 승인', `${app.sudden_nickname} 승인`, user.id, adminName);
  await logActivity('서버 별명 변경', botResult.serverNickname, user.id, adminName);
  await logActivity('역할 지급', '미인증 해제 및 클랜원 역할 지급', user.id, adminName);

  return { ...botResult, applicationId, status: 'approved' as const };
}

export async function rejectApplication(
  applicationId: string,
  adminName: string,
  reason?: string
) {
  const { data: app } = await supabase
    .from('applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (!app) throw new Error('신청을 찾을 수 없습니다.');

  const rejectResult = await botReject({
    discordUserId: app.discord_user_id,
    suddenNickname: app.sudden_nickname,
    reason,
  });

  await supabase
    .from('applications')
    .update({ status: 'rejected', approved_by: adminName })
    .eq('id', applicationId);

  await supabase
    .from('users')
    .update({ status: 'rejected' })
    .eq('discord_user_id', app.discord_user_id);

  await adminWebhook.applicationRejected([
    { name: '닉네임', value: app.sudden_nickname, inline: true },
    { name: '처리자', value: adminName, inline: true },
    { name: '사유', value: reason ?? '미입력', inline: false },
    { name: 'DM', value: rejectResult.dmSent ? '발송 완료' : '발송 실패', inline: true },
  ]);

  await logActivity(
    '관리자 거절',
    `${app.sudden_nickname} 거절${reason ? ` - ${reason}` : ''}`,
    undefined,
    adminName
  );
}

export async function holdApplication(applicationId: string, adminName: string, memo?: string) {
  await supabase
    .from('applications')
    .update({ status: 'on_hold', admin_memo: memo ?? null, approved_by: adminName })
    .eq('id', applicationId);

  const { data: app } = await supabase
    .from('applications')
    .select('sudden_nickname')
    .eq('id', applicationId)
    .single();

  await adminWebhook.adminAction([
    { name: '액션', value: '신청 보류', inline: true },
    { name: '대상', value: app?.sudden_nickname ?? applicationId, inline: true },
    { name: '처리자', value: adminName, inline: true },
    { name: '메모', value: memo ?? '-', inline: false },
  ]);

  await logActivity(
    '신청 보류',
    `${app?.sudden_nickname ?? applicationId} 보류 처리`,
    undefined,
    adminName
  );
}

export async function blacklistApplication(
  applicationId: string,
  adminName: string,
  reason?: string
) {
  const { data: app } = await supabase
    .from('applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (!app) throw new Error('신청을 찾을 수 없습니다.');

  const now = new Date().toISOString();

  await supabase
    .from('applications')
    .update({ status: 'blocked', approved_by: adminName, admin_memo: reason ?? null })
    .eq('id', applicationId);

  await supabase.from('users').upsert(
    {
      discord_user_id: app.discord_user_id,
      discord_username: app.sudden_nickname,
      sudden_nickname: app.sudden_nickname,
      status: 'blocked',
      blacklist_reason: reason ?? '신청 블랙리스트',
      blacklisted_at: now,
      blacklisted_by: adminName,
    },
    { onConflict: 'discord_user_id' }
  );

  try {
    await botBan({
      discordUserId: app.discord_user_id,
      reason: reason ?? '신청 블랙리스트',
    });
  } catch (e) {
    console.error('Bot ban on application blacklist failed:', e);
  }

  await adminWebhook.blacklistRegistered([
    { name: '액션', value: '신청 블랙리스트', inline: true },
    { name: '대상', value: app.sudden_nickname, inline: true },
    { name: '처리자', value: adminName, inline: true },
    { name: '사유', value: reason ?? '-', inline: false },
  ]);

  await logActivity(
    '블랙리스트 등록',
    `${app.sudden_nickname} 블랙리스트${reason ? ` - ${reason}` : ''}`,
    undefined,
    adminName
  );
}
