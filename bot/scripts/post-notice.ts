import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { syncNoticeChannel } from '../src/handlers/notice/postNotice.js';

const channelId = process.env.DISCORD_NOTICE_CHANNEL_ID;
const token = process.env.DISCORD_BOT_TOKEN;

if (!channelId || !token) {
  console.error('DISCORD_NOTICE_CHANNEL_ID or DISCORD_BOT_TOKEN missing');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const result = await syncNoticeChannel(client, channelId);
    console.log(`Notice ${result.action} in channel ${result.channelId} (message ${result.messageId})`);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.destroy();
    process.exit(process.exitCode ?? 0);
  }
});

client.login(token);
