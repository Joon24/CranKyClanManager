import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { sendWelcomeMessage } from '../src/handlers/welcomeMessage.js';

const guildId = process.env.DISCORD_GUILD_ID;
const token = process.env.DISCORD_BOT_TOKEN;

if (!guildId || !token) {
  console.error('Missing DISCORD_GUILD_ID or DISCORD_BOT_TOKEN');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(client.user!.id);
    await sendWelcomeMessage(member);
    console.log(`Test welcome card sent to channel ${process.env.DISCORD_WELCOME_CHANNEL_ID}`);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.destroy();
    process.exit(process.exitCode ?? 0);
  }
});

client.login(token);
