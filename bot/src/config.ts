import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function optional(...names: string[]): string {
  for (const name of names) {
    if (process.env[name]) return process.env[name]!;
  }
  return '';
}

export const config = {
  discordToken: required('DISCORD_BOT_TOKEN'),
  guildId: required('DISCORD_GUILD_ID'),
  authChannelId: required('DISCORD_AUTH_CHANNEL_ID'),
  memberRoleId: required('DISCORD_MEMBER_ROLE_ID', process.env.DISCORD_VERIFIED_ROLE_ID),
  enthusiastRoleId: optional('DISCORD_ENTHUSIAST_ROLE_ID') || '1489852005005656064',
  staffRoleId: optional('DISCORD_STAFF_ROLE_ID') || '1489797598133882910',
  mercenaryRoleId: optional('DISCORD_MERCENARY_ROLE_ID'),
  supabaseUrl: required('SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  // Backward-compat (기존 단일 웹훅)
  webhookUrl: optional('DISCORD_WEBHOOK_URL', 'DISCORD_ADMIN_WEBHOOK_URL'),
  // 3분리 웹훅
  joinWebhookUrl: optional('DISCORD_JOIN_WEBHOOK_URL'),
  kickWebhookUrl: optional('DISCORD_KICK_WEBHOOK_URL'),
  leaveWebhookUrl: optional('DISCORD_LEAVE_WEBHOOK_URL'),
  nexonApiKey: optional('NEXON_OPEN_API_KEY'),
  statusReportChannelId: optional('STATUS_REPORT_CHANNEL_ID'),
  botApiPort: parseInt(process.env.BOT_API_PORT ?? '3001', 10),
  internalApiSecret: required('INTERNAL_API_SECRET'),
};
