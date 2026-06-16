import { ModalSubmitInteraction } from 'discord.js';
import { supabase, logActivity } from '../db/supabase.js';
import { webhook } from '../services/webhook.js';
import type { Position } from '../types/index.js';
import { isBlacklisted } from '../services/blacklist.js';

function parseExtraInfo(raw: string): { previousClan: string; joinSource: string } {
  const previousMatch = raw.match(/이전\s*클랜\s*[:：]\s*(.+?)(?:\||$)/i);
  const joinMatch = raw.match(/가입\s*경로\s*[:：]\s*(.+)/i);

  return {
    previousClan: previousMatch?.[1]?.trim() ?? raw.trim(),
    joinSource: joinMatch?.[1]?.trim() ?? '미입력',
  };
}

async function lookupOuid(nickname: string): Promise<string | null> {
  const apiKey = process.env.NEXON_OPEN_API_KEY;
  if (!apiKey) return null;

  try {
    const idRes = await fetch(
      `https://open.api.nexon.com/suddenattack/v1/id?user_name=${encodeURIComponent(nickname)}`,
      { headers: { 'x-nxopen-api-key': apiKey } }
    );
    if (!idRes.ok) return null;
    const idData = (await idRes.json()) as { ouid?: string };
    return idData.ouid ?? null;
  } catch {
    return null;
  }
}

export async function handleApplyModalSubmit(interaction: ModalSubmitInteraction) {
  const suddenNickname = interaction.fields.getTextInputValue('sudden_nickname').trim();
  const ageRaw = interaction.fields.getTextInputValue('age').trim();
  const positionRaw = interaction.fields.getTextInputValue('position').trim().toUpperCase();
  const mainTime = interaction.fields.getTextInputValue('main_time').trim();
  const extraRaw = interaction.fields.getTextInputValue('extra_info').trim();

  const age = parseInt(ageRaw, 10);
  const position = positionRaw as Position;

  if (!['S', 'R', 'M', 'T'].includes(position)) {
    await interaction.reply({
      content: '❌ 포지션은 S(스나), R(라플), M(멀티), T(특총) 중 하나만 입력해 주세요.',
      ephemeral: true,
    });
    return;
  }

  if (isNaN(age) || age < 10 || age > 99) {
    await interaction.reply({
      content: '❌ 나이를 올바르게 입력해 주세요.',
      ephemeral: true,
    });
    return;
  }

  if (await isBlacklisted(interaction.user.id)) {
    await interaction.reply({
      content: '❌ 블랙리스트에 등록된 계정입니다. 서버 재입장 및 가입 신청이 불가합니다.',
      ephemeral: true,
    });
    return;
  }

  const { previousClan, joinSource } = parseExtraInfo(extraRaw);

  const { data: existing } = await supabase
    .from('applications')
    .select('id, status')
    .eq('discord_user_id', interaction.user.id)
    .in('status', ['pending', 'on_hold'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await interaction.reply({
      content: '❌ 이미 검토 중인 가입 신청이 있습니다. 관리자 승인을 기다려 주세요.',
      ephemeral: true,
    });
    return;
  }

  const ouid = await lookupOuid(suddenNickname);
  const apiCheckStatus = ouid ? 'success' : process.env.NEXON_OPEN_API_KEY ? 'not_found' : 'pending';

  const { error } = await supabase.from('applications').insert({
    discord_user_id: interaction.user.id,
    sudden_nickname: suddenNickname,
    age,
    position,
    main_time: mainTime,
    previous_clan: previousClan,
    join_source: joinSource,
    api_check_status: apiCheckStatus,
    status: 'pending',
  });

  if (error) {
    console.error('Failed to save application:', error);
    if (error.code === '23505') {
      await interaction.reply({
        content: '❌ 이미 검토 중인 가입 신청이 있습니다. 관리자 승인을 기다려 주세요.',
        ephemeral: true,
      });
      return;
    }
    await interaction.reply({
      content: '❌ 신청 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      ephemeral: true,
    });
    return;
  }

  await supabase.from('users').upsert(
    {
      discord_user_id: interaction.user.id,
      discord_username: interaction.user.username,
      sudden_nickname: suddenNickname,
      ouid,
      age,
      position,
      status: 'pending',
      member_type: 'member',
    },
    { onConflict: 'discord_user_id' }
  );

  await logActivity(
    '가입 신청 제출',
    `${interaction.user.username} (${interaction.user.id}) - ${suddenNickname}${position}/${age}`,
    undefined,
    interaction.user.username
  );

  await webhook.applicationReceived([
    { name: '닉네임', value: suddenNickname, inline: true },
    { name: '나이', value: String(age), inline: true },
    { name: '포지션', value: position, inline: true },
    { name: '접속시간', value: mainTime, inline: true },
    { name: '이전 클랜', value: previousClan, inline: true },
    { name: '가입 경로', value: joinSource, inline: true },
    { name: 'Discord', value: `<@${interaction.user.id}>`, inline: false },
  ]);

  await interaction.reply({
    content: [
      '✅ **가입 신청이 접수되었습니다!**',
      '',
      `닉네임: ${suddenNickname}`,
      `나이: ${age}`,
      `포지션: ${position}`,
      `주 접속 시간: ${mainTime}`,
      '',
      '관리자 검토 후 DM으로 결과를 안내드립니다.',
    ].join('\n'),
    ephemeral: true,
  });
}
