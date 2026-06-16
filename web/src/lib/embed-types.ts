import type { MessageComponent } from './embed-components';
import { nextId } from './embed-id';

export { nextId } from './embed-id';

export interface EmbedField {
  id: number;
  name: string;
  value: string;
  inline?: boolean;
}

export interface MessageEmbed {
  id: number;
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: { text?: string; icon_url?: string };
  author?: { name?: string; url?: string; icon_url?: string };
  image?: { url?: string };
  thumbnail?: { url?: string };
  fields: EmbedField[];
}

export interface EmbedMessage {
  content: string;
  embeds: MessageEmbed[];
  components: MessageComponent[];
  flags?: number;
}

export function createEmptyEmbed(): MessageEmbed {
  return { id: nextId(), description: '', fields: [] };
}

export function createEmptyMessage(): EmbedMessage {
  return { content: '', embeds: [], components: [], flags: 0 };
}

export function colorIntToHex(color?: number): string {
  if (color === undefined) return '#1f2225';
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function hexToColorInt(hex: string): number | undefined {
  let raw = hex.trim();
  while (raw.startsWith('#')) raw = raw.slice(1);
  if (!raw) return undefined;
  const value = parseInt(raw, 16);
  return Number.isNaN(value) ? undefined : value;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return !!url.hostname.includes('.');
  } catch {
    return false;
  }
}

function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> | undefined {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as Partial<T>;
}

export function toDiscordEmbed(embed: MessageEmbed): Record<string, unknown> | null {
  const fields = embed.fields
    .filter((f) => f.name.trim() && f.value.trim())
    .map((f) => ({
      name: f.name.trim(),
      value: f.value.trim(),
      inline: !!f.inline,
    }));

  const author = embed.author?.name?.trim()
    ? stripEmpty({
        name: embed.author.name.trim(),
        url: embed.author.url?.trim() && isValidUrl(embed.author.url) ? embed.author.url.trim() : undefined,
        icon_url:
          embed.author.icon_url?.trim() && isValidUrl(embed.author.icon_url)
            ? embed.author.icon_url.trim()
            : undefined,
      })
    : undefined;

  const footer = embed.footer?.text?.trim()
    ? stripEmpty({
        text: embed.footer.text.trim(),
        icon_url:
          embed.footer.icon_url?.trim() && isValidUrl(embed.footer.icon_url)
            ? embed.footer.icon_url.trim()
            : undefined,
      })
    : undefined;

  const image =
    embed.image?.url?.trim() && isValidUrl(embed.image.url)
      ? { url: embed.image.url.trim() }
      : undefined;

  const thumbnail =
    embed.thumbnail?.url?.trim() && isValidUrl(embed.thumbnail.url)
      ? { url: embed.thumbnail.url.trim() }
      : undefined;

  const payload = stripEmpty({
    title: embed.title?.trim() || undefined,
    description: embed.description?.trim() || undefined,
    url: embed.url?.trim() && isValidUrl(embed.url) ? embed.url.trim() : undefined,
    color: embed.color,
    timestamp: embed.timestamp || undefined,
    author,
    footer,
    image,
    thumbnail,
    fields: fields.length ? fields : undefined,
  });

  if (!payload) return null;
  return payload;
}
