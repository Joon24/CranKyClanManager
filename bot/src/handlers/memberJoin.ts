import type { GuildMember } from 'discord.js';
import { supabase, logActivity } from '../db/supabase.js';
import { webhook } from '../services/webhook.js';
import { config } from '../config.js';
import { isBlacklisted, banMember } from '../services/blacklist.js';
import { assignUnverifiedRole, stripClanRoles } from '../services/discord-actions.js';
import { sendWelcomeMessage } from './welcomeMessage.js';

export async function handleMemberJoin(member: GuildMember) {
  if (member.guild.id !== config.guildId) return;
  if (member.user.bot) return;

  const blocked = await isBlacklisted(member.id);
  if (blocked) {
    const { data: user } = await supabase
      .from('users')
      .select('id, sudden_nickname, blacklist_reason')
      .eq('discord_user_id', member.id)
      .eq('status', 'blocked')
      .maybeSingle();

    const reason = user?.blacklist_reason ?? '블랙리스트 재입장 차단';

    try {
      await banMember(member.client, member.id, `블랙리스트: ${reason}`);
    } catch (error) {
      console.error('Blacklist rejoin ban failed:', error);
      try {
        await member.kick(`블랙리스트: ${reason}`);
      } catch (kickError) {
        console.error('Blacklist rejoin kick failed:', kickError);
      }
    }

    await webhook.blacklistRejoinBlocked([
      { name: '유저ID', value: member.id, inline: true },
      { name: '닉네임', value: user?.sudden_nickname ?? member.user.username, inline: true },
      { name: '사유', value: reason, inline: false },
    ]);

    await logActivity(
      '블랙리스트 재입장 차단',
      `${member.user.username} (${member.id}) - ${reason}`,
      user?.id,
      'Discord Bot'
    );

    console.log(`Blacklisted user blocked on join: ${member.id}`);
    return;
  }

  const { data: approvedUser } = await supabase
    .from('users')
    .select('id, sudden_nickname, server_nickname')
    .eq('discord_user_id', member.id)
    .eq('status', 'approved')
    .maybeSingle();

  if (approvedUser) {
    try {
      await stripClanRoles(member);
    } catch (error) {
      console.error('Clan role strip on rejoin error:', error);
    }

    const leftAt = new Date().toISOString();
    await supabase
      .from('users')
      .update({ status: 'left', updated_at: leftAt })
      .eq('id', approvedUser.id);

    const nickname = approvedUser.sudden_nickname ?? approvedUser.server_nickname ?? member.user.username;
    await logActivity(
      '재입장 미인증 처리',
      `${nickname} - 승인 상태 해제, 미인증 대기`,
      approvedUser.id,
      'Discord Bot'
    );
  }

  try {
    await assignUnverifiedRole(member);
  } catch (error) {
    console.error('Unverified role assign error:', error);
  }

  try {
    await sendWelcomeMessage(member);
  } catch (error) {
    console.error('Welcome message error:', error);
  }
}
