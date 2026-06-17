import { REST, Routes, type Client } from 'discord.js';
import { config } from '../config.js';
import { saCommandData } from './sa.data.js';
import { noticeCommandData } from './notice.data.js';

export async function registerSlashCommands(client: Client<true>) {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  try {
    console.log('🔄 슬래시 커맨드 등록 중...');
    await rest.put(Routes.applicationGuildCommands(client.user.id, config.guildId), {
      body: [saCommandData.toJSON(), noticeCommandData.toJSON()],
    });
    console.log(`✅ 길드 커맨드 등록 완료 (GUILD_ID=${config.guildId})`);
  } catch (err) {
    console.error('❌ 커맨드 등록 실패:', err);
  }
}
