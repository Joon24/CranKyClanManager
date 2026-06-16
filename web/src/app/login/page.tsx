'use client';

import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  OAuthCallback:
    'Discord 인증 중 SSL 오류가 발생했습니다. 개발 서버를 다시 시작한 뒤 재시도해 주세요.',
  AccessDenied:
    '관리자 권한이 없습니다. Discord 서버에서 관리자 역할이 지급된 계정으로 로그인해 주세요.',
  Configuration: '서버 인증 설정 오류입니다. DISCORD_CLIENT_SECRET 등 환경 변수를 확인해 주세요.',
  Default: '로그인에 실패했습니다. 다시 시도해 주세요.',
};

function LoginContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error');
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default)
    : null;

  return (
    <div className="login-page">
      <div className="login-card">
        <Image
          src="/cranky-logo.png"
          alt="CranKy Clan Manager"
          width={496}
          height={232}
          className="login-logo"
          priority
        />
        <p className="login-desc">관리자 Discord 계정으로 로그인하세요.</p>

        {errorMessage && (
          <p
            style={{
              color: 'var(--danger)',
              background: 'rgba(239,68,68,0.1)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '0.875rem',
              lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </p>
        )}

        <button
          className="btn btn-primary"
          onClick={() => signIn('discord', { callbackUrl: '/' })}
        >
          Discord 로그인
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
