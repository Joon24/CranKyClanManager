'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SuspicionBadge } from '@/components/SuspicionBadge';
import { CLAN_ROLE_OPTIONS, clanRoleLabel } from '@/lib/clan-role-labels';

interface DiscordRole {
  id: string;
  name: string;
  color: string;
}

type NicknameSort = 'nickname-asc' | 'nickname-desc' | 'server-asc' | 'server-desc';

interface Member {  id: string;
  discord_user_id: string;
  sudden_nickname: string;
  server_nickname: string;
  position: string;
  role: string;
  status: string;
  match_stats: {
    kd: number;
    win_rate: number;
    suspicion_level: 'normal' | 'caution' | 'review';
    last_checked_at?: string;
  } | null;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [syncingStats, setSyncingStats] = useState(false);
  const [syncingDiscord, setSyncingDiscord] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [nicknameQuery, setNicknameQuery] = useState('');
  const [nicknameSort, setNicknameSort] = useState<NicknameSort>('nickname-asc');

  const loadMembers = useCallback(
    () => fetch('/api/members?type=member').then((r) => r.json()).then(setMembers),
    []
  );

  const syncDiscord = useCallback(async () => {
    setSyncingDiscord(true);
    setSyncError('');
    setSyncMessage('');
    try {
      const res = await fetch('/api/members/sync-discord', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error ?? 'Discord 동기화 실패');
        return;
      }
      setSyncMessage(
        `Discord ${data.total}명 · 신규 ${data.created}명 · 갱신 ${data.updated}명` +
          (data.fixed ? ` · 닉네임 수정 ${data.fixed}명` : '')
      );
      await loadMembers();
    } catch {
      setSyncError('Discord 동기화 중 오류가 발생했습니다.');
    } finally {
      setSyncingDiscord(false);
    }
  }, [loadMembers]);

  const syncStats = useCallback(
    async (userId?: string) => {
      setSyncingStats(true);
      setSyncError('');
      try {
        const res = await fetch('/api/members/sync-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userId ? { userId } : {}),
        });
        const data = await res.json();
        if (!res.ok) {
          setSyncError(data.error ?? '전적 갱신 실패');
          return;
        }
        await loadMembers();
      } catch {
        setSyncError('전적 갱신 중 오류가 발생했습니다.');
      } finally {
        setSyncingStats(false);
      }
    },
    [loadMembers]
  );

  useEffect(() => {
    loadMembers();
    fetch('/api/discord/roles')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setRoles(data);
        } else {
          setRoles(CLAN_ROLE_OPTIONS);
        }
      })
      .catch(() => setRoles(CLAN_ROLE_OPTIONS));
  }, [loadMembers]);

  const roleName = (roleId: string) =>
    roles.find((r) => r.id === roleId)?.name ?? clanRoleLabel(roleId);

  const displayName = (m: Member) => m.sudden_nickname ?? m.server_nickname ?? '';

  const filteredMembers = useMemo(() => {
    const q = nicknameQuery.trim().toLowerCase();
    let list = members.filter((m) => m.status === 'approved');

    if (q) {
      list = list.filter((m) => {
        const nick = (m.sudden_nickname ?? '').toLowerCase();
        const server = (m.server_nickname ?? '').toLowerCase();
        return nick.includes(q) || server.includes(q);
      });
    }

    const collator = new Intl.Collator('ko', { sensitivity: 'base', numeric: true });

    list = [...list].sort((a, b) => {
      switch (nicknameSort) {
        case 'nickname-desc':
          return collator.compare(displayName(b), displayName(a));
        case 'server-asc':
          return collator.compare(a.server_nickname ?? '', b.server_nickname ?? '');
        case 'server-desc':
          return collator.compare(b.server_nickname ?? '', a.server_nickname ?? '');
        case 'nickname-asc':
        default:
          return collator.compare(displayName(a), displayName(b));
      }
    });

    return list;
  }, [members, nicknameQuery, nicknameSort]);

  const approvedCount = useMemo(
    () => members.filter((m) => m.status === 'approved').length,
    [members]
  );

  const handleAction = async (userId: string, action: string, payload?: object) => {
    const res = await fetch('/api/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action, ...payload }),
    });
    if (res.ok) loadMembers();
    else {
      const err = await res.json();
      alert(err.error ?? '처리 실패');
    }
  };

  const handleRoleChange = (userId: string, roleId: string) => {
    if (!roleId) return;
    handleAction(userId, 'change_role', { roleId });
  };

  const busy = syncingStats || syncingDiscord;

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          클랜원 관리
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            onClick={() => syncDiscord()}
            disabled={busy}
          >
            {syncingDiscord ? 'Discord 불러오는 중...' : 'Discord 멤버 동기화'}
          </button>
          <button className="btn btn-primary" onClick={() => syncStats()} disabled={busy}>
            {syncingStats ? '전적 갱신 중...' : '전적 갱신 (최근 20경기)'}
          </button>
        </div>
      </div>

      {syncError && (
        <p style={{ color: 'var(--danger)', marginBottom: 16, fontSize: '0.875rem' }}>{syncError}</p>
      )}

      {syncMessage && (
        <p style={{ color: 'var(--success, #86efac)', marginBottom: 16, fontSize: '0.875rem' }}>
          {syncMessage}
        </p>
      )}

      <p className="disclaimer" style={{ marginBottom: 16 }}>
        클랜원 · 열혈클랜원 · 운영진 역할을 가진 Discord 멤버를 「Discord 멤버 동기화」로
        불러옵니다. KD · 승률 · 의심지표는 최근 20경기 기준입니다.
      </p>

      <div className="members-toolbar">
        <div className="members-search-box">
          <span className="members-search-icon">🔍</span>
          <input
            className="members-search-input"
            type="search"
            placeholder="닉네임 · 서버별명 검색"
            value={nicknameQuery}
            onChange={(e) => setNicknameQuery(e.target.value)}
          />
          {nicknameQuery && (
            <button
              type="button"
              className="members-search-clear"
              onClick={() => setNicknameQuery('')}
              aria-label="검색 초기화"
            >
              ✕
            </button>
          )}
        </div>
        <div className="members-sort-box">
          <label className="members-sort-label" htmlFor="members-sort">
            정렬
          </label>
          <select
            id="members-sort"
            className="members-sort-select"
            value={nicknameSort}
            onChange={(e) => setNicknameSort(e.target.value as NicknameSort)}
          >
            <option value="nickname-asc">닉네임 가나다순</option>
            <option value="nickname-desc">닉네임 역순</option>
            <option value="server-asc">서버별명 가나다순</option>
            <option value="server-desc">서버별명 역순</option>
          </select>
        </div>
        <span className="members-count-badge">
          {nicknameQuery
            ? `검색 ${filteredMembers.length}명 / 전체 ${approvedCount}명`
            : `전체 ${approvedCount}명`}
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>닉네임</th>
              <th>서버별명</th>
              <th>포지션</th>
              <th>역할</th>
              <th>KD</th>
              <th>승률</th>
              <th>의심지표</th>
              <th>처리</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={8} className="members-empty-row">
                  {nicknameQuery
                    ? `"${nicknameQuery}" 검색 결과가 없습니다.`
                    : '표시할 클랜원이 없습니다.'}
                </td>
              </tr>
            ) : (
              filteredMembers.map((m) => {
                const stats = Array.isArray(m.match_stats) ? m.match_stats[0] : m.match_stats;
                return (
                  <tr key={m.id}>
                    <td>{m.sudden_nickname ?? '-'}</td>
                    <td>{m.server_nickname}</td>
                    <td>{m.position ?? '-'}</td>
                    <td>
                      <select
                        value={m.role ?? ''}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        style={{
                          padding: '6px 8px',
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          color: 'var(--text)',
                          minWidth: '120px',
                        }}
                      >
                        <option value="">역할 선택</option>
                        {(roles.length > 0 ? roles : CLAN_ROLE_OPTIONS).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{syncingStats ? '...' : stats?.kd != null ? stats.kd : '-'}</td>
                    <td>
                      {syncingStats ? '...' : stats?.win_rate != null ? `${stats.win_rate}%` : '-'}
                    </td>
                    <td>
                      {syncingStats ? (
                        '...'
                      ) : stats?.suspicion_level ? (
                        <SuspicionBadge level={stats.suspicion_level} />
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-ghost"
                          onClick={() => syncStats(m.id)}
                          disabled={busy}
                          title="이 멤버만 전적 갱신"
                        >
                          ↻
                        </button>
                        <button
                          className="btn btn-warning"
                          onClick={() => {
                            const reason = prompt('경고 사유');
                            if (reason) handleAction(m.id, 'warn', { reason });
                          }}
                        >
                          경고
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => {
                            const reason = prompt('추방 사유');
                            if (reason) handleAction(m.id, 'kick', { reason });
                          }}
                        >
                          추방
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
