import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface SaUser {
  discord_id: string;
  nickname: string;
  ouid: string;
  created_at: string;
}

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
const DATA_PATH = path.join(DATA_DIR, 'sa-users.json');

function readAll(): Record<string, SaUser> {
  if (!fs.existsSync(DATA_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')) as Record<string, SaUser>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, SaUser>) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function registerSaUser(discordId: string, nickname: string, ouid: string): Promise<void> {
  const data = readAll();
  data[discordId] = {
    discord_id: discordId,
    nickname,
    ouid,
    created_at: new Date().toISOString(),
  };
  writeAll(data);
}

export async function getSaUser(discordId: string): Promise<SaUser | null> {
  const data = readAll();
  return data[discordId] ?? null;
}
