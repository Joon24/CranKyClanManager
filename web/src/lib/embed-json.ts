import { nextId } from './embed-id';
import type { EmbedField, MessageEmbed } from './embed-types';
import {
  type ActionRowComponent,
  type ContainerChild,
  type ContainerComponent,
  type FileComponent,
  type MediaGalleryComponent,
  type MediaGalleryItem,
  type MessageButton,
  type MessageComponent,
  type MessageSelectMenu,
  type SectionComponent,
  type SelectMenuOption,
  type SeparatorComponent,
  type TextDisplayComponent,
  type ThumbnailAccessory,
  IS_COMPONENTS_V2_FLAG,
} from './embed-components';
import { toDiscordPayload } from './embed-payload';
import type { EmbedMessage } from './embed-types';

function ensureId(value?: number): number {
  return typeof value === 'number' ? value : nextId();
}

function parseButton(raw: Record<string, unknown>): MessageButton {
  return {
    id: ensureId(raw.id as number | undefined),
    type: 2,
    style: (raw.style as MessageButton['style']) ?? 2,
    label: String(raw.label ?? ''),
    emoji: (raw.emoji as MessageButton['emoji']) ?? null,
    url: raw.url ? String(raw.url) : undefined,
    disabled: !!raw.disabled,
    custom_id: raw.custom_id ? String(raw.custom_id) : undefined,
  };
}

function parseSelectOption(raw: Record<string, unknown>): SelectMenuOption {
  return {
    id: ensureId(raw.id as number | undefined),
    label: String(raw.label ?? ''),
    description: raw.description ? String(raw.description) : undefined,
    emoji: (raw.emoji as SelectMenuOption['emoji']) ?? null,
    value: raw.value ? String(raw.value) : undefined,
  };
}

function parseSelectMenu(raw: Record<string, unknown>): MessageSelectMenu {
  const options = Array.isArray(raw.options)
    ? raw.options.map((o) => parseSelectOption(o as Record<string, unknown>))
    : [];
  return {
    id: ensureId(raw.id as number | undefined),
    type: 3,
    placeholder: raw.placeholder ? String(raw.placeholder) : undefined,
    disabled: !!raw.disabled,
    options,
    custom_id: raw.custom_id ? String(raw.custom_id) : undefined,
  };
}

function parseActionRow(raw: Record<string, unknown>): ActionRowComponent {
  const children = Array.isArray(raw.components)
    ? raw.components.map((c) => {
        const comp = c as Record<string, unknown>;
        return comp.type === 3 ? parseSelectMenu(comp) : parseButton(comp);
      })
    : [];
  return { id: ensureId(raw.id as number | undefined), type: 1, components: children };
}

function parseTextDisplay(raw: Record<string, unknown>): TextDisplayComponent {
  return {
    id: ensureId(raw.id as number | undefined),
    type: 10,
    content: String(raw.content ?? ''),
  };
}

function parseThumbnail(raw: Record<string, unknown>): ThumbnailAccessory {
  const media = (raw.media as { url?: string }) ?? {};
  return {
    id: ensureId(raw.id as number | undefined),
    type: 11,
    media: { url: String(media.url ?? '') },
    description: raw.description ? String(raw.description) : undefined,
    spoiler: !!raw.spoiler,
  };
}

function parseSection(raw: Record<string, unknown>): SectionComponent {
  const components = Array.isArray(raw.components)
    ? raw.components.map((c) => parseTextDisplay(c as Record<string, unknown>))
    : [parseTextDisplay({})];
  const acc = raw.accessory as Record<string, unknown> | undefined;
  const accessory =
    acc?.type === 2 ? parseButton(acc) : parseThumbnail(acc ?? { media: { url: '' } });
  return {
    id: ensureId(raw.id as number | undefined),
    type: 9,
    components,
    accessory,
  };
}

function parseMediaItem(raw: Record<string, unknown>): MediaGalleryItem {
  const media = (raw.media as { url?: string }) ?? {};
  return {
    id: ensureId(raw.id as number | undefined),
    media: { url: String(media.url ?? '') },
    description: raw.description ? String(raw.description) : undefined,
    spoiler: !!raw.spoiler,
  };
}

function parseMediaGallery(raw: Record<string, unknown>): MediaGalleryComponent {
  const items = Array.isArray(raw.items)
    ? raw.items.map((i) => parseMediaItem(i as Record<string, unknown>))
    : [];
  return { id: ensureId(raw.id as number | undefined), type: 12, items };
}

