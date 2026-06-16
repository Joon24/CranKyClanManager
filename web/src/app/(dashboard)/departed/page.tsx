'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { POSITION_META, type Position } from '@shared/types';

interface DepartedUser {
  id: string;
  discord_user_id: string;
  sudden_nickname: string | null;
  server_nickname: string | null;
  position: string | null;
  member_type: string | null;
  status: 'left' | 'kicked' | 'blocked';
  blacklist_reason: string | null;
  blacklisted_at: string | null;
  blacklisted_by: string | null;
  updated_at: string;
  created_at: string;
}

type FilterTab = 'left' | 'kicked' | 'blocked' | 'all';

const TABS: { key: FilterTab; label: string; icon: string }[] = [
  { key: 'left', label: '탈퇴', icon: '👋' },
  { key: 'kicked', label: '추방', icon: '🚫' },
  { key: 'blocked', label: '블랙리스트', icon: '⛔' },
  { key: 'all', label: '전체', icon: '📋' },
];

function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPositionName(position: string | null) {
  if (!position) return '-';
  if (position in POSITION_META) {
    return POSITION_META[position as Position].name;
  }
  return position;
}

function statusLabel(status: string) {
  if (status === 'left') return '탈퇴';
  if (status === 'kicked') return '추방';
  if (status === 'blocked') return '블랙리스트';
  return status;
}

