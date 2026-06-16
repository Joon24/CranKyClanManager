'use client';

import { useEffect, useMemo, useState } from 'react';
import { POSITION_META, type Position } from '@shared/types';
import { getCompositionHint } from '@/lib/team-balance';

interface Member {
  id: string;
  sudden_nickname: string | null;
  server_nickname?: string | null;
  position: string;
  match_stats: { kd: number; tier_name: string } | { kd: number; tier_name: string }[] | null;
}

interface LobbyResult {
  quickType: string;
  label: string;
  teamA: Member[];
  teamB: Member[];
  totalA: number;
  totalB: number;
  composition: string;
}

interface BalanceResult {
  lobbies: LobbyResult[];
  reserve: Member[];
  planSummary: string;
}

const MODES = [
  { key: 'kd' as const, label: 'KD 기준', icon: '🎯', desc: '최근 전적 KD' },
  {
    key: 'position' as const,
    label: '포지션 기준',
    icon: '🎖️',
    desc: 'S 스나 · R 라플 · M 멀티 · T 특총',
  },
  { key: 'tier' as const, label: '티어 기준', icon: '⭐', desc: '시즌 티어' },
];

function getPositionColor(position: string) {
  if (position in POSITION_META) {
    return POSITION_META[position as Position].color;
  }
  return '#6b7280';
}

function getPositionName(position: string) {
  if (position in POSITION_META) {
    return POSITION_META[position as Position].name;
  }
  return position;
}

