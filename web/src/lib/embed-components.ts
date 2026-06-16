import { nextId } from './embed-id';

export const IS_COMPONENTS_V2_FLAG = 1 << 15;

export type ButtonStyle = 1 | 2 | 3 | 4 | 5;

export interface ComponentEmoji {
  id?: string;
  name?: string;
  animated?: boolean;
}

export interface SelectMenuOption {
  id: number;
  label: string;
  description?: string;
  emoji?: ComponentEmoji | null;
  value?: string;
}

export interface MessageButton {
  id: number;
  type: 2;
  style: ButtonStyle;
  label: string;
  emoji?: ComponentEmoji | null;
  url?: string;
  disabled?: boolean;
  custom_id?: string;
}

export interface MessageSelectMenu {
  id: number;
  type: 3;
  placeholder?: string;
  disabled?: boolean;
  options: SelectMenuOption[];
  custom_id?: string;
}

export interface ActionRowComponent {
  id: number;
  type: 1;
  components: (MessageButton | MessageSelectMenu)[];
}

export interface TextDisplayComponent {
  id: number;
  type: 10;
  content: string;
}

export interface ThumbnailAccessory {
  id: number;
  type: 11;
  media: { url: string };
  description?: string;
  spoiler?: boolean;
}

export interface SectionComponent {
  id: number;
  type: 9;
  components: TextDisplayComponent[];
  accessory: ThumbnailAccessory | MessageButton;
}

export interface MediaGalleryItem {
  id: number;
  media: { url: string };
  description?: string;
  spoiler?: boolean;
}

export interface MediaGalleryComponent {
  id: number;
  type: 12;
  items: MediaGalleryItem[];
}

export interface FileComponent {
  id: number;
  type: 13;
  file: { url: string };
  spoiler?: boolean;
}

export interface SeparatorComponent {
  id: number;
  type: 14;
  divider?: boolean;
  spacing?: 1 | 2;
}

export type ContainerChild =
  | ActionRowComponent
  | TextDisplayComponent
  | SectionComponent
  | MediaGalleryComponent
  | SeparatorComponent
  | FileComponent;

export interface ContainerComponent {
  id: number;
  type: 17;
  components: ContainerChild[];
  accent_color?: number;
  spoiler?: boolean;
}

export type MessageComponent =
  | ActionRowComponent
  | TextDisplayComponent
  | SectionComponent
  | MediaGalleryComponent
  | FileComponent
  | SeparatorComponent
  | ContainerComponent;

export function isComponentsV2(flags?: number): boolean {
  return ((flags ?? 0) & IS_COMPONENTS_V2_FLAG) !== 0;
}

export function enableComponentsV2(flags?: number): number {
  return (flags ?? 0) | IS_COMPONENTS_V2_FLAG;
}

export function disableComponentsV2(flags?: number): number {
  return (flags ?? 0) & ~IS_COMPONENTS_V2_FLAG;
}

export function createActionRow(): ActionRowComponent {
  return { id: nextId(), type: 1, components: [] };
}

export function createSelectMenuRow(): ActionRowComponent {
  return {
    id: nextId(),
    type: 1,
    components: [{ id: nextId(), type: 3, options: [] }],
  };
}

export function createButton(style: ButtonStyle = 2): MessageButton {
  return { id: nextId(), type: 2, style, label: '' };
}

export function createTextDisplay(): TextDisplayComponent {
  return { id: nextId(), type: 10, content: '' };
}

export function createSection(): SectionComponent {
  return {
    id: nextId(),
    type: 9,
    components: [createTextDisplay()],
    accessory: { id: nextId(), type: 11, media: { url: '' } },
  };
}

export function createMediaGallery(): MediaGalleryComponent {
  return { id: nextId(), type: 12, items: [] };
}

export function createFileComponent(): FileComponent {
  return { id: nextId(), type: 13, file: { url: '' } };
}

export function createSeparator(): SeparatorComponent {
  return { id: nextId(), type: 14, divider: true, spacing: 1 };
}

export function createContainer(): ContainerComponent {
  return { id: nextId(), type: 17, components: [] };
}

