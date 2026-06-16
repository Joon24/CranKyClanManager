'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const NAV_GROUPS = [
  {
    label: '메인',
    links: [{ href: '/dashboard', label: '대시보드', icon: '🏠', accent: '#3b82f6' }],
  },
  {
    label: '클랜 관리',
    links: [
      { href: '/applications', label: '가입 신청 관리', icon: '📋', accent: '#8b5cf6' },
      { href: '/members', label: '클랜원 관리', icon: '👥', accent: '#22c55e' },
      { href: '/mercenaries', label: '용병 관리', icon: '⚔️', accent: '#f59e0b' },
      { href: '/departed', label: '탈퇴자 관리', icon: '🚪', accent: '#ef4444' },
    ],
  },
  {
    label: '도구',
    links: [
      { href: '/stats', label: '전적 조회', icon: '📊', accent: '#0ea5e9' },
      { href: '/team-balance', label: '팀 밸런스', icon: '⚖️', accent: '#f97316' },
      { href: '/embed', label: '임베드', icon: '💬', accent: '#5865f2' },
      { href: '/logs', label: '활동 로그', icon: '🕐', accent: '#14b8a6' },
    ],
  },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const displayName = session?.user?.name ?? '관리자';
  const avatarUrl = session?.user?.image;
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sidebar-glow" aria-hidden />

      <header className="sidebar-brand">
        <Link href="/" className="sidebar-brand-link">
          <Image
            src="/cranky-logo.png"
            alt="CranKy Clan Manager"
            width={496}
            height={232}
            className="sidebar-brand-logo"
            sizes="260px"
            priority
          />
        </Link>
      </header>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="sidebar-group">
            <span className="sidebar-group-label">{group.label}</span>
            <div className="sidebar-group-links">
              {group.links.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`sidebar-link ${active ? 'sidebar-link-active' : ''}`}
                    style={{ '--link-accent': link.accent } as React.CSSProperties}
                  >
                    <span className="sidebar-link-icon">{link.icon}</span>
                    <span className="sidebar-link-label">{link.label}</span>
                    {active && <span className="sidebar-link-dot" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <footer className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar-wrap">
            <div className="sidebar-user-avatar">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="sidebar-user-avatar-img" />
              ) : (
                userInitial
              )}
            </div>
            <span className="sidebar-user-status-dot" aria-hidden />
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{displayName}</span>
            <span className="sidebar-user-status">온라인</span>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-logout"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <span>🚪</span>
          로그아웃
        </button>
      </footer>
    </aside>
  );
}
