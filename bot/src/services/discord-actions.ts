import { GuildMember, PermissionFlagsBits, type Client, type Guild } from 'discord.js';
import { buildServerNickname, type Position } from '../types/index.js';
import { config } from '../config.js';

class DiscordActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscordActionError';
  }
}

function resolveUnverifiedRole(guild: Guild) {
  const byId = guild.roles.cache.get(config.unverifiedRoleId);
  if (byId) return byId;
  return guild.roles.cache.find((role) => role.name === '미인증') ?? null;
}

function canBotManageRole(botMember: GuildMember, targetRoleId: string) {
  const targetRole = botMember.guild.roles.cache.get(targetRoleId);
  if (!targetRole) return { ok: false, reason: '역할을 찾을 수 없습니다.' };
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { ok: false, reason: '봇에 "역할 관리" 권한이 없습니다.' };
  }
  if (targetRole.position >= botMember.roles.highest.position) {
    return { ok: false, reason: `역할 "${targetRole.name}"이(가) 봇 역할보다 높습니다.` };
  }
  return { ok: true, role: targetRole };
}

export async function assignUnverifiedRole(member: GuildMember) {
  if (member.user.bot) return { assigned: false, reason: 'bot' };

  const unverifiedRole = resolveUnverifiedRole(member.guild);
  if (!unverifiedRole) {
    console.warn('[roles] 미인증 역할을 찾을 수 없습니다.');
    return { assigned: false, reason: 'not_found' };
  }

  if (member.roles.cache.has(unverifiedRole.id)) {
    return { assigned: false, reason: 'already_has' };
  }

  const botMember = await member.guild.members.fetchMe();
  const check = canBotManageRole(botMember, unverifiedRole.id);
  if (!check.ok) {
    console.warn(`[roles] 미인증 역할 부여 실패: ${check.reason}`);
    return { assigned: false, reason: check.reason };
  }

  await member.roles.add(unverifiedRole.id);
  console.log(`[roles] 미인증 역할 부여: ${member.user.tag}`);
  return { assigned: true };
}

export async function removeUnverifiedRole(member: GuildMember) {
  const unverifiedRole = resolveUnverifiedRole(member.guild);
  if (!unverifiedRole || !member.roles.cache.has(unverifiedRole.id)) {
    return { removed: false };
  }

  const botMember = await member.guild.members.fetchMe();
  const check = canBotManageRole(botMember, unverifiedRole.id);
  if (!check.ok) {
    console.warn(`[roles] 미인증 역할 제거 실패: ${check.reason}`);
    return { removed: false, reason: check.reason };
  }

  await member.roles.remove(unverifiedRole.id);
  console.log(`[roles] 미인증 역할 제거: ${member.user.tag}`);
  return { removed: true };
}

export async function stripClanRoles(member: GuildMember) {
  const clanRoleIds = [
    config.memberRoleId,
    config.enthusiastRoleId,
    config.staffRoleId,
    config.mercenaryRoleId,
  ].filter(Boolean);

  const rolesToRemove = clanRoleIds.filter((roleId) => member.roles.cache.has(roleId));
  if (rolesToRemove.length === 0) return { removed: false };

  const botMember = await member.guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    console.warn('[roles] 클랜 역할 제거 실패: 봇에 "역할 관리" 권한이 없습니다.');
    return { removed: false, reason: 'no_permission' };
  }

  const removable = rolesToRemove.filter((roleId) => {
    const role = member.guild.roles.cache.get(roleId);
    return role && role.position < botMember.roles.highest.position;
  });

  if (removable.length === 0) return { removed: false };

  await member.roles.remove(removable);
  console.log(`[roles] 클랜 역할 제거: ${member.user.tag}`);
  return { removed: true, roleIds: removable };
}

