import type { Client } from 'discord.js';
import { supabase } from '../db/supabase.js';
import { config } from '../config.js';

export async function isBlacklisted(discordUserId: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('discord_user_id', discordUserId)
    .eq('status', 'blocked')
    .maybeSingle();

  return !!data;
}

export async function banMember(client: Client, discordUserId: string, reason: string) {
  const guild = await client.guilds.fetch(config.guildId);
  await guild.members.ban(discordUserId, {
    reason: reason.slice(0, 512),
    deleteMessageSeconds: 0,
  });
  return { banned: true };
}

export async function unbanMember(client: Client, discordUserId: string) {
  const guild = await client.guilds.fetch(config.guildId);
  await guild.bans.remove(discordUserId);
  return { unbanned: true };
}
