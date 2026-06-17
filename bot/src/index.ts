import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import { setupAuthChannel } from './handlers/setupAuthChannel.js';
import { setupNoticeChannel } from './handlers/notice/setupNoticeChannel.js';
import { isApplyButton, buildApplyModal, isApplyModal } from './handlers/applyModal.js';
import { handleApplyModalSubmit } from './handlers/applySubmit.js';
import {
  isMercenaryButton,
  isMercenaryInviterSelect,
  isMercenaryModal,
} from './handlers/mercenaryModal.js';
import {
  handleMercenaryButton,
  handleMercenaryInviterSelect,
  handleMercenaryModalSubmit,
} from './handlers/mercenarySubmit.js';
import { handleMemberLeave } from './handlers/memberLeave.js';
import { handleMemberJoin } from './handlers/memberJoin.js';
import { startInternalApi } from './server/internal-api.js';
import { registerSlashCommands } from './commands/registerCommands.js';
import { preloadMeta } from './api/suddenApi.js';
import {
  handleNoticeConfirm,
  handleNoticeEditButton,
  handleNoticeEditModal,
  handleNoticeEditSelect,
  isNoticeConfirmButton,
  isNoticeEditButton,
  isNoticeEditModal,
  isNoticeEditSelect,
} from './handlers/notice/handlers.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.GuildMember],
});

// Railway 헬스체크: Discord 로그인 전에 Internal API를 먼저 띄움
startInternalApi(client);

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot ready: ${c.user.tag}`);
  await setupAuthChannel(client);
  await setupNoticeChannel(client);
  await registerSlashCommands(c);
  if (config.nexonApiKey) {
    await preloadMeta().catch((err) => console.error('Meta preload error:', err));
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await handleMemberJoin(member);
  } catch (error) {
    console.error('Member join handler error:', error);
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    await handleMemberLeave(member);
  } catch (error) {
    console.error('Member leave handler error:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'sa') {
      const { executeSaCommand } = await import('./commands/sa.js');
      await executeSaCommand(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === '공지사항') {
      const { executeNoticeCommand } = await import('./commands/notice.js');
      await executeNoticeCommand(interaction);
      return;
    }

    if (interaction.isButton() && isApplyButton(interaction.customId)) {
      await interaction.showModal(buildApplyModal());
      return;
    }

    if (interaction.isButton() && isMercenaryButton(interaction.customId)) {
      await handleMercenaryButton(interaction);
      return;
    }

    if (interaction.isButton() && isNoticeConfirmButton(interaction.customId)) {
      await handleNoticeConfirm(interaction);
      return;
    }

    if (interaction.isButton() && isNoticeEditButton(interaction.customId)) {
      await handleNoticeEditButton(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && isNoticeEditSelect(interaction.customId)) {
      await handleNoticeEditSelect(interaction);
      return;
    }

    if (interaction.isUserSelectMenu() && isMercenaryInviterSelect(interaction.customId)) {
      await handleMercenaryInviterSelect(interaction);
      return;
    }

    if (interaction.isModalSubmit() && isApplyModal(interaction.customId)) {
      await handleApplyModalSubmit(interaction);
      return;
    }

    if (interaction.isModalSubmit() && isMercenaryModal(interaction.customId)) {
      await handleMercenaryModalSubmit(interaction);
      return;
    }

    if (interaction.isModalSubmit() && isNoticeEditModal(interaction.customId)) {
      await handleNoticeEditModal(interaction);
      return;
    }
  } catch (error) {
    console.error('Interaction error:', error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: '❌ 처리 중 오류가 발생했습니다.',
          ephemeral: true,
        });
      } catch {
        // interaction expired or already acknowledged
      }
    }
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

client.login(config.discordToken);
