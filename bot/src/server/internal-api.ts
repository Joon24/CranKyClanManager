import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import type { Client } from 'discord.js';
import { config } from '../config.js';
import {
  approveMember,
  rejectMemberDm,
  getGuildRoles,
  changeMemberRole,
  listClanMembers,
} from '../services/discord-actions.js';
import { banMember, unbanMember } from '../services/blacklist.js';
import { getGuildChannels, sendEmbedMessage } from '../services/embed.js';
import type { Position } from '../types/index.js';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function checkAuth(req: IncomingMessage): boolean {
  const secret = req.headers['x-internal-secret'];
  return secret === config.internalApiSecret;
}

export function startInternalApi(client: Client) {
  const server = createServer(async (req, res) => {
    if (req.url === '/health') {
      json(res, 200, { ok: true });
      return;
    }

    if (!req.url?.startsWith('/internal/')) {
      json(res, 404, { error: 'Not found' });
      return;
    }

    if (!checkAuth(req)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }

    try {
      if (req.method === 'GET') {
        if (req.url === '/internal/roles') {
          const roles = await getGuildRoles(client);
          json(res, 200, roles);
          return;
        }
        if (req.url === '/internal/channels') {
          const channels = await getGuildChannels(client);
          json(res, 200, channels);
          return;
        }
        if (req.url === '/internal/clan-members') {
          const members = await listClanMembers(client);
          json(res, 200, members);
          return;
        }
        json(res, 404, { error: 'Not found' });
        return;
      }

      if (req.method !== 'POST') {
        json(res, 405, { error: 'Method not allowed' });
        return;
      }

      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};

      if (req.url === '/internal/approve') {
        const { discordUserId, suddenNickname, position, age } = body;
        if (!discordUserId || !suddenNickname || !position || age == null) {
          json(res, 400, { error: 'Missing fields' });
          return;
        }
        const result = await approveMember(
          client,
          discordUserId,
          suddenNickname,
          position as Position,
          Number(age)
        );
        json(res, 200, { success: true, ...result });
        return;
      }

      if (req.url === '/internal/reject') {
        const { discordUserId, suddenNickname, reason } = body;
        if (!discordUserId || !suddenNickname) {
          json(res, 400, { error: 'Missing fields' });
          return;
        }
        const result = await rejectMemberDm(client, discordUserId, suddenNickname, reason);
        json(res, 200, { success: true, ...result });
        return;
      }

      if (req.url === '/internal/change-role') {
        const { discordUserId, roleId, previousRoleId } = body;
        if (!discordUserId || !roleId) {
          json(res, 400, { error: 'Missing fields' });
          return;
        }
        const result = await changeMemberRole(client, discordUserId, roleId, previousRoleId);
        json(res, 200, { success: true, ...result });
        return;
      }

      if (req.url === '/internal/ban') {
        const { discordUserId, reason } = body;
        if (!discordUserId) {
          json(res, 400, { error: 'Missing discordUserId' });
          return;
        }
        const result = await banMember(client, discordUserId, reason ?? '블랙리스트');
        json(res, 200, { success: true, ...result });
        return;
      }

      if (req.url === '/internal/unban') {
        const { discordUserId } = body;
        if (!discordUserId) {
          json(res, 400, { error: 'Missing discordUserId' });
          return;
        }
        const result = await unbanMember(client, discordUserId);
        json(res, 200, { success: true, ...result });
        return;
      }

      if (req.url === '/internal/send-embed') {
        const { channelId, content, embeds, components, flags } = body;
        if (!channelId || !Array.isArray(embeds)) {
          json(res, 400, { error: 'Missing channelId or embeds' });
          return;
        }
        const result = await sendEmbedMessage(client, {
          channelId,
          content,
          embeds,
          components: Array.isArray(components) ? components : undefined,
          flags: typeof flags === 'number' ? flags : undefined,
        });
        json(res, 200, { success: true, ...result });
        return;
      }

      json(res, 404, { error: 'Unknown route' });
    } catch (error) {
      console.error('Internal API error:', error);
      json(res, 500, { error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
  server.listen(config.botApiPort, host, () => {
    console.log(`Internal API listening on http://${host}:${config.botApiPort}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${config.botApiPort} already in use. Stop the other process and restart the bot.`);
    } else {
      console.error('Internal API server error:', err);
    }
  });
}
