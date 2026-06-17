import {
  AttachmentBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { parseInput } from '../utils/parseBarrackUrl.js';
import * as suddenApi from '../api/suddenApi.js';
import { getSaUser, registerSaUser } from '../db/saUserStore.js';
import { renderProfile } from '../image/renderProfile.js';
import { renderMatch } from '../image/renderMatch.js';
import { renderStatusCard } from '../image/renderStatusCard.js';
import { config } from '../config.js';

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { data: unknown; ts: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

const DEFER_EPHEMERAL = new Set(['register', 'status']);

export async function executeSaCommand(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub !== 'help') {
    await interaction.deferReply({ ephemeral: DEFER_EPHEMERAL.has(sub) });
  }

  if (!config.nexonApiKey) {
    const msg = '❌ Nexon Open API 키가 설정되지 않았습니다. 관리자에게 문의하세요.';
    if (sub === 'help') {
      await interaction.reply({ content: msg, ephemeral: true });
    } else {
      await interaction.editReply(msg);
    }
    return;
  }

  switch (sub) {
    case 'help':
      await handleHelp(interaction);
      break;
    case 'register':
      await handleRegister(interaction);
      break;
    case 'profile':
      await handleProfile(interaction);
      break;
    case 'search':
      await handleSearch(interaction);
      break;
    case 'match':
      await handleMatch(interaction);
      break;
    case 'status':
      await handleStatus(interaction);
      break;
  }
}

async function handleHelp(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('🎮 Cranky 봇 — 서든어택 전적 조회')
    .setDescription('서든어택 닉네임으로 전적을 조회하고 이미지 카드로 확인하세요.')
    .addFields(
      {
        name: '📌 처음 사용한다면?',
        value:
          '`/sa register nickname:닉네임`\n' +
          '> 서든어택 닉네임을 입력해 계정을 연동하세요.\n' +
          '> 한번만 등록하면 이후 닉네임 입력 없이 사용 가능!',
      },
      { name: '\u200b', value: '**━━━━━━━━━ 명령어 목록 ━━━━━━━━━**' },
      {
        name: '📊 `/sa profile`',
        value: '> 내 전적 카드 보기\n> 계급 · 랭킹 · 승률 · K/D · 무기 사용률 · 랭크 티어',
        inline: true,
      },
      {
        name: '🔍 `/sa search`',
        value: '> `nickname:` 닉네임 **(필수)**\n> 다른 유저의 전적 카드 검색',
        inline: true,
      },
      { name: '\u200b', value: '\u200b' },
      {
        name: '⚔️ `/sa match`',
        value:
          '> 최근 매치 기록을 이미지로 조회\n' +
          '```\n/sa match\n/sa match nickname:닉네임\n/sa match mode:폭파미션 type:랭크전 솔로 count:20\n```',
      },
      {
        name: '⚔️ match 옵션',
        value:
          '> **nickname** — 닉네임 (미입력 시 내 계정)\n' +
          '> **mode** — 폭파미션 · 데스매치 · 개인전 · 진짜를 모아라\n' +
          '> **type** — 일반전 · 클랜전 · 랭크전 솔로/파티 · 토너먼트 등\n' +
          '> **count** — 조회 수 (1~30, 기본 20)',
      }
    )
    .setFooter({ text: 'Powered by Nexon Open API · Cranky Bot' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRegister(interaction: ChatInputCommandInteraction) {
  const input = interaction.options.getString('nickname', true);
  const parsed = parseInput(input);

  if (parsed && typeof parsed === 'object' && 'numericId' in parsed) {
    await interaction.editReply(
      '❌ 숫자 ID 형식의 병영 URL은 지원하지 않습니다.\n' +
        '닉네임을 직접 입력해주세요.\n' +
        '예: `/sa register nickname:닉네임`'
    );
    return;
  }

  if (!parsed || typeof parsed !== 'string') {
    await interaction.editReply(
      '❌ 올바른 닉네임 또는 병영 URL이 아닙니다.\n' +
        '예: `/sa register nickname:닉네임`\n' +
        '또는: `/sa register nickname:https://sa.nexon.com/profile/닉네임`'
    );
    return;
  }

  try {
    const ouid = await suddenApi.getOuid(parsed);
    await registerSaUser(interaction.user.id, parsed, ouid);
    await interaction.editReply(
      `✅ **${parsed}** 계정이 연동되었습니다!\n\`/sa profile\` 로 전적 카드를 확인하세요.`
    );
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 400) {
      await interaction.editReply('❌ 존재하지 않는 닉네임입니다.');
      return;
    }
    console.error('Register error:', err);
    await interaction.editReply('❌ API 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
}

async function handleProfile(interaction: ChatInputCommandInteraction) {
  const user = await getSaUser(interaction.user.id);
  if (!user) {
    await interaction.editReply('❌ 먼저 `/sa register` 로 계정을 연동해주세요.');
    return;
  }

  try {
    const cacheKey = `profile:${user.ouid}`;
    let profileData = getCached<Record<string, unknown>>(cacheKey);
    if (!profileData) {
      profileData = await suddenApi.getFullProfile(user.ouid);
      setCache(cacheKey, profileData);
    }

    const meta = suddenApi.getMetaCache();
    const imageBuffer = await renderProfile(profileData, meta);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'sudden_profile.png' });
    await interaction.editReply({ files: [attachment] });
  } catch (err) {
    console.error('Profile error:', err);
    await interaction.editReply('❌ 전적 조회 중 오류가 발생했습니다.');
  }
}

async function handleSearch(interaction: ChatInputCommandInteraction) {
  const nickname = interaction.options.getString('nickname', true);

  try {
    const ouid = await suddenApi.getOuid(nickname);
    const cacheKey = `profile:${ouid}`;
    let profileData = getCached<Record<string, unknown>>(cacheKey);
    if (!profileData) {
      profileData = await suddenApi.getFullProfile(ouid);
      setCache(cacheKey, profileData);
    }

    const meta = suddenApi.getMetaCache();
    const imageBuffer = await renderProfile(profileData, meta);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'sudden_profile.png' });
    await interaction.editReply({ files: [attachment] });
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 400) {
      await interaction.editReply('❌ 존재하지 않는 닉네임입니다.');
      return;
    }
    console.error('Search error:', err);
    await interaction.editReply('❌ 전적 조회 중 오류가 발생했습니다.');
  }
}

