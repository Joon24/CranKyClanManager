import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { APPLY_BUTTON_ID } from './setupAuthChannel.js';

const MODAL_ID = 'cranky_apply_modal';

export function isApplyButton(customId: string) {
  return customId === APPLY_BUTTON_ID;
}

export function buildApplyModal() {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle('CranKy 클랜 가입 신청');

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

  const positionInput = new TextInputBuilder()
    .setCustomId('position')
    .setLabel('주 포지션 (S / R / M / T)')
    .setPlaceholder('S=스나, R=라플, M=멀티, T=특총')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(1);

  const mainTimeInput = new TextInputBuilder()
    .setCustomId('main_time')
    .setLabel('주 접속 시간')
    .setPlaceholder('예: 평일 저녁 8시~12시')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const extraInput = new TextInputBuilder()
    .setCustomId('extra_info')
    .setLabel('이전 클랜 / 가입 경로')
    .setPlaceholder('이전클랜: 없음 | 가입경로: 디스코드')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nicknameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(ageInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(positionInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(mainTimeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(extraInput)
  );

  return modal;
}

export function isApplyModal(customId: string) {
  return customId === MODAL_ID;
}

export { MODAL_ID };
