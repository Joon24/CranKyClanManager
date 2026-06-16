const BOT_API_URL = process.env.BOT_API_URL ?? 'http://localhost:3001';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? '';

function botHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-internal-secret': INTERNAL_SECRET,
  };
}

async function callBot<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BOT_API_URL}${path}`, {
    method: 'POST',
    headers: botHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        '봇 연동 인증 실패입니다. 봇이 실행 중인지, bot/.env와 web/.env.local의 INTERNAL_API_SECRET이 동일한지 확인해 주세요.'
      );
    }
    if (res.status === 404 || res.status === 502) {
      throw new Error('봇이 실행되지 않았습니다. npm run dev:bot 으로 봇을 먼저 실행해 주세요.');
    }
    const raw = (data as { error?: string }).error ?? 'Bot API 호출 실패';
    throw new Error(translateBotError(raw));
  }
  return data as T;
}

function translateBotError(message: string): string {
  if (message.includes('Missing Permissions') || message.includes('50013')) {
    if (message.includes('send') || message.includes('Send')) {
      return [
        'Discord 권한이 부족합니다.',
        '',
        '확인 사항:',
        '1. 봇 역할에 "메시지 보내기", "임베드 링크" 권한 활성화',
        '2. 해당 채널에서 봇에게 메시지 전송 권한이 있는지 확인',
        '3. 봇 역할이 채널 권한 제한보다 위에 있는지 확인',
      ].join('\n');
    }
    return [
      'Discord 권한이 부족합니다.',
      '',
      '확인 사항:',
      '1. 서버 설정 → 역할에서 봇 역할을 멤버 역할보다 위로 배치',
      '2. 봇 역할에 "별명 관리", "역할 관리", "멤버 차단" 권한 활성화',
      '3. 승인 대상이 봇보다 높은 역할을 가지고 있지 않은지 확인',
    ].join('\n');
  }
  return message;
}

export async function botGetRoles(): Promise<{ id: string; name: string; color: string }[]> {
  const res = await fetch(`${BOT_API_URL}/internal/roles`, {
    headers: botHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? '역할 목록 조회 실패');
  }
  return data as { id: string; name: string; color: string }[];
}

export interface BotClanMember {
  discordUserId: string;
  discordUsername: string;
  serverNickname: string;
  roleId: string;
}

export async function botGetClanMembers(): Promise<BotClanMember[]> {
  const res = await fetch(`${BOT_API_URL}/internal/clan-members`, {
    headers: botHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 404 || res.status === 502) {
      throw new Error('봇이 실행되지 않았습니다. npm run dev:bot 으로 봇을 먼저 실행해 주세요.');
    }
    throw new Error((data as { error?: string }).error ?? 'Discord 멤버 조회 실패');
  }
  return data as BotClanMember[];
}

export interface BotChannel {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  parentName: string | null;
  position: number;
}

export async function botGetChannels(): Promise<BotChannel[]> {
  const res = await fetch(`${BOT_API_URL}/internal/channels`, {
    headers: botHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 404 || res.status === 502) {
      throw new Error('봇이 실행되지 않았습니다. npm run dev:bot 으로 봇을 먼저 실행해 주세요.');
    }
    throw new Error((data as { error?: string }).error ?? '채널 목록 조회 실패');
  }
  return data as BotChannel[];
}

export async function botSendEmbed(params: {
  channelId: string;
  content?: string;
  embeds: Record<string, unknown>[];
  components?: Record<string, unknown>[];
  flags?: number;
}) {
  return callBot<{ messageId: string; channelId: string }>('/internal/send-embed', params);
}

export async function botApprove(params: {
  discordUserId: string;
  suddenNickname: string;
  position: string;
  age: number;
}) {
  return callBot<{
    serverNickname: string;
    dmSent: boolean;
    nicknameOk?: boolean;
    roleOk?: boolean;
    warnings?: string[];
  }>('/internal/approve', params);
}

export async function botReject(params: {
  discordUserId: string;
  suddenNickname: string;
  reason?: string;
}) {
  return callBot<{ dmSent: boolean }>('/internal/reject', params);
}

export async function botChangeRole(params: {
  discordUserId: string;
  roleId: string;
  previousRoleId?: string | null;
}) {
  return callBot<{ roleId: string; roleName: string }>('/internal/change-role', params);
}

export async function botBan(params: { discordUserId: string; reason?: string }) {
  return callBot<{ banned: boolean }>('/internal/ban', params);
}

export async function botUnban(params: { discordUserId: string }) {
  return callBot<{ unbanned: boolean }>('/internal/unban', params);
}
