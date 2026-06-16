'use client';

import { useEffect, useState } from 'react';
import type { EmbedMessage } from '@/lib/embed-types';
import { messageToExportJson, messageToDiscordJson, parseMessageFromJson } from '@/lib/embed-json';

interface Props {
  message: EmbedMessage;
  open: boolean;
  onClose: () => void;
  onSave: (message: EmbedMessage) => void;
}

export function EmbedJsonEditor({ message, open, onClose, onSave }: Props) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'editor' | 'discord'>('editor');

  useEffect(() => {
    if (open) {
      setRaw(mode === 'discord' ? messageToDiscordJson(message) : messageToExportJson(message));
      setError('');
    }
  }, [open, message, mode]);

  if (!open) return null;

  function switchMode(next: 'editor' | 'discord') {
    setMode(next);
    setRaw(next === 'discord' ? messageToDiscordJson(message) : messageToExportJson(message));
    setError('');
  }

  function save() {
    try {
      const parsed =
        mode === 'discord'
          ? parseMessageFromJson(JSON.parse(raw))
          : parseMessageFromJson(JSON.parse(raw));
      onSave(parsed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON 파싱 실패');
    }
  }

  return (
    <div className="embed-json-overlay" role="dialog" aria-modal="true">
      <div className="embed-json-modal">
        <div className="embed-json-header">
          <h2>JSON 편집기</h2>
          <div className="embed-json-tabs">
            <button
              type="button"
              className={mode === 'editor' ? 'embed-json-tab-active' : ''}
              onClick={() => switchMode('editor')}
            >
              편집기 형식
            </button>
            <button
              type="button"
              className={mode === 'discord' ? 'embed-json-tab-active' : ''}
              onClick={() => switchMode('discord')}
            >
              Discord API 형식
            </button>
          </div>
        </div>
        <p className="embed-json-hint">
          embedg와 동일하게 메시지 JSON을 직접 편집할 수 있습니다. 저장 시 편집기에 반영됩니다.
        </p>
        <textarea
          className="embed-json-textarea"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setError('');
          }}
          spellCheck={false}
        />
        {error && <div className="embed-error">{error}</div>}
        <div className="embed-json-actions">
          <button type="button" className="embed-clear-btn" onClick={onClose}>
            취소
          </button>
          <button type="button" className="embed-send-btn" onClick={save}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
