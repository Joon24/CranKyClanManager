import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'fonts');
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

function drawBox(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor = 'rgba(16, 24, 44, 0.85)',
  borderColor = 'rgba(255,255,255,0.08)'
) {
  roundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export interface BotStatusEntry {
  name: string;
  label: string;
  note: string;
  dotColor: string;
  statusColor: string;
}

export function renderStatusCard(bots: BotStatusEntry[] = []): Buffer {
  ensureFonts();
  const width = 920;
  const lineHeight = 56;
  const contentHeight = Math.max(1, bots.length) * lineHeight;
  const height = 180 + contentHeight;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#101020');
  bg.addColorStop(1, '#14182c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  drawBox(ctx, 20, 20, width - 40, height - 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px NotoSansKR-Bold';
  ctx.fillText('봇 상태 보고', 50, 80);

  ctx.font = '18px NotoSansKR';
  ctx.fillStyle = '#b0b8ff';
  ctx.fillText('서버 내 봇 상태를 하루에 한 번 자동으로 확인합니다.', 50, 110);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, 130);
  ctx.lineTo(width - 50, 130);
  ctx.stroke();

  const top = 160;
  if (!bots.length) {
    ctx.font = '24px NotoSansKR';
    ctx.fillStyle = '#cccccc';
    ctx.fillText('등록된 봇을 찾을 수 없습니다.', 50, top + 36);
  } else {
    bots.forEach((bot, index) => {
      const y = top + index * lineHeight;
      ctx.beginPath();
      ctx.arc(52, y + 10, 10, 0, Math.PI * 2);
      ctx.fillStyle = bot.dotColor;
      ctx.fill();

      ctx.font = 'bold 24px NotoSansKR-Bold';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(bot.name, 80, y + 12);

      ctx.font = '18px NotoSansKR';
      ctx.fillStyle = bot.statusColor;
      ctx.fillText(bot.label, 80, y + 40);

      ctx.fillStyle = '#99a0b8';
      ctx.fillText(bot.note, 320, y + 40);
    });
  }

  ctx.font = '16px NotoSansKR';
  ctx.fillStyle = '#777';
  ctx.fillText(`갱신: ${new Date().toLocaleString('ko-KR')}`, 50, height - 30);
  return canvas.toBuffer('image/png');
}