function cleanEmoji(emoji?: ComponentEmoji | null): Record<string, unknown> | undefined {
  if (!emoji) return undefined;
  const out: Record<string, unknown> = {};
  if (emoji.id) out.id = emoji.id;
  if (emoji.name) out.name = emoji.name;
  if (emoji.animated) out.animated = true;
  return Object.keys(out).length ? out : undefined;
}

function toDiscordButton(btn: MessageButton): Record<string, unknown> | null {
  if (!btn.label?.trim() && !btn.emoji?.name && !btn.emoji?.id) return null;

  const base: Record<string, unknown> = {
    type: 2,
    style: btn.style,
    label: btn.label?.trim() || undefined,
    emoji: cleanEmoji(btn.emoji),
    disabled: btn.disabled || undefined,
  };

  if (btn.style === 5) {
    if (!btn.url?.trim()) return null;
    return { ...base, url: btn.url.trim() };
  }

  return {
    ...base,
    custom_id: btn.custom_id?.trim() || `cranky_btn_${btn.id}`,
  };
}

function toDiscordSelectOptions(options: SelectMenuOption[]) {
  return options
    .filter((o) => o.label.trim())
    .map((o) => ({
      label: o.label.trim(),
      value: o.value?.trim() || `opt_${o.id}`,
      description: o.description?.trim() || undefined,
      emoji: cleanEmoji(o.emoji),
    }));
}

function toDiscordSelectMenu(menu: MessageSelectMenu): Record<string, unknown> | null {
  const options = toDiscordSelectOptions(menu.options);
  if (options.length === 0) return null;
  return {
    type: 3,
    custom_id: menu.custom_id?.trim() || `cranky_select_${menu.id}`,
    placeholder: menu.placeholder?.trim() || undefined,
    disabled: menu.disabled || undefined,
    options,
  };
}

function toDiscordActionRow(row: ActionRowComponent): Record<string, unknown> | null {
  const components = row.components
    .map((c) => (c.type === 2 ? toDiscordButton(c) : toDiscordSelectMenu(c)))
    .filter(Boolean) as Record<string, unknown>[];
  if (!components.length) return null;
  return { type: 1, components };
}

function toDiscordTextDisplay(c: TextDisplayComponent): Record<string, unknown> | null {
  if (!c.content.trim()) return null;
  return { type: 10, content: c.content };
}

function toDiscordThumbnail(a: ThumbnailAccessory): Record<string, unknown> | null {
  if (!a.media.url.trim()) return null;
  return {
    type: 11,
    media: { url: a.media.url.trim() },
    description: a.description?.trim() || undefined,
    spoiler: a.spoiler || undefined,
  };
}

function toDiscordSectionAccessory(
  a: ThumbnailAccessory | MessageButton
): Record<string, unknown> | null {
  if (a.type === 11) return toDiscordThumbnail(a);
  return toDiscordButton(a);
}

function toDiscordSection(c: SectionComponent): Record<string, unknown> | null {
  const components = c.components.map(toDiscordTextDisplay).filter(Boolean);
  if (!components.length) return null;
  const accessory = toDiscordSectionAccessory(c.accessory);
  if (!accessory) return null;
  return { type: 9, components, accessory };
}

function toDiscordMediaGallery(c: MediaGalleryComponent): Record<string, unknown> | null {
  const items = c.items
    .filter((i) => i.media.url.trim())
    .map((i) => ({
      media: { url: i.media.url.trim() },
      description: i.description?.trim() || undefined,
      spoiler: i.spoiler || undefined,
    }));
  if (!items.length) return null;
  return { type: 12, items };
}

function toDiscordFile(c: FileComponent): Record<string, unknown> | null {
  const url = c.file.url.trim();
  if (!url) return null;
  return {
    type: 13,
    file: { url },
    spoiler: c.spoiler || undefined,
  };
}

function toDiscordSeparator(c: SeparatorComponent): Record<string, unknown> {
  return {
    type: 14,
    divider: c.divider ?? true,
    spacing: c.spacing ?? 1,
  };
}

