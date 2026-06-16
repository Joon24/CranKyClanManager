import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
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

const BOLD = 'NotoSansKR-Bold, sans-serif';
const REG = 'NotoSansKR, NotoSansKR-Bold, sans-serif';

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

function fmtNum(n: unknown) {
  return n == null ? '-' : Number(n).toLocaleString('ko-KR');
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function kdPercent(kill: number, death: number) {
  if (!kill && !death) return '0%';
  const total = (kill || 0) + (death || 0);
  if (total === 0) return '0%';
  return Math.round(((kill || 0) / total) * 100) + '%';
}

const ROW_H = 72;
const PAD = 30;
const HEADER_H = 90;
const TITLE_H = 50;

interface MatchRow {
  match_result?: string;
  kill?: number;
  death?: number;
  assist?: number;
  date_match?: string;
  match_type?: string;
  detail?: {
    match_map?: string;
    match_detail?: Array<{ user_name?: string; damage?: number }>;
  } | null;
}

export async function renderMatch({
  userName,
  matches,
  matchMode,
  matchType,
}: {
  userName: string;
  matches: MatchRow[];
  matchMode: string;
  matchType?: string;
}): Promise<Buffer> {
  ensureFonts();

  const count = matches.length;
  const W = 1100;
  const H = HEADER_H + TITLE_H + count * ROW_H + PAD * 2 + 40;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f5f5f8';
  ctx.fillRect(0, 0, W, H);

  roundRect(ctx, 0, 0, W, HEADER_H, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#e8e8ec';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(W, HEADER_H);
  ctx.stroke();

  ctx.font = `bold 32px ${BOLD}`;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillText(userName, PAD, 45);

  const modeTag = `${matchMode}${matchType ? ' · ' + matchType : ''}`;
  ctx.font = `16px ${REG}`;
  ctx.fillStyle = '#6c6c80';
  ctx.fillText(modeTag, PAD, 72);

  let wins = 0;
  let losses = 0;
  let totalKill = 0;
  let totalDeath = 0;
  for (const m of matches) {
    if (m.match_result === '1') wins++;
    else if (m.match_result === '2') losses++;
    totalKill += m.kill || 0;
    totalDeath += m.death || 0;
  }
  const winRate = count > 0 ? Math.round((wins / count) * 100) : 0;
  const avgKd = totalDeath > 0 ? (totalKill / totalDeath).toFixed(2) : totalKill.toFixed(2);

  ctx.textAlign = 'right';
  ctx.font = `bold 28px ${BOLD}`;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillText(`${wins}승 ${losses}패`, W - PAD, 40);
  ctx.font = `16px ${REG}`;
  ctx.fillStyle = '#6c6c80';
  ctx.fillText(`승률 ${winRate}%  |  평균 K/D ${avgKd}  |  ${count}경기`, W - PAD, 68);
  ctx.textAlign = 'left';

  const titleY = HEADER_H;
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, titleY, W, TITLE_H);
  ctx.strokeStyle = '#e8e8ec';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, titleY + TITLE_H);
  ctx.lineTo(W, titleY + TITLE_H);
  ctx.stroke();

  ctx.fillStyle = '#4a6cf7';
  ctx.fillRect(PAD, titleY + 12, 4, 26);
  ctx.font = `bold 20px ${BOLD}`;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillText('최근 매치 기록', PAD + 14, titleY + 35);
  ctx.font = `14px ${REG}`;
  ctx.fillStyle = '#999';
  ctx.fillText(`(${count} MATCHES)`, PAD + 180, titleY + 35);

  const colX = { result: PAD + 10, map: 115, kill: 310, death: 410, assist: 510, kd: 600, damage: 720, type: 870 };
  const startY = titleY + TITLE_H;

  for (let i = 0; i < count; i++) {
    const m = matches[i];
    const y = startY + i * ROW_H;
    const isWin = m.match_result === '1';
    const isDraw = m.match_result === '3';

    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#fafafc';
    ctx.fillRect(0, y, W, ROW_H);

    ctx.fillStyle = isWin ? '#4a6cf7' : isDraw ? '#999' : '#e74c3c';
    ctx.fillRect(0, y, 5, ROW_H);

    const resultText = isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSE';
    const badgeColor = isWin ? '#e8f0fe' : isDraw ? '#f0f0f0' : '#fde8e8';
    const badgeTextColor = isWin ? '#4a6cf7' : isDraw ? '#666' : '#e74c3c';

    roundRect(ctx, PAD + 5, y + 20, 60, 32, 6);
    ctx.fillStyle = badgeColor;
    ctx.fill();
    ctx.font = `bold 14px ${BOLD}`;
    ctx.fillStyle = badgeTextColor;
    ctx.textAlign = 'center';
    ctx.fillText(resultText, PAD + 35, y + 42);
    ctx.textAlign = 'left';

    const detail = m.detail;
    const mapName = detail?.match_map || '-';
    ctx.font = `bold 15px ${BOLD}`;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText(mapName, colX.map, y + 35);
    ctx.font = `12px ${REG}`;
    ctx.fillStyle = '#999';
    ctx.fillText(timeAgo(m.date_match ?? ''), colX.map, y + 55);

    ctx.font = `bold 24px ${BOLD}`;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText(String(m.kill ?? 0), colX.kill, y + 40);
    ctx.font = `11px ${REG}`;
    ctx.fillStyle = '#999';
    ctx.fillText('KILLS', colX.kill, y + 57);

    ctx.font = `bold 24px ${BOLD}`;
    ctx.fillStyle = '#e74c3c';
    ctx.fillText(String(m.death ?? 0), colX.death, y + 40);
    ctx.font = `11px ${REG}`;
    ctx.fillStyle = '#999';
    ctx.fillText('DEATHS', colX.death, y + 57);

    ctx.font = `bold 24px ${BOLD}`;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText(String(m.assist ?? 0), colX.assist, y + 40);
    ctx.font = `11px ${REG}`;
    ctx.fillStyle = '#999';
    ctx.fillText('ASSISTS', colX.assist, y + 57);

    ctx.font = `bold 22px ${BOLD}`;
    ctx.fillStyle = '#4a6cf7';
    ctx.fillText(kdPercent(m.kill ?? 0, m.death ?? 0), colX.kd, y + 40);
    ctx.font = `11px ${REG}`;
    ctx.fillStyle = '#999';
    ctx.fillText('K/D', colX.kd, y + 57);

    if (detail) {
      const me = detail.match_detail?.find((p) => p.user_name === userName);
      const dmg = me?.damage ?? '-';
      ctx.font = `bold 22px ${BOLD}`;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillText(typeof dmg === 'number' ? fmtNum(Math.round(dmg)) : String(dmg), colX.damage, y + 40);
      ctx.font = `11px ${REG}`;
      ctx.fillStyle = '#999';
      ctx.fillText('DAMAGE', colX.damage, y + 57);
    }

    roundRect(ctx, colX.type, y + 22, 130, 28, 14);
    ctx.fillStyle = '#f0f0f5';
    ctx.fill();
    ctx.font = `12px ${REG}`;
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.fillText(m.match_type || '-', colX.type + 65, y + 41);
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y + ROW_H);
    ctx.lineTo(W - PAD, y + ROW_H);
    ctx.stroke();
  }

  const footerY = startY + count * ROW_H + 15;
  ctx.font = `12px ${REG}`;
  ctx.fillStyle = '#bbb';
  ctx.textAlign = 'center';
  ctx.fillText('Powered by Nexon Open API · Cranky Bot', W / 2, footerY);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}