function formatDiscordError(error: unknown, action: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('Missing Permissions') || raw.includes('50013')) {
    return `${action} 실패: Discord 권한이 부족합니다. 서버 설정 → 역할에서 봇 역할을 지급할 역할보다 위로 올리고, "별명 관리"·"역할 관리" 권한을 켜 주세요.`;
  }
  if (raw.includes('Unknown Member') || raw.includes('10007')) {
    return `${action} 실패: 해당 유저가 Discord 서버에 없습니다.`;
  }
  return `${action} 실패: ${raw}`;
}

export async function approveMember(
  client: Client,
  discordUserId: string,
  suddenNickname: string,
  position: Position,
  age: number,
  options?: {
    roleId?: string;
    joinType?: 'member' | 'mercenary';
    serverNicknameOverride?: string;
  }
) {
  const guild = await client.guilds.fetch(config.guildId);
  const member = (await guild.members.fetch(discordUserId)) as GuildMember;
  const botMember = await guild.members.fetchMe();
  const serverNickname =
    options?.serverNicknameOverride ?? buildServerNickname(suddenNickname, position, age);
  const roleId = options?.roleId ?? config.memberRoleId;
  const memberRole = guild.roles.cache.get(roleId);

  const issues: string[] = [];
  let nicknameOk = false;
  let roleOk = false;

  const canManageNick = botMember.permissions.has(PermissionFlagsBits.ManageNicknames);
  const canManageRoles = botMember.permissions.has(PermissionFlagsBits.ManageRoles);
  const botHighest = botMember.roles.highest.position;
  const targetHighest = member.roles.highest.position;
  const isOwner = member.id === guild.ownerId;

  if (!canManageNick) {
    issues.push('봇에 "별명 관리" 권한이 없습니다.');
  } else if (!isOwner && targetHighest >= botHighest) {
    issues.push(
      '대상 멤버의 역할이 봇보다 높거나 같아 별명을 바꿀 수 없습니다. (봇 역할을 서버 설정에서 더 위로 올려주세요)'
    );
  } else {
    try {
      await member.setNickname(serverNickname);
      nicknameOk = true;
    } catch (error) {
      issues.push(formatDiscordError(error, '별명 변경'));
    }
  }

  if (!memberRole) {
    issues.push(
      `역할을 찾을 수 없습니다. 역할 ID(${roleId})를 확인하세요.`
    );
  } else if (!canManageRoles) {
    issues.push('봇에 "역할 관리" 권한이 없습니다.');
  } else if (memberRole.position >= botHighest) {
    issues.push(
      `지급할 역할 "${memberRole.name}"이(가) 봇 역할보다 높습니다. 봇 역할을 "${memberRole.name}"보다 위로 올려주세요.`
    );
  } else {
    try {
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(roleId);
      }
      roleOk = true;
    } catch (error) {
      issues.push(formatDiscordError(error, '역할 지급'));
    }
  }

  try {
    const unverifiedResult = await removeUnverifiedRole(member);
    if (unverifiedResult.reason) {
      issues.push(`미인증 역할 제거 실패: ${unverifiedResult.reason}`);
    }
  } catch (error) {
    issues.push(formatDiscordError(error, '미인증 역할 제거'));
  }

  if (!nicknameOk && !roleOk) {
    throw new DiscordActionError(issues.join('\n'));
  }

  const isMercenary = options?.joinType === 'mercenary';
  const dmContent = isMercenary
    ? [
        `안녕하세요, ${suddenNickname}님.`,
        '',
        '⚔️ 용병 신청이 자동 승인되었습니다.',
        nicknameOk
          ? `서버 별명이 ${serverNickname} 으로 변경되었습니다.`
          : '서버 별명 변경은 실패했습니다. 관리자에게 문의해 주세요.',
        roleOk ? '용병 역할이 지급되었습니다.' : '역할 지급은 실패했습니다. 관리자에게 문의해 주세요.',
        '미인증 역할이 해제되었습니다.',
        '',
        '즐거운 활동 부탁드립니다.',
      ].join('\n')
    : [
        `안녕하세요, ${suddenNickname}님.`,
        '',
        '가입 신청이 승인되었습니다.',
        nicknameOk
          ? `서버 별명이 ${serverNickname} 으로 변경되었습니다.`
          : `서버 별명 변경은 실패했습니다. 관리자에게 문의해 주세요.`,
        roleOk ? '멤버 역할이 지급되었습니다.' : '멤버 역할 지급은 실패했습니다. 관리자에게 문의해 주세요.',
        '미인증 역할이 해제되었습니다.',
        '',
        '즐거운 활동 부탁드립니다.',
      ].join('\n');

  let dmSent = false;
  try {
    await member.send(dmContent);
    dmSent = true;
  } catch (err) {
    console.warn(`DM failed for ${discordUserId}:`, err);
  }

  return {
    serverNickname,
    dmSent,
    nicknameOk,
    roleOk,
    roleId,
    warnings: issues.length > 0 ? issues : undefined,
  };
}