function toDiscordContainerChild(c: ContainerChild): Record<string, unknown> | null {
  switch (c.type) {
    case 1:
      return toDiscordActionRow(c);
    case 10:
      return toDiscordTextDisplay(c);
    case 9:
      return toDiscordSection(c);
    case 12:
      return toDiscordMediaGallery(c);
    case 13:
      return toDiscordFile(c);
    case 14:
      return toDiscordSeparator(c);
    default:
      return null;
  }
}

function toDiscordContainer(c: ContainerComponent): Record<string, unknown> | null {
  const components = c.components.map(toDiscordContainerChild).filter(Boolean);
  if (!components.length) return null;
  return {
    type: 17,
    components,
    accent_color: c.accent_color,
    spoiler: c.spoiler || undefined,
  };
}

export function toDiscordComponents(components: MessageComponent[]): Record<string, unknown>[] {
  return components
    .map((c) => {
      switch (c.type) {
        case 1:
          return toDiscordActionRow(c);
        case 10:
          return toDiscordTextDisplay(c);
        case 9:
          return toDiscordSection(c);
        case 12:
          return toDiscordMediaGallery(c);
        case 13:
          return toDiscordFile(c);
        case 14:
          return toDiscordSeparator(c);
        case 17:
          return toDiscordContainer(c);
        default:
          return null;
      }
    })
    .filter(Boolean) as Record<string, unknown>[];
}

export function validateComponents(components: MessageComponent[], v2: boolean): string | null {
  if (components.length > 5) return '컴포넌트는 최대 5개까지 추가할 수 있습니다.';

  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    if (c.type === 1) {
      if (c.components.length === 0) return `컴포넌트 ${i + 1}: 버튼 또는 셀렉트 메뉴가 필요합니다.`;
      if (c.components.length > 5) return `컴포넌트 ${i + 1}: 액션 행은 최대 5개입니다.`;
      const hasSelect = c.components.some((x) => x.type === 3);
      const hasButton = c.components.some((x) => x.type === 2);
      if (hasSelect && hasButton) return `컴포넌트 ${i + 1}: 셀렉트 메뉴와 버튼을 함께 넣을 수 없습니다.`;
      if (hasSelect && c.components.length > 1) {
        return `컴포넌트 ${i + 1}: 셀렉트 메뉴 행에는 메뉴 1개만 가능합니다.`;
      }
      for (const child of c.components) {
        if (child.type === 2) {
          if (!child.label?.trim() && !child.emoji?.name && !child.emoji?.id) {
            return `컴포넌트 ${i + 1}: 버튼 라벨 또는 이모지가 필요합니다.`;
          }
          if (child.style === 5 && !child.url?.trim()) {
            return `컴포넌트 ${i + 1}: 링크 버튼 URL이 필요합니다.`;
          }
        } else if (child.options.length === 0) {
          return `컴포넌트 ${i + 1}: 셀렉트 메뉴 옵션이 필요합니다.`;
        }
      }
    } else if (!v2) {
      return `컴포넌트 ${i + 1}: Components V2가 꺼져 있으면 액션 행만 사용할 수 있습니다.`;
    } else if (c.type === 10 && !c.content.trim()) {
      return `컴포넌트 ${i + 1}: 텍스트 내용이 필요합니다.`;
    } else if (c.type === 9) {
      if (!c.components.some((t) => t.content.trim())) {
        return `컴포넌트 ${i + 1}: 섹션 텍스트가 필요합니다.`;
      }
    } else if (c.type === 12 && c.items.length === 0) {
      return `컴포넌트 ${i + 1}: 미디어 갤러리 항목이 필요합니다.`;
    } else if (c.type === 13 && !c.file.url.trim()) {
      return `컴포넌트 ${i + 1}: 파일 URL이 필요합니다 (attachment:// 형식).`;
    } else if (c.type === 17 && c.components.length === 0) {
      return `컴포넌트 ${i + 1}: 컨테이너 내부 컴포넌트가 필요합니다.`;
    }
  }
  return null;
}

const V2_TYPES = new Set([9, 10, 12, 13, 14, 17]);

export function hasV2Components(components: MessageComponent[]): boolean {
  return components.some((c) => V2_TYPES.has(c.type));
}
