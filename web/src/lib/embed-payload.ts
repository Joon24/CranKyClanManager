import {
  IS_COMPONENTS_V2_FLAG,
  toDiscordComponents,
  validateComponents,
} from './embed-components';
import type { EmbedMessage } from './embed-types';
import { toDiscordEmbed } from './embed-types';

export function validateMessage(msg: EmbedMessage): string | null {
  const v2 = ((msg.flags ?? 0) & IS_COMPONENTS_V2_FLAG) !== 0;
  const discordEmbeds = v2 ? [] : msg.embeds.map(toDiscordEmbed).filter(Boolean);
  const discordComponents = msg.components.length ? toDiscordComponents(msg.components) : [];

  if (v2) {
    if (discordComponents.length === 0) {
      return 'Components V2 모드에서는 컴포넌트가 필요합니다.';
    }
  } else if (!msg.content.trim() && discordEmbeds.length === 0 && discordComponents.length === 0) {
    return '메시지 내용, 임베드, 또는 컴포넌트가 필요합니다.';
  }

  if (!v2 && msg.content.length > 2000) {
    return '메시지 내용은 2000자 이하여야 합니다.';
  }
  if (!v2 && msg.embeds.length > 10) {
    return '임베드는 최대 10개까지 추가할 수 있습니다.';
  }

  const componentError = validateComponents(msg.components, v2);
  if (componentError) return componentError;

  if (!v2) {
    for (let i = 0; i < msg.embeds.length; i++) {
      const e = msg.embeds[i];
      const converted = toDiscordEmbed(e);
      if (!converted) {
        return `임베드 ${i + 1}: 제목, 설명, 작성자, 푸터, 필드, 이미지 중 하나 이상이 필요합니다.`;
      }
      if (e.title && e.title.length > 256) return `임베드 ${i + 1}: 제목은 256자 이하여야 합니다.`;
      if (e.description && e.description.length > 4096) {
        return `임베드 ${i + 1}: 설명은 4096자 이하여야 합니다.`;
      }
      if (e.fields.length > 25) return `임베드 ${i + 1}: 필드는 최대 25개입니다.`;
      for (const f of e.fields) {
        if (f.name.length > 256) return `임베드 ${i + 1}: 필드 이름은 256자 이하여야 합니다.`;
        if (f.value.length > 1024) return `임베드 ${i + 1}: 필드 값은 1024자 이하여야 합니다.`;
      }
    }
  }
  return null;
}

export function toDiscordPayload(msg: EmbedMessage) {
  const v2 = ((msg.flags ?? 0) & IS_COMPONENTS_V2_FLAG) !== 0;
  const components = toDiscordComponents(msg.components);

  return {
    content: v2 ? undefined : msg.content.trim() || undefined,
    embeds: v2
      ? []
      : (msg.embeds.map(toDiscordEmbed).filter(Boolean) as Record<string, unknown>[]),
    components: components.length ? components : undefined,
    flags: msg.flags || undefined,
  };
}
