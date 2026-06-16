import { ChannelType, MessageFlags, type APIEmbed, type Client } from 'discord.js';
import { config } from '../config.js';

export interface GuildChannelInfo {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  parentName: string | null;
  position: number;
}

export async function getGuildChannels(client: Client): Promise<GuildChannelInfo[]> {
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();

  const categoryNames = new Map<string, string>();
  for (const ch of channels.values()) {
    if (ch?.type === ChannelType.GuildCategory) {
      categoryNames.set(ch.id, ch.name);
    }
  }

  return [...channels.values()]
    .filter(
      (ch) =>
        ch &&
        (ch.type === ChannelType.GuildText ||
          ch.type === ChannelType.GuildAnnouncement ||
          ch.type === ChannelType.GuildForum)
    )
    .map((ch) => ({
      id: ch!.id,
      name: ch!.name,
      type: ch!.type,
      parentId: ch!.parentId,
      parentName: ch!.parentId ? (categoryNames.get(ch!.parentId) ?? null) : null,
      position: ch!.position ?? 0,
    }))
    .sort((a, b) => {
      const catA = a.parentName ?? '';
      const catB = b.parentName ?? '';
      if (catA !== catB) return catA.localeCompare(catB, 'ko');
      return a.position - b.position;
    });
}

export interface SendEmbedPayload {
  channelId: string;
  content?: string;
  embeds: APIEmbed[];
  components?: Record<string, unknown>[];
  flags?: number;
}

export async function sendEmbedMessage(client: Client, payload: SendEmbedPayload) {
  const channel = await client.channels.fetch(payload.channelId);
  if (!channel?.isTextBased() || channel.isDMBased()) {
    throw new Error('텍스트 채널을 찾을 수 없습니다.');
  }

  const v2 = (payload.flags ?? 0) & MessageFlags.IsComponentsV2;
  const hasEmbeds = payload.embeds.length > 0;
  const hasContent = !!payload.content?.trim();
  const hasComponents = (payload.components?.length ?? 0) > 0;

  if (!v2 && !hasContent && !hasEmbeds && !hasComponents) {
    throw new Error('메시지 내용, 임베드, 또는 컴포넌트가 필요합니다.');
  }
  if (v2 && !hasComponents) {
    throw new Error('Components V2 모드에서는 컴포넌트가 필요합니다.');
  }

  const message = await channel.send({
    content: payload.content?.trim() || undefined,
    embeds: payload.embeds,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    components: (payload.components ?? []) as any,
    flags: v2 ? MessageFlags.IsComponentsV2 : undefined,
  });

  return { messageId: message.id, channelId: message.channel.id };
}