function LobbyVsCard({ lobby }: { lobby: LobbyResult }) {
  const totalScore = lobby.totalA + lobby.totalB;
  const balancePct = totalScore > 0 ? Math.round((lobby.totalA / totalScore) * 100) : 50;

  return (
    <div className="team-lobby-card">
      <div className="team-vs-header">
        <h3>{lobby.label}</h3>
        <p className="team-composition-result">{lobby.composition}</p>
        <div className="team-balance-bar">
          <div className="team-bar-a" style={{ width: `${balancePct}%` }} />
          <div className="team-bar-b" style={{ width: `${100 - balancePct}%` }} />
        </div>
        <div className="team-balance-labels">
          <span className="team-label-a">A {balancePct}%</span>
          <span className="team-label-b">B {100 - balancePct}%</span>
        </div>
      </div>

      <div className="team-vs-grid">
        <div className="team-vs-box team-vs-a">
          <div className="team-vs-title">
            <span className="team-vs-icon">🔵</span>
            Team A
            <span className="team-vs-score">{lobby.totalA}</span>
          </div>
          <ul className="team-vs-list">
            {lobby.teamA.map((m, i) => (
              <li key={m.id}>
                <span className="team-slot">#{i + 1}</span>
                <span
                  className="team-pos-mini"
                  style={{ color: getPositionColor(m.position) }}
                >
                  {m.position}
                </span>
                {m.sudden_nickname ?? '-'}
              </li>
            ))}
          </ul>
        </div>

        <div className="team-vs-divider">
          <span>VS</span>
        </div>

        <div className="team-vs-box team-vs-b">
          <div className="team-vs-title">
            <span className="team-vs-icon">🔴</span>
            Team B
            <span className="team-vs-score">{lobby.totalB}</span>
          </div>
          <ul className="team-vs-list">
            {lobby.teamB.map((m, i) => (
              <li key={m.id}>
                <span className="team-slot">#{i + 1}</span>
                <span
                  className="team-pos-mini"
                  style={{ color: getPositionColor(m.position) }}
                >
                  {m.position}
                </span>
                {m.sudden_nickname ?? '-'}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function TeamBalancePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'kd' | 'position' | 'tier'>('kd');
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [balancing, setBalancing] = useState(false);

  useEffect(() => {
    fetch('/api/members')
      .then((r) => r.json())
      .then((data) =>
        setMembers(
          data.filter(
            (m: { status: string; member_type?: string }) =>
              m.status === 'approved' &&
              (m.member_type === 'member' || !m.member_type)
          )
        )
      );
  }, []);

  const getStats = (m: Member) =>
    Array.isArray(m.match_stats) ? m.match_stats[0] : m.match_stats;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setResult(null);
  };

  const selectAll = () => {
    setSelected(new Set(members.map((m) => m.id)));
    setResult(null);
  };

  const clearAll = () => {
    setSelected(new Set());
    setResult(null);
  };

  const compositionHint = useMemo(
    () => getCompositionHint(selected.size),
    [selected.size]
  );

  const selectedMembers = useMemo(
    () => members.filter((m) => selected.has(m.id)),
    [members, selected]
  );

  const positionSummary = useMemo(() => {
    const counts = { S: 0, R: 0, M: 0, T: 0 };
    for (const m of selectedMembers) {
      const p = m.position as keyof typeof counts;
      if (p in counts) counts[p]++;
    }
    return counts;
  }, [selectedMembers]);

  const balance = async () => {
    setBalancing(true);
    try {
      const res = await fetch('/api/team-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, memberIds: [...selected] }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else alert(data.error);
    } finally {
      setBalancing(false);
    }
  };

  const canBalance = selected.size >= 6;

  return (
    <div className="team-page">
      <header className="team-hero">
        <div>
          <p className="dash-hero-badge">Team Balance</p>
          <h1 className="dash-hero-title">팀 밸런스</h1>
          <p className="dash-hero-sub">
            클랜전 퀵(33·44·55) 자동 구성 · 인원 제한 없음 · 홀수는 대기 처리
          </p>
        </div>
        <div className="team-hero-badge-count">
          <span className="team-count-num">{selected.size}</span>
          <span className="team-count-label">명 선택됨</span>
        </div>
      </header>

      <section className="team-modes">
        {MODES.map((m) => (
          <button
            key={m.key}
            className={`team-mode-card ${mode === m.key ? 'team-mode-active' : ''}`}
            onClick={() => {
              setMode(m.key);
              setResult(null);
            }}
          >
            <span className="team-mode-icon">{m.icon}</span>
            <span className="team-mode-label">{m.label}</span>
            <span className="team-mode-desc">{m.desc}</span>
          </button>
        ))}
      </section>

      <section className="team-composition-guide">
        <h3>📋 클랜전 퀵 포지션 규칙</h3>
        <ul>
          <li><strong>33 (3v3 · 6명)</strong> — 팀당 S 1 + R/M/T 2</li>
          <li><strong>44 (4v4 · 8명)</strong> — 팀당 S 1 · M 1 + R/T 2</li>
          <li><strong>55 (5v5 · 10명)</strong> — 팀당 S 2 + R/M/T 3</li>
        </ul>
        <p className="team-composition-note">
          예: 32명 → 33×1 · 44×2 · 55×1 &nbsp;|&nbsp; 12명 → 33×2
        </p>
        {selected.size > 0 && (
          <p className="team-composition-status">
            선택 {selected.size}명 · S {positionSummary.S} / R {positionSummary.R} / M{' '}
            {positionSummary.M} / T {positionSummary.T}
            {compositionHint ? ` · ${compositionHint}` : ' · 6명 미만 — 분배 불가'}
          </p>
        )}
      </section>

      <section className="team-panel">
        <div className="team-panel-header">
          <h2>👥 클랜원 선택</h2>
          <div className="team-select-actions">
            <button className="team-link-btn" onClick={selectAll}>
              전체 선택
            </button>
            <button className="team-link-btn" onClick={clearAll}>
              선택 해제
            </button>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="team-empty">승인된 클랜원이 없습니다.</div>
        ) : (
          <div className="team-member-grid">
            {members.map((m) => {
              const stats = getStats(m);
              const isSelected = selected.has(m.id);
              const posColor = getPositionColor(m.position);
              return (
                <button
                  key={m.id}
                  className={`team-member-card ${isSelected ? 'team-member-selected' : ''}`}
                  onClick={() => toggle(m.id)}
                >
                  <div
                    className="team-member-pos"
                    style={{ color: posColor, borderColor: posColor }}
                    title={getPositionName(m.position)}
                  >
                    {m.position || '-'}
                  </div>
                  <div className="team-member-info">
                    <strong>{m.sudden_nickname ?? m.server_nickname ?? '-'}</strong>
                    <span>
                      {getPositionName(m.position)} · KD {stats?.kd ?? '-'} ·{' '}
                      {stats?.tier_name ?? '티어 미확인'}
                    </span>
                  </div>
                  <div className={`team-check ${isSelected ? 'team-check-on' : ''}`}>
                    {isSelected ? '✓' : ''}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button
          className="team-balance-btn"
          onClick={balance}
          disabled={!canBalance || balancing}
        >
          {balancing ? '분배 중...' : `⚔️ 자동 분배 (${selected.size}명)`}
        </button>
      </section>

      {result && (
        <section className="team-result-section">
          <div className="team-vs-header">
            <h2>분배 결과</h2>
            <p className="team-composition-result">{result.planSummary}</p>
          </div>

          {result.lobbies.map((lobby) => (
            <LobbyVsCard key={lobby.label} lobby={lobby} />
          ))}

          {result.reserve.length > 0 && (
            <div className="team-reserve-panel">
              <h3>⏸️ 대기 ({result.reserve.length}명)</h3>
              <p className="team-composition-note">
                홀수 인원 또는 로비 구성 후 남은 멤버입니다.
              </p>
              <ul className="team-vs-list">
                {result.reserve.map((m) => (
                  <li key={m.id}>
                    <span
                      className="team-pos-mini"
                      style={{ color: getPositionColor(m.position) }}
                    >
                      {m.position || '-'}
                    </span>
                    {m.sudden_nickname ?? '-'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
