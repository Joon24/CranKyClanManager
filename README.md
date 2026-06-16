# CranKy Clan Manager

Discord Bot + Web Admin + Supabase 기반 CranKy 클랜 통합 관리 시스템입니다.

## 구성

| 구성요소 | 기술 스택 | 역할 |
|---------|----------|------|
| Discord Bot | Node.js + discord.js v14 | 가입 신청 모달, 인증 채널 안내 |
| Web Admin | Next.js 15 + NextAuth | 관리자 대시보드, 승인/거절 처리 |
| Database | Supabase PostgreSQL | 신청자, 유저, 전적, 로그 저장 |
| Nexon Open API | REST | 전적 조회, 핵 의심 참고 지표 |

## 가입 신청 흐름

1. 유저가 인증 채널에서 **신청하기** 버튼 클릭
2. 모달에 닉네임, 나이, 포지션(S/R/M), 접속시간, 이전클랜/가입경로 입력
3. DB에 `pending` 상태로 저장
4. 관리자 웹에서 승인 클릭
5. 서버 별명 자동 변경 (`닉네임M/30` 형식)
6. 인증완료 역할 지급
7. 신청자 DM 발송
8. 관리자 로그 웹훅 알림

## 프로젝트 구조

```text
CranKyClanManager/
├── bot/                  # Discord Bot
├── web/                  # Next.js Web Admin
├── shared/               # 공유 타입
└── supabase/migrations/  # DB 스키마
```

## 시작하기

### 1. Supabase 설정

```bash
# supabase/migrations/001_initial_schema.sql 을 Supabase SQL Editor에서 실행
```

### 2. Discord 설정

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 Bot + OAuth2 앱 생성
2. Bot 권한: `Manage Nicknames`, `Manage Roles`, `Send Messages`
3. 봇 역할을 인증완료 역할보다 **위**에 배치
4. OAuth2 Redirect URL: `http://localhost:3000/api/auth/callback/discord`

### 3. 환경 변수

```bash
cp bot/.env.example bot/.env
cp web/.env.example web/.env.local
# 각 파일에 토큰/키 입력
```

### 4. 설치 및 실행

```bash
npm install
npm run dev:bot    # Discord Bot
npm run dev:web    # Web Admin (http://localhost:3000)
```

## Web Admin 메뉴

- **Dashboard** — 총 인원, 승인 대기, 오늘 가입자, 경고 누적자, 핵 의심 검토 대상
- **가입 신청 관리** — 승인 / 거절 / 보류 / 블랙리스트
- **클랜원 관리** — 등급 변경, 경고, 추방
- **전적 조회** — KD, 승률, 계급, 최근 경기
- **팀 밸런스** — KD/포지션/티어 기준 5:5 자동 분배
- **로그** — 가입/승인/경고/관리자 조작 로그

## 핵 의심 지표 (참고용)

공식 제재 확인이 **아닙니다**. 다음 지표를 참고용으로만 표시합니다.

- 🟢 정상
- 🟡 주의
- 🔴 검토 필요

## 배포

- **Web**: Vercel
- **Bot**: Railway / VPS
- **DB**: Supabase Cloud

## 주의사항

- 봇에게 `Manage Nicknames` 권한 필요
- 봇 역할이 대상 멤버 역할보다 위에 있어야 별명 변경 가능
- 서버 관리자보다 높은 권한의 유저는 별명 변경 불가