function parseFile(raw: Record<string, unknown>): FileComponent {
  const file = (raw.file as { url?: string }) ?? {};
  return {
    id: ensureId(raw.id as number | undefined),
    type: 13,
    file: { url: String(file.url ?? '') },
    spoiler: !!raw.spoiler,
  };
}

function parseSeparator(raw: Record<string, unknown>): SeparatorComponent {
  return {
    id: ensureId(raw.id as number | undefined),
    type: 14,
    divider: raw.divider !== false,
    spacing: (raw.spacing as 1 | 2) ?? 1,
  };
}

function parseContainerChild(raw: Record<string, unknown>): ContainerChild | null {
  switch (raw.type) {
    case 1:
      return parseActionRow(raw);
    case 10:
      return parseTextDisplay(raw);
    case 9:
      return parseSection(raw);
    case 12:
      return parseMediaGallery(raw);
    case 13:
      return parseFile(raw);
    case 14:
      return parseSeparator(raw);
    default:
      return null;
  }
}

function parseContainer(raw: Record<string, unknown>): ContainerComponent {
  const components = Array.isArray(raw.components)
    ? (raw.components
        .map((c) => parseContainerChild(c as Record<string, unknown>))
        .filter(Boolean) as ContainerChild[])
    : [];
  return {
    id: ensureId(raw.id as number | undefined),
    type: 17,
    components,
    accent_color: typeof raw.accent_color === 'number' ? raw.accent_color : undefined,
    spoiler: !!raw.spoiler,
  };
}

function parseComponent(raw: Record<string, unknown>): MessageComponent | null {
  switch (raw.type) {
    case 1:
      return parseActionRow(raw);
    case 10:
      return parseTextDisplay(raw);
    case 9:
      return parseSection(raw);
    case 12:
      return parseMediaGallery(raw);
    case 13:
      return parseFile(raw);
    case 14:
      return parseSeparator(raw);
    case 17:
      return parseContainer(raw);
    default:
      return null;
  }
}

function parseEmbedField(raw: Record<string, unknown>): EmbedField {
  return {
    id: ensureId(raw.id as number | undefined),
    name: String(raw.name ?? ''),
    value: String(raw.value ?? ''),
    inline: !!raw.inline,
  };
}

function parseEmbed(raw: Record<string, unknown>): MessageEmbed {
  const fields = Array.isArray(raw.fields)
    ? raw.fields.map((f) => parseEmbedField(f as Record<string, unknown>))
    : [];
  return {
    id: ensureId(raw.id as number | undefined),
    title: raw.title ? String(raw.title) : undefined,
    description: raw.description ? String(raw.description) : undefined,
    url: raw.url ? String(raw.url) : undefined,
    color: typeof raw.color === 'number' ? raw.color : undefined,
    timestamp: raw.timestamp ? String(raw.timestamp) : undefined,
    footer: raw.footer as MessageEmbed['footer'],
    author: raw.author as MessageEmbed['author'],
    image: raw.image as MessageEmbed['image'],
    thumbnail: raw.thumbnail as MessageEmbed['thumbnail'],
    fields,
  };
}

export function parseMessageFromJson(raw: unknown): EmbedMessage {
  if (!raw || typeof raw !== 'object') {
    throw new Error('유효한 JSON 객체가 아닙니다.');
  }
  const data = raw as Record<string, unknown>;
  const embeds = Array.isArray(data.embeds)
    ? data.embeds.map((e) => parseEmbed(e as Record<string, unknown>))
    : [];
  const components = Array.isArray(data.components)
    ? (data.components
        .map((c) => parseComponent(c as Record<string, unknown>))
        .filter(Boolean) as MessageComponent[])
    : [];

  let flags = typeof data.flags === 'number' ? data.flags : 0;
  if (components.some((c) => [9, 10, 12, 13, 14, 17].includes(c.type))) {
    flags |= IS_COMPONENTS_V2_FLAG;
  }

  return {
    content: String(data.content ?? ''),
    embeds,
    components,
    flags,
  };
}

export function messageToExportJson(message: EmbedMessage): string {
  return JSON.stringify(message, null, 2);
}

export function messageToDiscordJson(message: EmbedMessage): string {
  return JSON.stringify(toDiscordPayload(message), null, 2);
}