async function handleMatch(interaction: ChatInputCommandInteraction) {
  const nicknameOpt = interaction.options.getString('nickname');
  const matchMode = interaction.options.getString('mode') || '폭파미션';
  const matchType = interaction.options.getString('type') || undefined;
  const count = interaction.options.getInteger('count') || 20;

  let ouid: string;
  let userName: string;

  if (nicknameOpt) {
    try {
      ouid = await suddenApi.getOuid(nicknameOpt);
      userName = nicknameOpt;
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 400) {
        await interaction.editReply('❌ 존재하지 않는 닉네임입니다.');
        return;
      }
      console.error('Match ouid error:', err);
      await interaction.editReply('❌ API 오류가 발생했습니다.');
      return;
    }
  } else {
    const user = await getSaUser(interaction.user.id);
    if (!user) {
      await interaction.editReply(
        '❌ 먼저 `/sa register` 로 계정을 연동하거나 닉네임을 입력해주세요.'
      );
      return;
    }
    ouid = user.ouid;
    userName = user.nickname;
  }

  try {
    const cacheKey = `match:${ouid}:${matchMode}:${matchType || 'all'}:${count}`;
    let matches = getCached<Array<Record<string, unknown>>>(cacheKey);
    if (!matches) {
      matches = await suddenApi.getRecentMatches(ouid, matchMode, matchType, count);
      setCache(cacheKey, matches);
    }

    if (!matches || matches.length === 0) {
      await interaction.editReply(
        `❌ **${userName}** 님의 ${matchMode}${matchType ? ` (${matchType})` : ''} 매치 기록이 없습니다.`
      );
      return;
    }

    const imageBuffer = await renderMatch({
      userName,
      matches: matches as Parameters<typeof renderMatch>[0]['matches'],
      matchMode,
      matchType,
    });
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'sudden_match.png' });
    await interaction.editReply({ files: [attachment] });
  } catch (err) {
    console.error('Match error:', err);
    await interaction.editReply('❌ 매치 조회 중 오류가 발생했습니다.');
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  const channelId = config.statusReportChannelId;
  if (!channelId) {
    await interaction.editReply('❌ STATUS_REPORT_CHANNEL_ID가 설정되지 않았습니다.');
    return;
  }

  const guild = interaction.guild ?? interaction.client.guilds.cache.first();
  if (!guild) {
    await interaction.editReply('❌ 길드 정보를 가져올 수 없습니다.');
    return;
  }

  await guild.members.fetch({ withPresences: true }).catch(() => {});
  const botMembers = guild.members.cache.filter((member) => member.user.bot);
  const bots = botMembers.map((member) => {
    const status = member.presence?.status;
    const isOnline = status === 'online' || status === 'idle' || status === 'dnd';
    return {
      name: member.user.tag,
      label: status ? (isOnline ? '온라인' : '오프라인') : '확인 불가',
      note: isOnline ? '정상 작동 중' : status ? '서버 접속 중 아님' : '상태 정보 없음',
      dotColor: isOnline ? '#00ff88' : '#ff6b6b',
      statusColor: isOnline ? '#7efcff' : '#ff9c9c',
    };
  });

  const buffer = renderStatusCard(bots);
  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    await interaction.editReply(`❌ 공지사항 채널을 찾을 수 없습니다: ${channelId}`);
    return;
  }

  const attachment = new AttachmentBuilder(buffer, { name: 'bot-status.png' });
  await channel.send({
    content: '📊 오늘의 봇 및 서버 상태 보고입니다.',
    files: [attachment],
  });

  await interaction.editReply({
    content: `✅ 오늘 상태 보고를 공지사항 채널에 전송했습니다. <#${channelId}>`,
  });
}
