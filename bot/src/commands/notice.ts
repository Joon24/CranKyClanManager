import {
  ChannelType,
  MessageFlags,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';
import { config } from '../config.js';
import { isNoticeAdmin } from '../handlers/notice/builders.js';
import { sendNoticeToChannel } from '../handlers/notice/postNotice.js';

export async function executeNoticeCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.member || !isNoticeAdmin(interaction.member)) {
    await interaction.reply({
      content: '❌ 이 명령어는 **관리자** 또는 **운영진**만 사용할 수 있습니다.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedChannel = interaction.options.getChannel('채널');
  let targetChannel: TextChannel | null = null;

  if (selectedChannel) {
    if (
      selectedChannel.type !== ChannelType.GuildText &&
      selectedChannel.type !== ChannelType.GuildAnnouncement
    ) {
      await interaction.reply({
        content: '❌ 텍스트 채널만 선택할 수 있습니다.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    targetChannel = selectedChannel as TextChannel;
  } else if (config.noticeChannelId) {
    const channel = await interaction.guild?.channels
      .fetch(config.noticeChannelId)
      .catch(() => null);
    if (channel?.isTextBased() && !channel.isDMBased()) {
      targetChannel = channel as TextChannel;
    }
  }

  if (!targetChannel && interaction.channel?.isTextBased() && !interaction.channel.isDMBased()) {
    targetChannel = interaction.channel as TextChannel;
  }

  if (!targetChannel) {
    await interaction.reply({
      content: '❌ 공지사항을 게시할 채널을 찾을 수 없습니다.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await sendNoticeToChannel(targetChannel);

  await interaction.reply({
    content: `✅ 공지사항이 ${targetChannel} 채널에 게시되었습니다!`,
    flags: MessageFlags.Ephemeral,
  });
}
