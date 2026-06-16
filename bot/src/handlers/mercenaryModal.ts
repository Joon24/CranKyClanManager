import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from 'discord.js';
import { MERCENARY_BUTTON_ID } from './setupAuthChannel.js';

const MODAL_ID = 'cranky_mercenary_modal';
export const MERCENARY_INVITER_SELECT_ID = 'cranky_mercenary_inviter_select';

export function isMercenaryButton(customId: string) {
  return customId === MERCENARY_BUTTON_ID;
}

export function isMercenaryInviterSelect(customId: string) {
  return customId === MERCENARY_INVITER_SELECT_ID;
}

export function buildMercenaryInviterSelectRow() {
  return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(MERCENARY_INVITER_SELECT_ID)
      .setPlaceholder('초대한 지인을 @멘션으로 선택하세요')
      .setMinValues(1)
      .setMaxValues(1)
  );
}

export function buildMercenaryModal(inviterDiscordId: string) {
  const modal = new ModalBuilder()
    .setCustomId(`${MODAL_ID}:${inviterDiscordId}`)
    .setTitle('CranKy 용병 신청');

  const nicknameInput = new TextInputBuilder()
    .setCustomId('sudden_nickname')
    .setLabel('서든어택 닉네임')
    .setPlaceholder('예: 랜딩')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20);

  const ageInput = new TextInputBuilder()
    .setCustomId('age')
    .setLabel('나이')
    .setPlaceholder('예: 30')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(2);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nicknameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(ageInput)
  );

  return modal;
}

export function isMercenaryModal(customId: string) {
  return customId.startsWith(`${MODAL_ID}:`);
}

export function parseMercenaryModalInviter(customId: string): string | null {
  if (!customId.startsWith(`${MODAL_ID}:`)) return null;
  const inviterId = customId.slice(MODAL_ID.length + 1);
  return inviterId || null;
}
