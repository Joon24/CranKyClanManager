import {
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  type GuildMember,
} from 'discord.js';
import { config } from '../config.js';
import { renderWelcomeCard } from '../image/renderWelcomeCard.js';

export async function sendWelcomeMessage(member: GuildMember) {
  if (!config.welcomeChannelId) return;

  const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    console.warn(`Welcome channel not found: ${config.welcomeChannelId}`);
    return;
  }

  const imageBuffer = await renderWelcomeCard(member);
  const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });
  const displayName = member.displayName || member.user.username;

  const embed = new EmbedBuilder()
    .setColor(0x00ff88)
    .setDescription(`🎉 **${displayName}**님이 서버에 참여했습니다!`)
    .setImage('attachment://welcome.png')
    .setTimestamp();

  await channel.send({
    content: `${member}`,
    embeds: [embed],
    files: [attachment],
  });
}
