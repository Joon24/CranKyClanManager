import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const noticeCommandData = new SlashCommandBuilder()
  .setName('공지사항')
  .setDescription('📋 클랜 공지사항 안내문을 임베드로 게시합니다')
  .addChannelOption((option) =>
    option
      .setName('채널')
      .setDescription('공지사항을 게시할 채널 (미설정 시 공지 채널 또는 현재 채널)')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
