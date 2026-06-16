'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { validateMessage } from '@/lib/embed-payload';
import {
  createEmptyEmbed,
  createEmptyMessage,
  type EmbedField,
  type EmbedMessage,
  type MessageEmbed,
  hexToColorInt,
  nextId,
  colorIntToHex,
} from '@/lib/embed-types';
import {
  disableComponentsV2,
  enableComponentsV2,
  isComponentsV2,
} from '@/lib/embed-components';

const EmbedMessagePreview = dynamic(
  () => import('./EmbedMessagePreview').then((m) => ({ default: m.EmbedMessagePreview })),
  { ssr: false }
);
const EmbedComponentsEditor = dynamic(
  () => import('./EmbedComponentsEditor').then((m) => ({ default: m.EmbedComponentsEditor })),
  { ssr: false }
);
const EmbedJsonEditor = dynamic(
  () => import('./EmbedJsonEditor').then((m) => ({ default: m.EmbedJsonEditor })),
  { ssr: false }
);

interface BotChannelResponse {
  id: string;
  name: string;
  type: number;
  parentName: string | null;
}

function updateEmbed(
  message: EmbedMessage,
  embedIndex: number,
  patch: Partial<MessageEmbed>
): EmbedMessage {
  const embeds = [...message.embeds];
  embeds[embedIndex] = { ...embeds[embedIndex], ...patch };
  return { ...message, embeds };
}