export default function DepartedPage() {
  const [users, setUsers] = useState<DepartedUser[]>([]);
  const [tab, setTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const [idForm, setIdForm] = useState({ discordUserId: '', nickname: '', reason: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/departed?_=' + Date.now(), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '목록 조회 실패');
        setUsers([]);
        return;
      }
      if (Array.isArray(data)) setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const left = users.filter((u) => u.status === 'left').length;
    const kicked = users.filter((u) => u.status === 'kicked').length;
    const blocked = users.filter((u) => u.status === 'blocked').length;
    return { left, kicked, blocked, all: users.length };
  }, [users]);

  const filtered = useMemo(() => {
    if (tab === 'all') return users;
    return users.filter((u) => u.status === tab);
  }, [users, tab]);

  const handleAction = async (payload: Record<string, unknown>) => {
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/departed', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '처리 실패');
        return;
      }
      await load();
    } catch {
      setError('요청 처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const submitBlacklistById = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idForm.discordUserId.trim()) {
      setError('Discord 유저 ID를 입력해 주세요.');
      return;
    }
    await handleAction({
      action: 'blacklist_by_id',
      discordUserId: idForm.discordUserId.trim(),
      nickname: idForm.nickname.trim() || undefined,
      reason: idForm.reason.trim() || undefined,
    });
    setIdForm({ discordUserId: '', nickname: '', reason: '' });
  };

  return (
    <div className="dept-page">
      <header className="dept-hero">
        <div>
          <p className="dept-hero-badge">Departed Members</p>
          <h1 className="dept-hero-title">탈퇴자 관리</h1>
          <p className="dept-hero-sub">
            탈퇴·추방 인원 조회 · 블랙리스트 등록 시 서버 재입장 차단
          </p>
        </div>
        <div className="dept-hero-stats">
          <div className="dept-hero-stat">
            <span className="dept-hero-stat-val">{counts.blocked}</span>
            <span className="dept-hero-stat-label">블랙리스트</span>
          </div>
        </div>
      </header>

      <section className="dept-blacklist-form">
        <h2>⛔ 유저 ID로 블랙리스트 등록</h2>
        <p>Discord 유저 ID를 직접 입력해 재입장을 차단합니다. (서버 밴 처리)</p>
        <form onSubmit={submitBlacklistById} className="dept-form-grid">
          <label>
            <span>Discord 유저 ID *</span>
            <input
              type="text"
              placeholder="예: 123456789012345678"
              value={idForm.discordUserId}
              onChange={(e) => setIdForm((f) => ({ ...f, discordUserId: e.target.value }))}
              disabled={actionLoading}
            />
          </label>
          <label>
            <span>닉네임 (선택)</span>
            <input
              type="text"
              placeholder="기록용 닉네임"
              value={idForm.nickname}
              onChange={(e) => setIdForm((f) => ({ ...f, nickname: e.target.value }))}
              disabled={actionLoading}
            />
          </label>
          <label className="dept-form-full">
            <span>사유</span>
            <input
              type="text"
              placeholder="블랙리스트 사유"
              value={idForm.reason}
              onChange={(e) => setIdForm((f) => ({ ...f, reason: e.target.value }))}
              disabled={actionLoading}
            />
          </label>
          <button type="submit" className="dept-submit-btn" disabled={actionLoading}>
            {actionLoading ? '처리 중...' : '블랙리스트 등록'}
          </button>
        </form>
      </section>

      <div className="dept-mini-stats">
        <div className="dept-mini-stat">
          <span>👋</span>
          <div>
            <strong>{counts.left}</strong>
            <span>탈퇴</span>
          </div>
        </div>
        <div className="dept-mini-stat">
          <span>🚫</span>
          <div>
            <strong>{counts.kicked}</strong>
            <span>추방</span>
          </div>
        </div>
        <div className="dept-mini-stat dept-mini-stat-danger">
          <span>⛔</span>
          <div>
            <strong>{counts.blocked}</strong>
            <span>블랙리스트</span>
          </div>
        </div>
      </div>

      <div className="dept-toolbar">
        <div className="dept-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`dept-tab ${tab === t.key ? 'dept-tab-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span>{t.icon}</span>
              {t.label}
              <span className="dept-tab-count">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <button className="dept-refresh-btn" onClick={load} disabled={loading}>
          {loading ? '불러오는 중...' : '↻ 새로고침'}
        </button>
      </div>

      {error && <p className="dept-error">{error}</p>}

      {loading ? (
        <div className="dept-loading">
          <div className="app-spinner" />
          <p>탈퇴자 목록 불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="dept-empty">
          <div className="dept-empty-icon">👋</div>
          <h3>표시할 탈퇴자가 없습니다</h3>
          <p>서버 탈퇴·추방·블랙리스트 처리된 인원이 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="dept-list">
          {filtered.map((u) => {
            const isBlocked = u.status === 'blocked';
            const displayName = u.sudden_nickname ?? u.server_nickname ?? '이름 없음';

            return (
              <article key={u.id} className={`dept-card ${isBlocked ? 'dept-card-blocked' : ''}`}>
                <div className="dept-card-status">
                  {u.status === 'blocked' ? '⛔' : u.status === 'kicked' ? '🚫' : '👋'}
                </div>
                <div className="dept-card-main">
                  <div className="dept-card-header">
                    <div>
                      <h3>{displayName}</h3>
                      <p>
                        {u.server_nickname ?? '-'} · {getPositionName(u.position)}
                        {u.member_type === 'mercenary' ? ' · 용병' : ''}
                      </p>
                    </div>
                    <span className={`dept-badge dept-badge-${u.status}`}>
                      {statusLabel(u.status)}
                    </span>
                  </div>
                  <div className="dept-card-grid">
                    <div>
                      <span className="dept-field-label">유저 ID</span>
                      <span className="dept-mono">{u.discord_user_id}</span>
                    </div>
                    <div>
                      <span className="dept-field-label">처리일</span>
                      <span>{formatDate(u.updated_at)}</span>
                    </div>
                    {isBlocked && (
                      <>
                        <div>
                          <span className="dept-field-label">등록일</span>
                          <span>{formatDate(u.blacklisted_at)}</span>
                        </div>
                        <div>
                          <span className="dept-field-label">등록자</span>
                          <span>{u.blacklisted_by ?? '-'}</span>
                        </div>
                        <div className="dept-card-reason">
                          <span className="dept-field-label">사유</span>
                          <span>{u.blacklist_reason ?? '-'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="dept-card-actions">
                  {!isBlocked ? (
                    <button
                      className="dept-action-btn dept-action-block"
                      disabled={actionLoading}
                      onClick={async () => {
                        const reason = prompt('블랙리스트 사유를 입력하세요.');
                        if (reason === null) return;
                        await handleAction({
                          action: 'blacklist',
                          userId: u.id,
                          reason: reason.trim() || undefined,
                        });
                      }}
                    >
                      ⛔ 블랙리스트
                    </button>
                  ) : (
                    <button
                      className="dept-action-btn dept-action-unblock"
                      disabled={actionLoading}
                      onClick={async () => {
                        if (
                          confirm(
                            `${displayName} 님을 블랙리스트에서 해제할까요?\n(서버 밴이 해제되어 재입장이 가능해집니다)`
                          )
                        ) {
                          await handleAction({ action: 'unblacklist', userId: u.id });
                        }
                      }}
                    >
                      ✅ 해제
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
