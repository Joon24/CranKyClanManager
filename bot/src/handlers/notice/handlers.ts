import {
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Client,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type TextChannel,
} from 'discord.js';
import { config } from '../../config.js';
import {
  NOTICE_ADD_SECTION_VALUE,
  NOTICE_EDIT_MODAL_PREFIX,
  NOTICE_EDIT_SELECT_PREFIX,
} from './content.js';
import { buildNoticeButtons, buildNoticeEmbeds, isNoticeAdmin, stripEmojiPrefix } from './builders.js';
import {
  addNoticeSection,
  getNoticeSections,
  getSectionByIndex,
  loadNoticeConfirms,
  saveNoticeConfirms,
  updateNoticeSection,
} from './storage.js';

async function findNoticeMessage(client: Client, messageId: string) {
  const guild = await client.guilds.fetch(config.guildId);
  for (const channel of guild.channels.cache.values()) {
    if (!channel?.isTextBased() || channel.isDMBased()) continue;
    try {
      const message = await channel.messages.fetch(messageId);
      if (message) return message;
    } catch {
      // continue search
    }
  }
  return null;
}

async function updateNoticeMessage(client: Client, messageId: string) {
  const message = await findNoticeMessage(client, messageId);
  if (!message) return null;

  await message.edit({
    embeds: buildNoticeEmbeds(),
    components: [buildNoticeButtons()],
  });
  return message;
}

export async function handleNoticeConfirm(interaction: ButtonInteraction) {
  const userId = interaction.user.id;
  const messageId = interaction.message.id;
  const confirms = loadNoticeConfirms();

  if (!confirms[messageId]) confirms[messageId] = [];
  if (confirms[messageId].includes(userId)) {
    await interaction.reply({
      content: 'ℹ️ 이미 확인 처리되었습니다.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  confirms[messageId].push(userId);
  saveNoticeConfirms(confirms);

  await interaction.reply({
    content: '✅ 공지사항 확인이 완료되었습니다. 감사합니다!',
    flags: MessageFlags.Ephemeral,
  });

  if (!config.adminLogChannelId || !interaction.guild) return;

  const logChannel = await interaction.guild.channels
    .fetch(config.adminLogChannelId)
    .catch(() => null);

  if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

  const logEmbed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('📋 공지사항 확인')
    .setDescription(
      `${interaction.user} (${interaction.user.tag})님이 공지사항을 확인했습니다.`
    )
    .addFields(
      {
        name: '👤 확인자',
        value: `${interaction.user} (\`${interaction.user.id}\`)`,
        inline: true,
      },
      {
        name: '📊 총 확인 인원',
        value: `${confirms[messageId].length}명`,
        inline: true,
      }
    )
    .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
    .setTimestamp();

  await (logChannel as TextChannel).send({ embeds: [logEmbed] });
  console.log(`Notice confirm: ${interaction.user.tag} (total ${confirms[messageId].length})`);
}

export async function handleNoticeEditButton(interaction: ButtonInteraction) {
  if (!interaction.member || !isNoticeAdmin(interaction.member)) {
    await interaction.reply({
      content: '❌ **관리자** 또는 **운영진**만 수정할 수 있습니다.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sections = getNoticeSections();
  const options = [
    ...sections.map((section, index) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(stripEmojiPrefix(section.title) || section.title)
        .setDescription(`섹션 ${index + 1}`)
        .setValue(String(index))
    ),
    new StringSelectMenuOptionBuilder()
      .setLabel('➕ 새 섹션 추가')
      .setDescription('공지사항에 새 섹션을 추가합니다')
      .setValue(NOTICE_ADD_SECTION_VALUE),
  ];

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${NOTICE_EDIT_SELECT_PREFIX}${interaction.message.id}`)
    .setPlaceholder('수정할 섹션을 선택하세요')
    .addOptions(options.slice(0, 25));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: '📝 수정할 공지사항 섹션을 선택하세요:',
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleNoticeEditSelect(interaction: StringSelectMenuInteraction) {
  if (!interaction.member || !isNoticeAdmin(interaction.member)) {
    await interaction.reply({
      content: '❌ **관리자** 또는 **운영진**만 수정할 수 있습니다.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const originalMessageId = interaction.customId.replace(NOTICE_EDIT_SELECT_PREFIX, '');

  if (interaction.values[0] === NOTICE_ADD_SECTION_VALUE) {
    const modal = new ModalBuilder()
      .setCustomId(`${NOTICE_EDIT_MODAL_PREFIX}${originalMessageId}_add`)
      .setTitle('새 섹션 추가');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('edit_title')
          .setLabel('제목')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(256)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('edit_description')
          .setLabel('내용')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(4000)
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
    return;
  }

  const sectionIndex = parseInt(interaction.values[0], 10);
  const section = getSectionByIndex(sectionIndex);
  if (!section) {
    await interaction.reply({
      content: '❌ 섹션을 찾을 수 없습니다.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${NOTICE_EDIT_MODAL_PREFIX}${originalMessageId}_${sectionIndex}`)
    .setTitle(`${stripEmojiPrefix(section.title) || '섹션'} 수정`);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('edit_title')
        .setLabel('제목')
        .setStyle(TextInputStyle.Short)
        .setValue(section.title)
        .setMaxLength(256)
        .setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('edit_description')
        .setLabel('내용')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(section.description)
        .setMaxLength(4000)
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

export async function handleNoticeEditModal(interaction: ModalSubmitInteraction) {
  if (!interaction.member || !isNoticeAdmin(interaction.member)) {
    await interaction.reply({
      content: '❌ **관리자** 또는 **운영진**만 수정할 수 있습니다.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const payload = interaction.customId.replace(NOTICE_EDIT_MODAL_PREFIX, '');
  const newTitle = interaction.fields.getTextInputValue('edit_title');
  const newDescription = interaction.fields.getTextInputValue('edit_description');

  if (payload.endsWith('_add')) {
    const originalMessageId = payload.replace(/_add$/, '');
    addNoticeSection(newTitle, newDescription);
    const updated = await updateNoticeMessage(interaction.client, originalMessageId);

    await interaction.reply({
      content: updated
        ? `✅ **${newTitle}** 섹션이 추가되었습니다!`
        : '⚠️ 섹션은 저장되었지만 원본 공지 메시지를 찾지 못했습니다. 봇 재시작 시 채널에 다시 게시됩니다.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const lastUnderscore = payload.lastIndexOf('_');
  const originalMessageId = payload.slice(0, lastUnderscore);
  const sectionIndex = parseInt(payload.slice(lastUnderscore + 1), 10);
  const section = getSectionByIndex(sectionIndex);

  if (!section) {
    await interaction.reply({
      content: '❌ 섹션을 찾을 수 없습니다.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  updateNoticeSection(section.key, newTitle, newDescription);
  const updated = await updateNoticeMessage(interaction.client, originalMessageId);

  await interaction.reply({
    content: updated
      ? `✅ **${newTitle}** 섹션이 수정되었습니다!`
      : '⚠️ 내용은 저장되었지만 원본 공지 메시지를 찾지 못했습니다. 봇 재시작 시 채널에 다시 게시됩니다.',
    flags: MessageFlags.Ephemeral,
  });
}

export {
  isNoticeConfirmButton,
  isNoticeEditButton,
  isNoticeEditSelect,
  isNoticeEditModal,
} from './ids.js';
