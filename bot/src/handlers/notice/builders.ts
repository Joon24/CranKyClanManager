import type { APIInteractionGuildMember, GuildMember, PermissionResolvable } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { config } from '../../config.js';
import {
  NOTICE_CONFIRM_BUTTON_ID,
  NOTICE_EDIT_BUTTON_ID,
  type NoticeSection,
} from './content.js';
import { getNoticeSections } from './storage.js';

export function isNoticeAdmin(member: GuildMember | APIInteractionGuildMember | null) {
  if (!member) return false;

  const permissions = member.permissions as PermissionResolvable;
  if (
    typeof permissions !== 'string' &&
    typeof permissions !== 'bigint' &&
    'has' in permissions &&
    permissions.has(PermissionFlagsBits.Administrator)
  ) {
    return true;
  }

  const roleIds =
    'cache' in member.roles ? [...member.roles.cache.keys()] : [...member.roles];

  if (config.staffRoleId && roleIds.includes(config.staffRoleId)) return true;
  return config.adminRoleIds.some((roleId) => roleIds.includes(roleId));
}

export function buildNoticeEmbeds(sections: NoticeSection[] = getNoticeSections()) {
  return sections.map((section, index) => {
    const embed = new EmbedBuilder()
      .setColor(section.color)
      .setTitle(section.title)
      .setDescription(section.description);
    if (index === 0) embed.setTimestamp();
    return embed;
  });
}

export function buildNoticeButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(NOTICE_CONFIRM_BUTTON_ID)
      .setLabel('확인합니다')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(NOTICE_EDIT_BUTTON_ID)
      .setLabel('수정')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Secondary)
  );
}

export function stripEmojiPrefix(label: string) {
  return label.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/gu, '').trim();
}