function EmbedFieldEditor({
  field,
  onChange,
  onRemove,
}: {
  field: EmbedField;
  onChange: (patch: Partial<EmbedField>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="embed-card" style={{ borderLeftColor: '#3b82f6' }}>
      <div className="embed-card-header">
        <span className="embed-card-title">필드</span>
        <button type="button" className="embed-icon-btn" onClick={onRemove}>
          삭제
        </button>
      </div>
      <div className="embed-field-group">
        <label>이름</label>
        <input
          value={field.name}
          maxLength={256}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="필드 이름"
        />
      </div>
      <div className="embed-field-group">
        <label>값</label>
        <textarea
          value={field.value}
          maxLength={1024}
          rows={3}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="필드 값"
        />
      </div>
      <label className="embed-inline-check">
        <input
          type="checkbox"
          checked={!!field.inline}
          onChange={(e) => onChange({ inline: e.target.checked })}
        />
        인라인
      </label>
    </div>
  );
}

function SingleEmbedEditor({
  embed,
  index,
  total,
  onChange,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
}: {
  embed: MessageEmbed;
  index: number;
  total: number;
  onChange: (patch: Partial<MessageEmbed>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const borderColor = colorIntToHex(embed.color);

  const updateField = (fieldIndex: number, patch: Partial<EmbedField>) => {
    const fields = embed.fields.map((f, i) => (i === fieldIndex ? { ...f, ...patch } : f));
    onChange({ fields });
  };

  const removeField = (fieldIndex: number) => {
    onChange({ fields: embed.fields.filter((_, i) => i !== fieldIndex) });
  };

  const addField = () => {
    if (embed.fields.length >= 25) return;
    onChange({
      fields: [...embed.fields, { id: nextId(), name: '', value: '', inline: false }],
    });
  };

  const hexValue =
    embed.color !== undefined ? embed.color.toString(16).padStart(6, '0') : '';

  return (
    <div className="embed-card" style={{ borderLeftColor: borderColor }}>
      <div className="embed-card-header">
        <span className="embed-card-title">
          임베드 {index + 1}
          {embed.title ? ` — ${embed.title}` : embed.author?.name ? ` — ${embed.author.name}` : ''}
        </span>
        <div className="embed-card-actions">
          {index > 0 && (
            <button type="button" className="embed-icon-btn" onClick={onMoveUp}>
              ▲
            </button>
          )}
          {index < total - 1 && (
            <button type="button" className="embed-icon-btn" onClick={onMoveDown}>
              ▼
            </button>
          )}
          {total < 10 && (
            <button type="button" className="embed-icon-btn" onClick={onDuplicate}>
              복제
            </button>
          )}
          <button type="button" className="embed-icon-btn" onClick={onRemove}>
            삭제
          </button>
        </div>
      </div>

      <details className="embed-subsection" open>
        <summary>작성자</summary>
        <div className="embed-field-group">
          <label>이름</label>
          <input
            value={embed.author?.name ?? ''}
            maxLength={256}
            onChange={(e) =>
              onChange({ author: { ...embed.author, name: e.target.value || undefined } })
            }
            placeholder="작성자 이름"
          />
        </div>
        <div className="embed-field-row">
          <div className="embed-field-group">
            <label>URL</label>
            <input
              value={embed.author?.url ?? ''}
              onChange={(e) =>
                onChange({ author: { ...embed.author, name: embed.author?.name, url: e.target.value } })
              }
              placeholder="https://"
            />
          </div>
          <div className="embed-field-group">
            <label>아이콘 URL</label>
            <input
              value={embed.author?.icon_url ?? ''}
              onChange={(e) =>
                onChange({
                  author: { ...embed.author, name: embed.author?.name, icon_url: e.target.value },
                })
              }
              placeholder="https://"
            />
          </div>
        </div>
      </details>

      <details className="embed-subsection" open>
        <summary>본문</summary>
        <div className="embed-field-group">
          <label>제목</label>
          <input
            value={embed.title ?? ''}
            maxLength={256}
            onChange={(e) => onChange({ title: e.target.value || undefined })}
            placeholder="임베드 제목"
          />
        </div>
        <div className="embed-field-group">
          <label>설명</label>
          <textarea
            value={embed.description ?? ''}
            maxLength={4096}
            rows={5}
            onChange={(e) => onChange({ description: e.target.value || undefined })}
            placeholder="임베드 설명 (마크다운 지원: **굵게**, *기울임*, `코드`)"
          />
          <div className="embed-char-count">{(embed.description ?? '').length} / 4096</div>
        </div>
        <div className="embed-field-row">
          <div className="embed-field-group">
            <label>URL</label>
            <input
              value={embed.url ?? ''}
              onChange={(e) => onChange({ url: e.target.value || undefined })}
              placeholder="https://"
            />
          </div>
          <div className="embed-field-group">
            <label>색상</label>
            <div className="embed-color-input">
              <span style={{ color: 'var(--text-muted)' }}>#</span>
              <input
                value={hexValue}
                onChange={(e) => onChange({ color: hexToColorInt(e.target.value) })}
                placeholder="5865f2"
                maxLength={6}
              />
              <input
                type="color"
                value={borderColor}
                onChange={(e) => onChange({ color: hexToColorInt(e.target.value) })}
              />
            </div>
          </div>
        </div>
        <div className="embed-field-group">
          <label>타임스탬프</label>
          <input
            type="datetime-local"
            value={
              embed.timestamp
                ? new Date(embed.timestamp).toISOString().slice(0, 16)
                : ''
            }
            onChange={(e) =>
              onChange({
                timestamp: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })
            }
          />
        </div>
      </details>

      <details className="embed-subsection">
        <summary>이미지</summary>
        <div className="embed-field-group">
          <label>이미지 URL</label>
          <input
            value={embed.image?.url ?? ''}
            onChange={(e) => onChange({ image: e.target.value ? { url: e.target.value } : undefined })}
            placeholder="https://"
          />
        </div>
        <div className="embed-field-group">
          <label>썸네일 URL</label>
          <input
            value={embed.thumbnail?.url ?? ''}
            onChange={(e) =>
              onChange({ thumbnail: e.target.value ? { url: e.target.value } : undefined })
            }
            placeholder="https://"
          />
        </div>
      </details>

      <details className="embed-subsection">
        <summary>푸터</summary>
        <div className="embed-field-group">
          <label>텍스트</label>
          <input
            value={embed.footer?.text ?? ''}
            maxLength={2048}
            onChange={(e) =>
              onChange({ footer: { ...embed.footer, text: e.target.value || undefined } })
            }
            placeholder="푸터 텍스트"
          />
        </div>
        <div className="embed-field-group">
          <label>아이콘 URL</label>
          <input
            value={embed.footer?.icon_url ?? ''}
            onChange={(e) =>
              onChange({ footer: { ...embed.footer, text: embed.footer?.text, icon_url: e.target.value } })
            }
            placeholder="https://"
          />
        </div>
      </details>

      <details className="embed-subsection" open>
        <summary>필드 ({embed.fields.length} / 25)</summary>
        {embed.fields.map((field, fieldIndex) => (
          <EmbedFieldEditor
            key={field.id}
            field={field}
            onChange={(patch) => updateField(fieldIndex, patch)}
            onRemove={() => removeField(fieldIndex)}
          />
        ))}
        <button
          type="button"
          className="embed-add-btn"
          disabled={embed.fields.length >= 25}
          onClick={addField}
        >
          필드 추가
        </button>
      </details>
    </div>
  );
}

export function EmbedGenerator() {
  const { data: session } = useSession();
  const [message, setMessage] = useState<EmbedMessage>(createEmptyMessage);
  const [channels, setChannels] = useState<BotChannelResponse[]>([]);
  const [channelId, setChannelId] = useState('');
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [jsonOpen, setJsonOpen] = useState(false);

  const v2Enabled = isComponentsV2(message.flags);
  const validationError = useMemo(() => validateMessage(message), [message]);

  useEffect(() => {
    fetch('/api/embed/channels')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setChannels(data);
          if (data.length > 0) setChannelId(data[0].id);
        } else {
          setError(data.error ?? '채널 목록을 불러오지 못했습니다.');
        }
      })
      .catch(() => setError('채널 목록을 불러오지 못했습니다.'))
      .finally(() => setLoadingChannels(false));
  }, []);

  const groupedChannels = useMemo(() => {
    const groups = new Map<string, BotChannelResponse[]>();
    for (const ch of channels) {
      const key = ch.parentName ?? '채널';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ch);
    }
    return [...groups.entries()];
  }, [channels]);

  const patchEmbed = useCallback((index: number, patch: Partial<MessageEmbed>) => {
    setMessage((prev) => updateEmbed(prev, index, patch));
  }, []);

  const moveEmbed = (from: number, to: number) => {
    setMessage((prev) => {
      const embeds = [...prev.embeds];
      const [item] = embeds.splice(from, 1);
      embeds.splice(to, 0, item);
      return { ...prev, embeds };
    });
  };

  const send = async () => {
    setError('');
    setSuccess('');
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!channelId) {
      setError('채널을 선택해 주세요.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/embed/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '전송 실패');
        return;
      }
      const ch = channels.find((c) => c.id === channelId);
      setSuccess(`#${ch?.name ?? channelId} 채널에 메시지를 전송했습니다.`);
    } catch {
      setError('전송 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  const botName = 'CranKy Bot';
  const botAvatar = session?.user?.image;

  const toggleV2 = () => {
    setMessage((prev) => {
      const nextFlags = v2Enabled ? disableComponentsV2(prev.flags) : enableComponentsV2(prev.flags);
      return { ...prev, flags: nextFlags };
    });
  };

  const clearMessage = () => {
    if (window.confirm('메시지 전체를 삭제할까요?')) {
      setMessage(createEmptyMessage());
    }
  };

  return (
    <div className="embed-generator">
      <EmbedJsonEditor
        message={message}
        open={jsonOpen}
        onClose={() => setJsonOpen(false)}
        onSave={setMessage}
      />
      <div className="embed-generator-layout">
        <div className="embed-generator-editor">
          <div className="embed-toolbar">
            <h1 className="page-title" style={{ margin: 0 }}>
              임베드 생성기
            </h1>
            <div className="embed-toolbar-actions">
              <button type="button" className="embed-toolbar-btn" onClick={clearMessage}>
                전체 삭제
              </button>
              <button type="button" className="embed-toolbar-btn" onClick={() => setJsonOpen(true)}>
                JSON
              </button>
              <div className="embed-v2-toggle">
                <button
                  type="button"
                  className={!v2Enabled ? 'embed-v2-active' : ''}
                  onClick={() => v2Enabled && toggleV2()}
                >
                  Classic
                </button>
                <button
                  type="button"
                  className={v2Enabled ? 'embed-v2-active' : ''}
                  onClick={() => !v2Enabled && toggleV2()}
                >
                  Components V2
                </button>
              </div>
            </div>
          </div>

          {v2Enabled && (
            <p className="embed-json-hint" style={{ marginBottom: 12 }}>
              Components V2 모드: 메시지 내용·임베드 대신 텍스트 표시, 섹션 등 V2 컴포넌트를 사용합니다.
            </p>
          )}

          <div className="embed-send-bar">
            <div className="embed-field-group">
              <label>채널</label>
              <select
                value={channelId}
                disabled={loadingChannels || channels.length === 0}
                onChange={(e) => setChannelId(e.target.value)}
              >
                {loadingChannels && <option>불러오는 중…</option>}
                {!loadingChannels && channels.length === 0 && (
                  <option>채널 없음 (봇 실행 확인)</option>
                )}
                {groupedChannels.map(([group, items]) => (
                  <optgroup key={group} label={group}>
                    {items.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        #{ch.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="embed-send-btn"
              disabled={sending || !!validationError || !channelId}
              onClick={send}
            >
              {sending ? '전송 중…' : '메시지 전송'}
            </button>
          </div>

          {error && <div className="embed-error">{error}</div>}
          {success && <div className="embed-success">{success}</div>}
          {validationError && (
            <div className="embed-error">{validationError}</div>
          )}

          {!v2Enabled && (
          <div className="embed-section">
            <div className="embed-section-title">메시지 내용</div>
            <div className="embed-field-group">
              <textarea
                value={message.content}
                maxLength={2000}
                rows={4}
                onChange={(e) => setMessage((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="임베드 위에 표시될 일반 메시지 (선택)"
              />
              <div className="embed-char-count">{message.content.length} / 2000</div>
            </div>
          </div>
          )}

          {!v2Enabled && (
          <div className="embed-section">
            <div
              className="embed-section-title"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>임베드</span>
              <span style={{ fontWeight: 400, textTransform: 'none' }}>
                {message.embeds.length} / 10
              </span>
            </div>

            {message.embeds.map((embed, index) => (
              <SingleEmbedEditor
                key={embed.id}
                embed={embed}
                index={index}
                total={message.embeds.length}
                onChange={(patch) => patchEmbed(index, patch)}
                onMoveUp={() => moveEmbed(index, index - 1)}
                onMoveDown={() => moveEmbed(index, index + 1)}
                onDuplicate={() => {
                  if (message.embeds.length >= 10) return;
                  const copy = {
                    ...embed,
                    id: nextId(),
                    fields: embed.fields.map((f) => ({ ...f, id: nextId() })),
                  };
                  setMessage((prev) => {
                    const embeds = [...prev.embeds];
                    embeds.splice(index + 1, 0, copy);
                    return { ...prev, embeds };
                  });
                }}
                onRemove={() =>
                  setMessage((prev) => ({
                    ...prev,
                    embeds: prev.embeds.filter((_, i) => i !== index),
                  }))
                }
              />
            ))}

            <button
              type="button"
              className="embed-add-btn"
              disabled={message.embeds.length >= 10}
              onClick={() =>
                setMessage((prev) => ({
                  ...prev,
                  embeds: [...prev.embeds, createEmptyEmbed()],
                }))
              }
            >
              임베드 추가
            </button>
            <button
              type="button"
              className="embed-clear-btn"
              onClick={() => setMessage((prev) => ({ ...prev, embeds: [] }))}
            >
              임베드 전체 삭제
            </button>
          </div>
          )}

          <EmbedComponentsEditor message={message} onChange={setMessage} />
        </div>

        <div className="embed-generator-preview">
          <div className="embed-section-title" style={{ marginBottom: 16 }}>
            미리보기
          </div>
          <EmbedMessagePreview message={message} username={botName} avatarUrl={botAvatar} />
        </div>
      </div>
    </div>
  );
}
