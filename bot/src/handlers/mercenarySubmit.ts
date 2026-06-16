import {
  ButtonInteraction,
  ModalSubmitInteraction,
  UserSelectMenuInteraction,
} from 'discord.js';
import { supabase, logActivity } from '../db/supabase.js';
import { webhook } from '../services/webhook.js';
import { approveMember } from '../services/discord-actions.js';
import { config } from '../config.js';
import { isBlacklisted } from '../services/blacklist.js';
import {
  buildMercenaryInviterSelectRow,
  buildMercenaryModal,
  parseMercenaryModalInviter,
} from './mercenaryModal.js';
import {
  buildMercenaryServerNickname,
  extractNicknameBase,
  normalizeSuddenNicknameForServer,
  type Position,
} from '../types/index.js';

const DEFAULT_MERCENARY_POSITION: Position = 'M';

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

async function resolveInviterNickname(
  guildId: string,
  client: ModalSubmitInteraction['client'],
  inviterDiscordId: string
): Promise<string | null> {
  const { data: inviterUser } = await supabase
    .from('users')
    .select('sudden_nickname, server_nickname')
    .eq('discord_user_id', inviterDiscordId)
    .maybeSingle();

  if (inviterUser?.sudden_nickname) {
    return normalizeSuddenNicknameForServer(inviterUser.sudden_nickname);
  }

  if (inviterUser?.server_nickname) {
    const base = extractNicknameBase(inviterUser.server_nickname);
    if (base) return base;
  }

  const guild = await client.guilds.fetch(guildId);
  const inviterMember = await guild.members.fetch(inviterDiscordId).catch(() => null);
  if (!inviterMember) return null;

  if (inviterMember.nickname) {
    const base = extractNicknameBase(inviterMember.nickname);
    if (base) return base;
  }

  return inviterMember.displayName;
}

async function validateMercenaryApplicant(userId: string) {
  if (await isBlacklisted(userId)) {
    return '❌ 블랙리스트에 등록된 계정입니다. 용병 신청이 불가합니다.';
  }

  const { data: existingUser } = await supabase
    .from('users')
    .select('status')
    .eq('discord_user_id', userId)
    .maybeSingle();

  if (existingUser?.status === 'approved') {
    return '❌ 이미 승인된 클랜원입니다.';
  }

  const { data: pendingApp } = await supabase
    .from('applications')
    .select('id')
    .eq('discord_user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (pendingApp) {
    return '❌ 검토 중인 가입 신청이 있습니다. 용병 신청 전 기존 신청을 처리해 주세요.';
  }

  return null;
}

export async function handleMercenaryButton(interaction: ButtonInteraction) {
  const validationError = await validateMercenaryApplicant(interaction.user.id);
  if (validationError) {
    await interaction.reply({ content: validationError, ephemeral: true });
    return;
  }

  await interaction.reply({
    content: [
      '⚔️ **용병 신청**',
      '',
      '1. 아래에서 **초대한 지인**을 @멘션으로 선택하세요.',
      '2. 서든 닉네임과 나이를 입력하면 자동 승인됩니다.',
      '3. 서버 별명은 `지인닉인맥` 형식으로 설정됩니다. (예: 랜딩 → 랜딩인맥)',
    ].join('\n'),
    components: [buildMercenaryInviterSelectRow()],
    ephemeral: true,
  });
}

export async function handleMercenaryInviterSelect(interaction: UserSelectMenuInteraction) {
  const inviterDiscordId = interaction.values[0];

  if (inviterDiscordId === interaction.user.id) {
    await interaction.reply({
      content: '❌ 본인을 초대자로 지정할 수 없습니다. 다른 지인을 선택해 주세요.',
      ephemeral: true,
    });
    return;
  }

  const validationError = await validateMercenaryApplicant(interaction.user.id);
  if (validationError) {
    await interaction.reply({ content: validationError, ephemeral: true });
    return;
  }

  const guild = interaction.guild ?? (await interaction.client.guilds.fetch(config.guildId));
  const inviterMember = await guild.members.fetch(inviterDiscordId).catch(() => null);
  if (!inviterMember) {
    await interaction.reply({
      content: '❌ 선택한 지인을 서버에서 찾을 수 없습니다.',
      ephemeral: true,
    });
    return;
  }

  await interaction.showModal(buildMercenaryModal(inviterDiscordId));
}

