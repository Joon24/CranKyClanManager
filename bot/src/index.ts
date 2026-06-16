import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import { setupAuthChannel } from './handlers/setupAuthChannel.js';
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
import { executeSaCommand } from './commands/sa.js';
import { preloadMeta } from './api/suddenApi.js';

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

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot ready: ${c.user.tag}`);
  startInternalApi(client);
  await setupAuthChannel(client);
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
      await executeSaCommand(interaction);
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
