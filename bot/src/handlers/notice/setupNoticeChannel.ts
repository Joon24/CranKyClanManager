import type { Client } from 'discord.js';
import { config } from '../../config.js';
import { syncNoticeChannel } from './postNotice.js';

export async function setupNoticeChannel(client: Client) {
  if (!config.noticeChannelId) {
    console.warn('Notice channel ID not configured');
    return;
  }

  try {
    const result = await syncNoticeChannel(client, config.noticeChannelId);
    console.log(
      result.action === 'updated'
        ? 'Notice channel message updated'
        : 'Notice channel message posted'
    );
  } catch (error) {
    console.error('Notice channel setup failed:', error);
  }
}