export async function rejectMemberDm(
  client: Client,
  discordUserId: string,
  suddenNickname: string,
  reason?: string
) {
  const guild = await client.guilds.fetch(config.guildId);
  const member = await guild.members.fetch(discordUserId);

  const content = [
    `안녕하세요, ${suddenNickname}님.`,
    '',
    '가입 신청이 거절되었습니다.',
    reason ? `사유: ${reason}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await member.send(content);
    return { dmSent: true };
  } catch (err) {
    console.warn(`Reject DM failed for ${discordUserId}:`, err);
    return { dmSent: false };
  }
}

export async function getGuildRoles(client: Client) {
  const guild = await client.guilds.fetch(config.guildId);
  const roles = await guild.roles.fetch();

  const botMember = await guild.members.fetch(client.user!.id);
  const botHighest = botMember.roles.highest.position;

  return [...roles.values()]
    .filter((r) => r.id !== guild.id && !r.managed && r.position < botHighest)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));
}

export async function changeMemberRole(
  client: Client,
  discordUserId: string,
  newRoleId: string,
  previousRoleId?: string | null
) {
  const guild = await client.guilds.fetch(config.guildId);
  const member = await guild.members.fetch(discordUserId);

  if (previousRoleId && member.roles.cache.has(previousRoleId)) {
    await member.roles.remove(previousRoleId);
  }

  await member.roles.add(newRoleId);

  const role = guild.roles.cache.get(newRoleId);
  return { roleId: newRoleId, roleName: role?.name ?? newRoleId };
}

export interface ClanMemberSnapshot {
  discordUserId: string;
  discordUsername: string;
  serverNickname: string;
  roleId: string;
}

export async function listClanMembers(client: Client): Promise<ClanMemberSnapshot[]> {
  const guild = await client.guilds.fetch(config.guildId);
  await guild.members.fetch();

  const clanRoleIds = new Set(
    [config.staffRoleId, config.enthusiastRoleId, config.memberRoleId].filter(Boolean)
  );
  const rolePriority = [config.staffRoleId, config.enthusiastRoleId, config.memberRoleId].filter(
    Boolean
  );

  const results: ClanMemberSnapshot[] = [];

  for (const member of guild.members.cache.values()) {
    if (member.user.bot) continue;
    if (config.mercenaryRoleId && member.roles.cache.has(config.mercenaryRoleId)) continue;

    const hasClanRole = member.roles.cache.some((r) => clanRoleIds.has(r.id));
    if (!hasClanRole) continue;

    const roleId = rolePriority.find((id) => member.roles.cache.has(id)) ?? config.memberRoleId;

    results.push({
      discordUserId: member.id,
      discordUsername: member.user.username,
      serverNickname: member.nickname ?? member.user.username,
      roleId,
    });
  }

  return results.sort((a, b) => a.serverNickname.localeCompare(b.serverNickname, 'ko'));
}
