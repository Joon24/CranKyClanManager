import { ChannelType, type Client, type TextChannel } from 'discord.js';
import { buildNoticeButtons, buildNoticeEmbeds } from './builders.js';
import { NOTICE_CONFIRM_BUTTON_ID } from './content.js';

export function buildNoticeMessagePayload() {
  return {
    embeds: buildNoticeEmbeds(),
    components: [buildNoticeButtons()],
  };
}

export async function sendNoticeToChannel(channel: TextChannel) {
  return channel.send(buildNoticeMessagePayload());
}

function findExistingNoticeMessage(
  messages: Awaited<ReturnType<TextChannel['messages']['fetch']>>,
  botUserId: string | undefined
) {
  return messages.find((message) => {
    if (message.author.id !== botUserId) return false;
    return message.components.some((row) => {
      if (!('components' in row)) return false;
      return row.components.some(
        (component) => 'customId' in component && component.customId === NOTICE_CONFIRM_BUTTON_ID
      );
    });
  });
}

export async function syncNoticeChannel(client: Client, channelId: string) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error('공지사항 채널을 찾을 수 없습니다.');
  }

  const textChannel = channel as TextChannel;
  const messages = await textChannel.messages.fetch({ limit: 20 });
  const existing = findExistingNoticeMessage(messages, client.user?.id);
  const payload = buildNoticeMessagePayload();

  if (existing) {
    await existing.edit(payload);
    return { action: 'updated' as const, messageId: existing.id, channelId: textChannel.id };
  }

  const message = await textChannel.send(payload);
  return { action: 'posted' as const, messageId: message.id, channelId: textChannel.id };
}
