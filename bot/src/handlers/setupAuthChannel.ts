import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { config } from '../config.js';

const APPLY_BUTTON_ID = 'cranky_apply_button';
const MERCENARY_BUTTON_ID = 'cranky_mercenary_button';

function buildAuthEmbed() {
  return new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle('🎮 CranKy 클랜 가입 신청')
    .setDescription(
      [
        'CranKy 클랜에 오신 것을 환영합니다!',
        '',
        '**📝 신청하기** — 정규 가입 신청 (관리자 승인 필요)',
        '**⚔️ 용병 신청** — 즉시 자동 승인 (별명·역할 자동 지급)',
        '• 초대한 지인을 @멘션으로 선택',
        '• 서버 별명은 `지인닉인맥` 형식 (예: 랜딩 → 랜딩인맥)',
        '',
        '**정규 신청 시 필요한 정보**',
        '• 서든어택 닉네임',
        '• 나이',
        '• 주 포지션 (S / R / M / T)',
        '• 주 접속 시간',
        '• 이전 클랜 여부',
        '• 가입 경로',
      ].join('\n')
    )
    .setFooter({ text: 'CranKy Clan Manager' });
}

function buildAuthButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(APPLY_BUTTON_ID)
      .setLabel('신청하기')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📝'),
    new ButtonBuilder()
      .setCustomId(MERCENARY_BUTTON_ID)
      .setLabel('용병 신청')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚔️')
  );
}

export async function setupAuthChannel(client: Client) {
  const channel = await client.channels.fetch(config.authChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    console.error('Auth channel not found or not a text channel');
    return;
  }

  const textChannel = channel as TextChannel;
  const messages = await textChannel.messages.fetch({ limit: 10 });
  const existing = messages.find(
    (m) => m.author.id === client.user?.id && m.components.length > 0
  );

  const embed = buildAuthEmbed();
  const row = buildAuthButtons();

  if (existing) {
    const hasMercenary = existing.components.some((row) =>
      'components' in row &&
      row.components.some(
        (c) => 'customId' in c && c.customId === MERCENARY_BUTTON_ID
      )
    );
    if (!hasMercenary) {
      await existing.edit({ embeds: [embed], components: [row] });
      console.log('Auth channel message updated with mercenary button');
    } else {
      console.log('Auth channel message already exists');
    }
    return;
  }

  await textChannel.send({ embeds: [embed], components: [row] });
  console.log('Auth channel message posted');
}

export { APPLY_BUTTON_ID, MERCENARY_BUTTON_ID };
