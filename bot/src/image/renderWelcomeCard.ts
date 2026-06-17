import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import type { GuildMember } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'fonts');
const BOLD = 'NotoSansKR-Bold, sans-serif';
const REG = 'NotoSansKR, NotoSansKR-Bold, sans-serif';

let fontsRegistered = false;

function ensureFonts() {
  if (fontsRegistered) return;
  const bold = path.join(FONT_DIR, 'NotoSansKR-Bold.ttf');
  const regular = path.join(FONT_DIR, 'NotoSansKR-Regular.ttf');
  if (fs.existsSync(bold)) GlobalFonts.registerFromPath(bold, 'NotoSansKR-Bold');
  if (fs.existsSync(regular)) GlobalFonts.registerFromPath(regular, 'NotoSansKR');
  fontsRegistered = true;
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function formatDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `UTC ${year}년 ${month}월 ${day}일`;
}

async function safeLoadAvatar(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await loadImage(buf);
  } catch {
    return null;
  }
}

function truncateText(ctx: SKRSContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

export async function renderWelcomeCard(member: GuildMember): Promise<Buffer> {
  ensureFonts();

  const width = 450;
  const height = 280;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, '#1a1a2e');
  bgGradient.addColorStop(0.5, '#16213e');
  bgGradient.addColorStop(1, '#0f3460');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, 0);
  ctx.strokeStyle = '#e94560';
  ctx.lineWidth = 3;
  ctx.stroke();

  const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await safeLoadAvatar(avatarUrl);

  const avatarX = 85;
  const avatarY = 100;
  const avatarRadius = 55;

  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 4, 0, Math.PI * 2);
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (avatar) {
    ctx.drawImage(
      avatar,
      avatarX - avatarRadius,
      avatarY - avatarRadius,
      avatarRadius * 2,
      avatarRadius * 2
    );
  } else {
    ctx.fillStyle = '#7289da';
    ctx.fill();
  }
  ctx.restore();

  const textX = 170;
  const displayName = member.displayName || member.user.username;

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 18px ${BOLD}`;
  ctx.textAlign = 'left';
  const title = truncateText(ctx, `${displayName}님이 서버에 가입했습니다!`, 220);
  ctx.fillText(title, textX, 35);

  ctx.fillStyle = '#aaaaaa';
  ctx.font = `14px ${REG}`;
  ctx.fillText(`유저ID: ${member.user.id}`, textX, 65);
  ctx.fillText(`디스코드 가입일: ${formatDate(member.user.createdAt)}`, textX, 90);
  ctx.fillText(`서버 접속일: ${formatDate(member.joinedAt ?? new Date())}`, textX, 115);

  ctx.fillStyle = '#00ff88';
  ctx.font = `bold 16px ${BOLD}`;
  ctx.fillText(`#${member.guild.memberCount} 번째 멤버`, textX, 145);

  const boxY = 190;
  const boxHeight = 70;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  roundRect(ctx, 20, boxY, width - 40, boxHeight, 10);
  ctx.fill();

  ctx.strokeStyle = '#e94560';
  ctx.lineWidth = 2;
  roundRect(ctx, 20, boxY, width - 40, boxHeight, 10);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 16px ${BOLD}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${member.guild.name} 서버에 오신 것을`, width / 2, boxY + 30);
  ctx.fillStyle = '#ffcc00';
  ctx.fillText('환영합니다!', width / 2, boxY + 55);

  return canvas.toBuffer('image/png');
}
