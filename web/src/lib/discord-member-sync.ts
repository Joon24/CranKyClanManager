import { supabase, logActivity } from '@/lib/supabase';
import { botGetClanMembers } from '@/lib/bot-api';
import { getMercenaryRoleId } from '@/lib/discord-roles';
import {
  buildSuddenNicknameFromServer,
  isAutoGuessedSuddenNickname,
  parseServerNickname,
} from '@shared/types';
import type { Position } from '@shared/types';

export interface DiscordMemberSyncResult {
  total: number;
  created: number;
  updated: number;
  fixed: number;
  skipped: number;
  members: Array<{ discordUserId: string; serverNickname: string; roleId: string }>;
}

function resolveSuddenNickname(
  serverNickname: string,
  discordUsername: string,
  existingSudden: string | null | undefined
): string | null {
  const fromServer = buildSuddenNicknameFromServer(serverNickname);
  if (fromServer) return fromServer;

  if (existingSudden && !isAutoGuessedSuddenNickname(existingSudden, discordUsername)) {
    return existingSudden;
  }

  return null;
}

export async function syncDiscordClanMembers(adminName: string): Promise<DiscordMemberSyncResult> {
  const discordMembers = await botGetClanMembers();
  const mercenaryRoleId = getMercenaryRoleId();

  let created = 0;
  let updated = 0;
  let fixed = 0;
  let skipped = 0;
  const members: DiscordMemberSyncResult['members'] = [];

  for (const dm of discordMembers) {
    if (mercenaryRoleId && dm.roleId === mercenaryRoleId) {
      skipped++;
      continue;
    }

    const parsed = parseServerNickname(dm.serverNickname);
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('users')
      .select('id, status, sudden_nickname')
      .eq('discord_user_id', dm.discordUserId)
      .maybeSingle();

    const suddenNickname = resolveSuddenNickname(
      dm.serverNickname,
      dm.discordUsername,
      existing?.sudden_nickname
    );

    const wasBadGuess =
      existing?.sudden_nickname &&
      isAutoGuessedSuddenNickname(existing.sudden_nickname, dm.discordUsername);

    const row = {
      discord_user_id: dm.discordUserId,
      discord_username: dm.discordUsername,
      server_nickname: dm.serverNickname,
      sudden_nickname: suddenNickname,
      position: parsed.position as Position | null,
      age: parsed.age,
      role: dm.roleId,
      member_type: 'member' as const,
      status: 'approved' as const,
      updated_at: now,
    };

    if (existing) {
      const { error } = await supabase.from('users').update(row).eq('id', existing.id);
      if (error) {
        skipped++;
        continue;
      }
      updated++;
      if (wasBadGuess && suddenNickname) fixed++;
      else if (wasBadGuess && !suddenNickname) fixed++;
    } else {
      const { error } = await supabase.from('users').insert({
        ...row,
        created_at: now,
      });
      if (error) {
        skipped++;
        continue;
      }
      created++;
    }

    members.push({
      discordUserId: dm.discordUserId,
      serverNickname: dm.serverNickname,
      roleId: dm.roleId,
    });
  }

  await logActivity(
    'Discord 클랜원 동기화',
    `신규 ${created}명 · 갱신 ${updated}명 · 닉 수정 ${fixed}명 · Discord ${discordMembers.length}명`,
    undefined,
    adminName
  );

  return {
    total: discordMembers.length,
    created,
    updated,
    fixed,
    skipped,
    members,
  };
}
