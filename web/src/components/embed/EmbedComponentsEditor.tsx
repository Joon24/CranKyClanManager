'use client';

import { useState } from 'react';
import type { EmbedMessage } from '@/lib/embed-types';
import { nextId } from '@/lib/embed-id';
import {
  type ActionRowComponent,
  type ButtonStyle,
  type ContainerComponent,
  type FileComponent,
  type MediaGalleryComponent,
  type MessageButton,
  type MessageComponent,
  type MessageSelectMenu,
  type SectionComponent,
  type SelectMenuOption,
  type SeparatorComponent,
  type TextDisplayComponent,
  createActionRow,
  createButton,
  createContainer,
  createFileComponent,
  createMediaGallery,
  createSection,
  createSelectMenuRow,
  createSeparator,
  createTextDisplay,
  isComponentsV2,
} from '@/lib/embed-components';

const BUTTON_STYLES: { value: ButtonStyle; label: string }[] = [
  { value: 1, label: 'Blurple' },
  { value: 2, label: 'Grey' },
  { value: 3, label: 'Green' },
  { value: 4, label: 'Red' },
  { value: 5, label: '링크' },
];

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function ButtonEditor({
  button,
  onChange,
  onRemove,
}: {
  button: MessageButton;
  onChange: (p: Partial<MessageButton>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="embed-card" style={{ borderLeftColor: '#5865f2' }}>
      <div className="embed-card-header">
        <span className="embed-card-title">버튼</span>
        <button type="button" className="embed-icon-btn" onClick={onRemove}>삭제</button>
      </div>
      <div className="embed-field-row">
        <div className="embed-field-group">
          <label>스타일</label>
          <select
            value={button.style}
            onChange={(e) => onChange({ style: Number(e.target.value) as ButtonStyle })}
          >
            {BUTTON_STYLES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <label className="embed-inline-check" style={{ marginTop: 28 }}>
          <input
            type="checkbox"
            checked={!!button.disabled}
            onChange={(e) => onChange({ disabled: e.target.checked })}
          />
          비활성화
        </label>
      </div>
      <div className="embed-field-group">
        <label>라벨</label>
        <input value={button.label} maxLength={80} onChange={(e) => onChange({ label: e.target.value })} />
      </div>
      <div className="embed-field-group">
        <label>이모지 (이름)</label>
        <input
          value={button.emoji?.name ?? ''}
          placeholder="예: ✅"
          onChange={(e) => onChange({ emoji: e.target.value ? { name: e.target.value } : null })}
        />
      </div>
      {button.style === 5 ? (
        <div className="embed-field-group">
          <label>URL</label>
          <input value={button.url ?? ''} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://" />
        </div>
      ) : (
        <div className="embed-field-group">
          <label>Custom ID (선택)</label>
          <input
            value={button.custom_id ?? ''}
            maxLength={100}
            onChange={(e) => onChange({ custom_id: e.target.value || undefined })}
            placeholder={`자동: cranky_btn_${button.id}`}
          />
        </div>
      )}
    </div>
  );
}

function SelectOptionEditor({
  option,
  onChange,
  onRemove,
}: {
  option: SelectMenuOption;
  onChange: (p: Partial<SelectMenuOption>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="embed-card" style={{ borderLeftColor: '#8b5cf6' }}>
      <div className="embed-card-header">
        <span className="embed-card-title">옵션</span>
        <button type="button" className="embed-icon-btn" onClick={onRemove}>삭제</button>
      </div>
      <div className="embed-field-group">
        <label>라벨</label>
        <input value={option.label} maxLength={100} onChange={(e) => onChange({ label: e.target.value })} />
      </div>
      <div className="embed-field-group">
        <label>설명</label>
        <input value={option.description ?? ''} maxLength={100} onChange={(e) => onChange({ description: e.target.value })} />
      </div>
      <div className="embed-field-group">
        <label>값</label>
        <input value={option.value ?? ''} maxLength={100} onChange={(e) => onChange({ value: e.target.value })} placeholder={`opt_${option.id}`} />
      </div>
    </div>
  );
}

function SelectMenuEditor({
  menu,
  onChange,
}: {
  menu: MessageSelectMenu;
  onChange: (m: MessageSelectMenu) => void;
}) {
  const updateOption = (i: number, patch: Partial<SelectMenuOption>) => {
    const options = menu.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    onChange({ ...menu, options });
  };

  return (
    <div className="embed-subsection" style={{ border: 'none', paddingTop: 0 }}>
      <div className="embed-field-row">
        <div className="embed-field-group">
          <label>플레이스홀더</label>
          <input value={menu.placeholder ?? ''} maxLength={150} onChange={(e) => onChange({ ...menu, placeholder: e.target.value })} />
        </div>
        <label className="embed-inline-check" style={{ marginTop: 28 }}>
          <input type="checkbox" checked={!!menu.disabled} onChange={(e) => onChange({ ...menu, disabled: e.target.checked })} />
          비활성화
        </label>
      </div>
      <div className="embed-field-group">
        <label>Custom ID (선택)</label>
        <input value={menu.custom_id ?? ''} maxLength={100} onChange={(e) => onChange({ ...menu, custom_id: e.target.value || undefined })} />
      </div>
      {menu.options.map((opt, i) => (
        <SelectOptionEditor
          key={opt.id}
          option={opt}
          onChange={(p) => updateOption(i, p)}
          onRemove={() => onChange({ ...menu, options: menu.options.filter((_, idx) => idx !== i) })}
        />
      ))}
      <button
        type="button"
        className="embed-add-btn"
        disabled={menu.options.length >= 25}
        onClick={() => onChange({ ...menu, options: [...menu.options, { id: nextId(), label: '' }] })}
      >
        옵션 추가
      </button>
    </div>
  );
}

function ActionRowEditor({
  row,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  row: ActionRowComponent;
  onChange: (r: ActionRowComponent) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const isButtonRow = row.components.every((c) => c.type === 2);

  const updateChild = (i: number, child: MessageButton | MessageSelectMenu) => {
    const components = [...row.components];
    components[i] = child;
    onChange({ ...row, components });
  };

  return (
    <div className="embed-card" style={{ borderLeftColor: '#5865f2' }}>
      <div className="embed-card-header">
        <span className="embed-card-title">액션 행 — {isButtonRow ? '버튼' : '셀렉트 메뉴'}</span>
        <div className="embed-card-actions">
          {onMoveUp && <button type="button" className="embed-icon-btn" onClick={onMoveUp}>▲</button>}
          {onMoveDown && <button type="button" className="embed-icon-btn" onClick={onMoveDown}>▼</button>}
          <button type="button" className="embed-icon-btn" onClick={onRemove}>삭제</button>
        </div>
      </div>
      {row.components.map((child, i) =>
        child.type === 2 ? (
          <ButtonEditor
            key={child.id}
            button={child}
            onChange={(p) => updateChild(i, { ...child, ...p })}
            onRemove={() => onChange({ ...row, components: row.components.filter((_, idx) => idx !== i) })}
          />
        ) : (
          <SelectMenuEditor key={child.id} menu={child} onChange={(m) => updateChild(i, m)} />
        )
      )}
      {isButtonRow && row.components.length < 5 && (
        <button
          type="button"
          className="embed-add-btn"
          onClick={() => onChange({ ...row, components: [...row.components, createButton()] })}
        >
          버튼 추가
        </button>
      )}
    </div>
  );
}

function TextDisplayEditor({
  item,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  title = '텍스트 표시',
}: {
  item: TextDisplayComponent;
  onChange: (t: TextDisplayComponent) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  title?: string;
}) {
  return (
    <div className="embed-card" style={{ borderLeftColor: '#22c55e' }}>
      <div className="embed-card-header">
        <span className="embed-card-title">{title}</span>
        <div className="embed-card-actions">
          {onMoveUp && <button type="button" className="embed-icon-btn" onClick={onMoveUp}>▲</button>}
          {onMoveDown && <button type="button" className="embed-icon-btn" onClick={onMoveDown}>▼</button>}
          <button type="button" className="embed-icon-btn" onClick={onRemove}>삭제</button>
        </div>
      </div>
      <div className="embed-field-group">
        <label>내용</label>
        <textarea rows={4} maxLength={4000} value={item.content} onChange={(e) => onChange({ ...item, content: e.target.value })} />
      </div>
    </div>
  );
}

function SectionEditor({
  section,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  section: SectionComponent;
  onChange: (s: SectionComponent) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="embed-card" style={{ borderLeftColor: '#f59e0b' }}>
      <div className="embed-card-header">
        <span className="embed-card-title">섹션</span>
        <div className="embed-card-actions">
          {onMoveUp && <button type="button" className="embed-icon-btn" onClick={onMoveUp}>▲</button>}
          {onMoveDown && <button type="button" className="embed-icon-btn" onClick={onMoveDown}>▼</button>}
          <button type="button" className="embed-icon-btn" onClick={onRemove}>삭제</button>
        </div>
      </div>
      {section.components.map((t, i) => (
        <TextDisplayEditor
          key={t.id}
          item={t}
          title={`텍스트 ${i + 1}`}
          onChange={(updated) => {
            const components = [...section.components];
            components[i] = updated;
            onChange({ ...section, components });
          }}
          onRemove={() => onChange({ ...section, components: section.components.filter((_, idx) => idx !== i) })}
        />
      ))}
      {section.components.length < 3 && (
        <button type="button" className="embed-add-btn" onClick={() => onChange({ ...section, components: [...section.components, createTextDisplay()] })}>
          텍스트 추가
        </button>
      )}
      <details className="embed-subsection" open>
        <summary>액세서리 (썸네일 / 버튼)</summary>
        <div className="embed-field-group">
          <label>유형</label>
          <select
            value={section.accessory.type === 2 ? 'button' : 'thumbnail'}
            onChange={(e) => {
              if (e.target.value === 'button') {
                onChange({ ...section, accessory: createButton() });
              } else {
                onChange({ ...section, accessory: { id: nextId(), type: 11, media: { url: '' } } });
              }
            }}
          >
            <option value="thumbnail">썸네일</option>
            <option value="button">버튼</option>
          </select>
        </div>
        {section.accessory.type === 11 ? (
          <div className="embed-field-group">
            <label>썸네일 URL</label>
            <input
              value={section.accessory.media.url}
              onChange={(e) =>
                onChange({
                  ...section,
                  accessory: { ...section.accessory, type: 11, media: { url: e.target.value } },
                })
              }
            />
          </div>
        ) : (
          <ButtonEditor
            button={section.accessory}
            onChange={(p) => onChange({ ...section, accessory: { ...section.accessory, ...p } as MessageButton })}
            onRemove={() => {}}
          />
        )}
      </details>
    </div>
  );
}

function MediaGalleryEditor({
  gallery,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  gallery: MediaGalleryComponent;
  onChange: (g: MediaGalleryComponent) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="embed-card" style={{ borderLeftColor: '#0ea5e9' }}>
      <div className="embed-card-header">
        <span className="embed-card-title">미디어 갤러리</span>
        <div className="embed-card-actions">
          {onMoveUp && <button type="button" className="embed-icon-btn" onClick={onMoveUp}>▲</button>}
          {onMoveDown && <button type="button" className="embed-icon-btn" onClick={onMoveDown}>▼</button>}
          <button type="button" className="embed-icon-btn" onClick={onRemove}>삭제</button>
        </div>
      </div>
      {gallery.items.map((item, i) => (
        <div key={item.id} className="embed-field-group">
          <label>이미지 URL {i + 1}</label>
          <input
            value={item.media.url}
            onChange={(e) => {
              const items = gallery.items.map((it, idx) =>
                idx === i ? { ...it, media: { url: e.target.value } } : it
              );
              onChange({ ...gallery, items });
            }}
          />
        </div>
      ))}
      {gallery.items.length < 10 && (
        <button
          type="button"
          className="embed-add-btn"
          onClick={() => onChange({ ...gallery, items: [...gallery.items, { id: nextId(), media: { url: '' } }] })}
        >
          이미지 추가
        </button>
      )}
    </div>
  );
}

function FileEditor({
  file,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  file: FileComponent;
  onChange: (f: FileComponent) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="embed-card" style={{ borderLeftColor: '#ef4444' }}>
      <div className="embed-card-header">
        <span className="embed-card-title">파일</span>
        <div className="embed-card-actions">
          {onMoveUp && <button type="button" className="embed-icon-btn" onClick={onMoveUp}>▲</button>}
          {onMoveDown && <button type="button" className="embed-icon-btn" onClick={onMoveDown}>▼</button>}
          <button type="button" className="embed-icon-btn" onClick={onRemove}>삭제</button>
        </div>
      </div>
      <div className="embed-field-group">
        <label>파일 URL (attachment://filename)</label>
        <input value={file.file.url} onChange={(e) => onChange({ ...file, file: { url: e.target.value } })} />
      </div>
    </div>
  );
}

function SeparatorEditor({
  sep,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  sep: SeparatorComponent;
  onChange: (s: SeparatorComponent) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="embed-card" style={{ borderLeftColor: '#6b7280' }}>
      <div className="embed-card-header">
        <span className="embed-card-title">구분선</span>
        <div className="embed-card-actions">
          {onMoveUp && <button type="button" className="embed-icon-btn" onClick={onMoveUp}>▲</button>}
          {onMoveDown && <button type="button" className="embed-icon-btn" onClick={onMoveDown}>▼</button>}
          <button type="button" className="embed-icon-btn" onClick={onRemove}>삭제</button>
        </div>
      </div>
      <label className="embed-inline-check">
        <input type="checkbox" checked={sep.divider !== false} onChange={(e) => onChange({ ...sep, divider: e.target.checked })} />
        구분선 표시
      </label>
      <div className="embed-field-group">
        <label>간격</label>
        <select value={sep.spacing ?? 1} onChange={(e) => onChange({ ...sep, spacing: Number(e.target.value) as 1 | 2 })}>
          <option value={1}>작음</option>
          <option value={2}>큼</option>
        </select>
      </div>
    </div>
  );
}

function ContainerEditor({
  container,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  container: ContainerComponent;
  onChange: (c: ContainerComponent) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const updateChild = (i: number, child: ContainerComponent['components'][number]) => {
    const components = [...container.components];
    components[i] = child;
    onChange({ ...container, components });
  };

  return (
    <div className="embed-card" style={{ borderLeftColor: '#a855f7' }}>
      <div className="embed-card-header">
        <span className="embed-card-title">컨테이너</span>
        <div className="embed-card-actions">
          {onMoveUp && <button type="button" className="embed-icon-btn" onClick={onMoveUp}>▲</button>}
          {onMoveDown && <button type="button" className="embed-icon-btn" onClick={onMoveDown}>▼</button>}
          <button type="button" className="embed-icon-btn" onClick={onRemove}>삭제</button>
        </div>
      </div>
      {container.components.map((child, i) => (
        <ComponentEntry
          key={child.id}
          component={child}
          v2
          onChange={(c) => updateChild(i, c as ContainerComponent['components'][number])}
          onRemove={() => onChange({ ...container, components: container.components.filter((_, idx) => idx !== i) })}
        />
      ))}
      {container.components.length < 10 && (
        <AddComponentDropdown
          v2
          onAdd={(c) => onChange({ ...container, components: [...container.components, c as ContainerComponent['components'][number]] })}
          excludeContainer
        />
      )}
    </div>
  );
}

function ComponentEntry({
  component,
  v2,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  component: MessageComponent;
  v2: boolean;
  onChange: (c: MessageComponent) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  switch (component.type) {
    case 1:
      return (
        <ActionRowEditor
          row={component}
          onChange={onChange}
          onRemove={onRemove}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      );
    case 10:
      return (
        <TextDisplayEditor
          item={component}
          onChange={onChange}
          onRemove={onRemove}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      );
    case 9:
      return (
        <SectionEditor
          section={component}
          onChange={onChange}
          onRemove={onRemove}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      );
    case 12:
      return (
        <MediaGalleryEditor
          gallery={component}
          onChange={onChange}
          onRemove={onRemove}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      );
    case 13:
      return (
        <FileEditor
          file={component}
          onChange={onChange}
          onRemove={onRemove}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      );
    case 14:
      return (
        <SeparatorEditor
          sep={component}
          onChange={onChange}
          onRemove={onRemove}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      );
    case 17:
      return (
        <ContainerEditor
          container={component}
          onChange={onChange}
          onRemove={onRemove}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      );
    default:
      return null;
  }
}

function AddComponentDropdown({
  v2,
  onAdd,
  excludeContainer,
}: {
  v2: boolean;
  onAdd: (c: MessageComponent) => void;
  excludeContainer?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const types = [
    { label: '버튼 행', handler: () => onAdd(createActionRow()) },
    { label: '셀렉트 메뉴', handler: () => onAdd(createSelectMenuRow()) },
    ...(v2
      ? [
          { label: '텍스트 표시', handler: () => onAdd(createTextDisplay()) },
          { label: '섹션', handler: () => onAdd(createSection()) },
          { label: '미디어 갤러리', handler: () => onAdd(createMediaGallery()) },
          { label: '파일', handler: () => onAdd(createFileComponent()) },
          { label: '구분선', handler: () => onAdd(createSeparator()) },
          ...(!excludeContainer ? [{ label: '컨테이너', handler: () => onAdd(createContainer()) }] : []),
        ]
      : []),
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="embed-add-btn" onClick={() => setOpen(!open)}>
        컴포넌트 추가 ▾
      </button>
      {open && (
        <div
          className="embed-section"
          style={{
            position: 'absolute',
            zIndex: 20,
            minWidth: 180,
            padding: 8,
            marginTop: 4,
          }}
        >
          {types.map((t) => (
            <button
              key={t.label}
              type="button"
              className="embed-icon-btn"
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px' }}
              onClick={() => {
                t.handler();
                setOpen(false);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  message: EmbedMessage;
  onChange: (msg: EmbedMessage) => void;
}

export function EmbedComponentsEditor({ message, onChange }: Props) {
  const v2 = isComponentsV2(message.flags);
  const components = message.components;

  const updateComponents = (next: MessageComponent[]) => {
    onChange({ ...message, components: next });
  };

  const updateAt = (index: number, comp: MessageComponent) => {
    const next = [...components];
    next[index] = comp;
    updateComponents(next);
  };

  return (
    <div className="embed-section">
      <div
        className="embed-section-title"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>컴포넌트</span>
        <span style={{ fontWeight: 400, textTransform: 'none' }}>
          {components.length} / 5
          {v2 && <span style={{ marginLeft: 8, color: '#5865f2' }}>V2</span>}
        </span>
      </div>

      {components.map((comp, i) => (
        <ComponentEntry
          key={comp.id}
          component={comp}
          v2={v2}
          onChange={(c) => updateAt(i, c)}
          onRemove={() => updateComponents(components.filter((_, idx) => idx !== i))}
          onMoveUp={i > 0 ? () => updateComponents(moveItem(components, i, i - 1)) : undefined}
          onMoveDown={i < components.length - 1 ? () => updateComponents(moveItem(components, i, i + 1)) : undefined}
        />
      ))}

      {components.length < 5 && (
        <AddComponentDropdown v2={v2} onAdd={(c) => updateComponents([...components, c])} />
      )}
      <button
        type="button"
        className="embed-clear-btn"
        style={{ marginLeft: 8 }}
        onClick={() => updateComponents([])}
      >
        컴포넌트 전체 삭제
      </button>
    </div>
  );
}