export async function handleMercenaryModalSubmit(interaction: ModalSubmitInteraction) {
  const inviterDiscordId = parseMercenaryModalInviter(interaction.customId);
  if (!inviterDiscordId) {
    await interaction.reply({
      content: '❌ 초대자 정보가 없습니다. 용병 신청을 처음부터 다시 시도해 주세요.',
      ephemeral: true,
    });
    return;
  }

  const suddenNickname = interaction.fields.getTextInputValue('sudden_nickname').trim();
  const ageRaw = interaction.fields.getTextInputValue('age').trim();
  const age = parseInt(ageRaw, 10);
  const position = DEFAULT_MERCENARY_POSITION;

  if (isNaN(age) || age < 10 || age > 99) {
    await interaction.reply({
      content: '❌ 나이를 올바르게 입력해 주세요.',
      ephemeral: true,
    });
    return;
  }

  const validationError = await validateMercenaryApplicant(interaction.user.id);
  if (validationError) {
    await interaction.reply({ content: validationError, ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const inviterNickname = await resolveInviterNickname(
    config.guildId,
    interaction.client,
    inviterDiscordId
  );
  if (!inviterNickname) {
    await interaction.editReply({
      content: '❌ 초대한 지인 정보를 불러올 수 없습니다. 다시 시도해 주세요.',
    });
    return;
  }

  const mercenaryServerNickname = buildMercenaryServerNickname(inviterNickname);
  const mercenaryRoleId = config.mercenaryRoleId || config.memberRoleId;

  try {
    const result = await approveMember(
      interaction.client,
      interaction.user.id,
      suddenNickname,
      position,
      age,
      {
        roleId: mercenaryRoleId,
        joinType: 'mercenary',
        serverNicknameOverride: mercenaryServerNickname,
      }
    );

    const ouid = await lookupOuid(suddenNickname);

    await supabase.from('applications').insert({
      discord_user_id: interaction.user.id,
      sudden_nickname: suddenNickname,
      age,
      position,
      main_time: '용병',
      previous_clan: null,
      join_source: `용병 신청 (초대: ${inviterNickname})`,
      api_check_status: ouid ? 'success' : process.env.NEXON_OPEN_API_KEY ? 'not_found' : 'pending',
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: '자동 (용병)',
    });

    await supabase.from('users').upsert(
      {
        discord_user_id: interaction.user.id,
        discord_username: interaction.user.username,
        sudden_nickname: suddenNickname,
        ouid,
        age,
        position,
        server_nickname: result.serverNickname,
        role: mercenaryRoleId,
        status: 'approved',
        member_type: 'mercenary',
      },
      { onConflict: 'discord_user_id' }
    );

    await logActivity(
      '용병 자동 승인',
      `${suddenNickname} (${age}) - 초대: ${inviterNickname} (${inviterDiscordId}) - ${interaction.user.id}`,
      undefined,
      'Discord Bot'
    );

    await webhook.mercenaryAutoApproved([
      { name: '닉네임', value: suddenNickname, inline: true },
      { name: '나이', value: String(age), inline: true },
      { name: '서버별명', value: mercenaryServerNickname, inline: true },
      { name: '초대자', value: `<@${inviterDiscordId}> (${inviterNickname})`, inline: true },
      { name: 'DM', value: result.dmSent ? '발송 완료' : '발송 실패 (DM 차단 가능)', inline: true },
      { name: 'Discord', value: `<@${interaction.user.id}>`, inline: false },
      ...(result.warnings?.length
        ? [{ name: '주의', value: result.warnings.join(' / '), inline: false }]
        : []),
    ]);

    await interaction.editReply({
      content: [
        '⚔️ **용병 신청이 자동 승인되었습니다!**',
        '',
        `닉네임: ${suddenNickname}`,
        `초대자: <@${inviterDiscordId}> (${inviterNickname})`,
        `서버 별명: ${mercenaryServerNickname}`,
        result.dmSent ? 'DM으로 안내를 발송했습니다.' : 'DM 발송에 실패했습니다. (DM 차단 여부 확인)',
      ].join('\n'),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '용병 신청 처리 중 오류가 발생했습니다.';
    await interaction.editReply({ content: `❌ ${message}` });
  }
}
