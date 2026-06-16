import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'fonts');
const LOGO_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'logos');

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  const bold = path.join(FONT_DIR, 'NotoSansKR-Bold.ttf');
  const regular = path.join(FONT_DIR, 'NotoSansKR-Regular.ttf');
  if (fs.existsSync(bold)) GlobalFonts.registerFromPath(bold, 'NotoSansKR-Bold');
  if (fs.existsSync(regular)) GlobalFonts.registerFromPath(regular, 'NotoSansKR');
  fontsRegistered = true;
}

const W = 1100;
const H = 750;
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

function drawBox(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor = 'rgba(0,0,0,0.45)',
  borderColor = '#444'
) {
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawBar(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, pct: number, color = '#cc0000') {
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  const bw = Math.max(0, Math.min(w, w * (pct / 100)));
  if (bw > 0) {
    roundRect(ctx, x, y, bw, h, 4);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function gradeToStars(grade?: string) {
  const map: Record<string, number> = {
    이등병: 0, 일등병: 1, 상등병: 1, 병장: 2,
    하사: 2, 중사: 2, 상사: 3, 원사: 3,
    준위: 3, 소위: 3, 중위: 3, 대위: 3,
    소령: 4, 중령: 4, 대령: 4,
    준장: 4, 소장: 5, 중장: 5, 대장: 5,
    원수: 5, 특급대장: 5,
  };
  return map[grade ?? ''] ?? 0;
}

function fmtNum(n: unknown) {
  if (n == null) return '-';
  return Number(n).toLocaleString('ko-KR');
}

function fmtPct(n: unknown) {
  if (n == null) return '-';
  return Number(n).toFixed(1) + '%';
}

function fmtKd(n: unknown) {
  if (n == null) return '-';
  return Number(n).toFixed(3);
}

function tierColor(tier?: string) {
  if (!tier) return '#888';
  const t = tier.toUpperCase();
  if (t.includes('MASTER') || t.includes('DIAMOND')) return '#b9f2ff';
  if (t.includes('PLATINUM')) return '#00ccff';
  if (t.includes('GOLD')) return '#FFD700';
  if (t.includes('SILVER')) return '#c0c0c0';
  if (t.includes('BRONZE')) return '#cd7f32';
  return '#888';
}

const imgCache = new Map<string, Awaited<ReturnType<typeof loadImage>> | null>();

async function safeLoadImage(url?: string | null) {
  if (!url) return null;
  if (imgCache.has(url)) return imgCache.get(url) ?? null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const buf = Buffer.from(await res.arrayBuffer());
    const img = await loadImage(buf);
    imgCache.set(url, img);
    return img;
  } catch {
    imgCache.set(url, null);
    return null;
  }
}

const logoCache = new Map<string, Awaited<ReturnType<typeof loadImage>> | null>();

async function loadClanLogo(clanName?: string) {
  if (!clanName) return null;
  if (logoCache.has(clanName)) return logoCache.get(clanName) ?? null;
  const logoPath = path.join(LOGO_DIR, `${clanName}.png`);
  try {
    if (fs.existsSync(logoPath)) {
      const img = await loadImage(logoPath);
      logoCache.set(clanName, img);
      return img;
    }
  } catch {
    // ignore
  }
  logoCache.set(clanName, null);
  return null;
}

function findMetaImage(metaArr: unknown, name?: string) {
  if (!Array.isArray(metaArr) || !name) return null;
  const entry = metaArr.find(
    (m: Record<string, string>) => m.grade === name || m.season_grade === name || m.tier === name
  ) as Record<string, string> | undefined;
  return entry?.grade_image || entry?.season_grade_image || entry?.tier_image || null;
}

export async function renderProfile(data: Record<string, unknown>, meta: Record<string, unknown> = {}): Promise<Buffer> {
  ensureFonts();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#0d0d1a');
  bgGrad.addColorStop(0.5, '#16162a');
  bgGrad.addColorStop(1, '#0d0d1a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const frameGrad = ctx.createLinearGradient(0, 0, W, 0);
  frameGrad.addColorStop(0, '#333');
  frameGrad.addColorStop(0.3, '#666');
  frameGrad.addColorStop(0.5, '#888');
  frameGrad.addColorStop(0.7, '#666');
  frameGrad.addColorStop(1, '#333');
  ctx.strokeStyle = frameGrad;
  ctx.lineWidth = 4;
  roundRect(ctx, 6, 6, W - 12, H - 12, 12);
  ctx.stroke();
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  roundRect(ctx, 14, 14, W - 28, H - 28, 8);
  ctx.stroke();

  const hY = 30;
  const clanName = data.clan_name as string | undefined;
  let avatarImg = await loadClanLogo(clanName);
  const logoMeta = meta.logo as { logo_image?: string } | undefined;
  if (!avatarImg && logoMeta?.logo_image) {
    avatarImg = await safeLoadImage(logoMeta.logo_image);
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(80, hY + 50, 40, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, 40, hY + 10, 80, 80);
  } else {
    ctx.fillStyle = '#333';
    ctx.fillRect(40, hY + 10, 80, 80);
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(80, hY + 40, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(80, hY + 85, 28, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(80, hY + 50, 41, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = `bold 32px ${BOLD}`;
  ctx.fillText(String(data.user_name || 'Unknown'), 140, hY + 40);

  ctx.font = `18px ${REG}`;
  ctx.fillStyle = '#FFD700';
  const titleText = String(data.title_name || '');
  ctx.fillText(titleText, 140, hY + 65);
  if (clanName) {
    ctx.fillStyle = '#aaa';
    ctx.fillText(`클랜: ${clanName}`, 140 + ctx.measureText(titleText).width + 15, hY + 65);
  }

  ctx.font = `16px ${REG}`;
  ctx.fillStyle = '#00ff88';
  ctx.fillText(`매너 ${data.manner_grade || '-'}`, 140, hY + 88);
  if (data.user_date_create) {
    const d = new Date(String(data.user_date_create));
    ctx.font = `14px ${REG}`;
    ctx.fillStyle = '#777';
    ctx.fillText(
      `가입일: ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
      140,
      hY + 108
    );
  }

  const rX = W - 320;
  drawBox(ctx, rX, hY, 290, 50);
  ctx.font = `bold 14px ${BOLD}`;
  ctx.fillStyle = '#FFD700';
  ctx.fillText('★ 시즌랭킹', rX + 12, hY + 22);
  ctx.font = `bold 24px ${BOLD}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.fillText(`${fmtNum(data.season_grade_ranking)}위`, rX + 278, hY + 42);
  ctx.textAlign = 'left';

  drawBox(ctx, rX, hY + 58, 290, 50);
  ctx.font = `bold 14px ${BOLD}`;
  ctx.fillStyle = '#FFD700';
  ctx.fillText('★ 통합랭킹', rX + 12, hY + 80);
  ctx.font = `bold 24px ${BOLD}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.fillText(`${fmtNum(data.grade_ranking)}위`, rX + 278, hY + 100);
  ctx.textAlign = 'left';

  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 155);
  ctx.lineTo(W - 30, 155);
  ctx.stroke();

  const sY = 170;
  drawBox(ctx, 30, sY, W - 60, 140, 'rgba(0,0,0,0.35)');

  ctx.font = `bold 14px ${BOLD}`;
  ctx.fillStyle = '#FFD700';
  ctx.fillText('최근 전적', 50, sY + 22);

  ctx.font = `bold 48px ${BOLD}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(fmtPct(data.recent_win_rate), 50, sY + 80);
  ctx.font = `14px ${REG}`;
  ctx.fillStyle = '#888';
  ctx.fillText('승률', 50, sY + 100);
  drawBar(ctx, 50, sY + 108, 150, 10, Number(data.recent_win_rate) || 0, '#cc3333');

  ctx.font = `bold 48px ${BOLD}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(fmtKd(data.recent_kill_death_rate), 250, sY + 80);
  ctx.font = `14px ${REG}`;
  ctx.fillStyle = '#888';
  ctx.fillText('K/D', 250, sY + 100);

  const wpX = 520;
  ctx.font = `bold 16px ${BOLD}`;
  ctx.fillStyle = '#ddd';
  ctx.fillText('무기 사용률', wpX, sY + 30);

  const weapons = [
    { label: '돌격', pct: data.recent_assault_rate, color: '#e74c3c', icon: '🔫' },
    { label: '저격', pct: data.recent_sniper_rate, color: '#3498db', icon: '🎯' },
    { label: '특수', pct: data.recent_special_rate, color: '#f39c12', icon: '💣' },
  ];
  weapons.forEach((wp, i) => {
    const wy = sY + 55 + i * 30;
    ctx.font = `14px ${REG}`;
    ctx.fillStyle = '#aaa';
    ctx.fillText(`${wp.icon} ${wp.label}`, wpX, wy);
    ctx.fillStyle = '#fff';
    ctx.font = `bold 14px ${BOLD}`;
    ctx.fillText(fmtPct(wp.pct), wpX + 80, wy);
    drawBar(ctx, wpX + 150, wy - 12, 350, 16, Number(wp.pct) || 0, wp.color);
  });

  const gY = 330;
  const [gradeImg, seasonGradeImg, soloTierImg, partyTierImg, logoImg] = await Promise.all([
    safeLoadImage(findMetaImage(meta.grade, String(data.grade || ''))),
    safeLoadImage(findMetaImage(meta.seasonGrade, String(data.season_grade || ''))),
    safeLoadImage(findMetaImage(meta.tier, String(data.solo_rank_match_tier || ''))),
    safeLoadImage(findMetaImage(meta.tier, String(data.party_rank_match_tier || ''))),
    safeLoadImage(logoMeta?.logo_image),
  ]);

  drawBox(ctx, 30, gY, 340, 120);
  ctx.font = `bold 14px ${BOLD}`;
  ctx.fillStyle = '#aaa';
  ctx.fillText('통합 계급', 50, gY + 25);
  if (gradeImg) ctx.drawImage(gradeImg, 260, gY + 15, 90, 90);
  ctx.font = `bold 34px ${BOLD}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(String(data.grade || '-'), 50, gY + 65);
  ctx.font = `14px ${REG}`;
  ctx.fillStyle = '#00ccff';
  ctx.fillText(`EXP ${fmtNum(data.grade_exp)}`, 50, gY + 90);
  ctx.fillStyle = '#FFD700';
  ctx.font = `18px ${BOLD}`;
  ctx.fillText('★'.repeat(Math.min(gradeToStars(String(data.grade || '')), 5)), 50, gY + 112);

  drawBox(ctx, 390, gY, 340, 120);
  ctx.font = `bold 14px ${BOLD}`;
  ctx.fillStyle = '#aaa';
  ctx.fillText('시즌 계급', 410, gY + 25);
  if (seasonGradeImg) ctx.drawImage(seasonGradeImg, 620, gY + 15, 90, 90);
  ctx.font = `bold 34px ${BOLD}`;
  ctx.fillStyle = '#FFD700';
  ctx.fillText(String(data.season_grade || '-'), 410, gY + 65);
  ctx.font = `14px ${REG}`;
  ctx.fillStyle = '#00ccff';
  ctx.fillText(`EXP ${fmtNum(data.season_grade_exp)}`, 410, gY + 90);
  ctx.fillStyle = '#FFD700';
  ctx.font = `18px ${BOLD}`;
  ctx.fillText('★'.repeat(Math.min(gradeToStars(String(data.season_grade || '')), 5)), 410, gY + 112);

  drawBox(ctx, 750, gY, 320, 120);
  ctx.font = `bold 14px ${BOLD}`;
  ctx.fillStyle = '#aaa';
  ctx.fillText('매너등급', 770, gY + 25);
  ctx.font = `bold 40px ${BOLD}`;
  ctx.fillStyle = '#00ff88';
  ctx.fillText(String(data.manner_grade || '-'), 770, gY + 75);
  ctx.font = `12px ${REG}`;
  ctx.fillStyle = '#666';
  ctx.fillText('Manner Grade', 770, gY + 100);

  const tY = 470;

  drawBox(ctx, 30, tY, 520, 120);
  ctx.font = `bold 16px ${BOLD}`;
  ctx.fillStyle = '#FFD700';
  ctx.fillText('솔로 랭크전', 50, tY + 28);
  if (soloTierImg) ctx.drawImage(soloTierImg, 200, tY + 15, 80, 80);
  ctx.font = `bold 36px ${BOLD}`;
  ctx.fillStyle = tierColor(String(data.solo_rank_match_tier || ''));
  ctx.fillText(String(data.solo_rank_match_tier || '-'), 50, tY + 75);
  ctx.font = `16px ${REG}`;
  ctx.fillStyle = '#aaa';
  ctx.fillText('점수', 300, tY + 55);
  ctx.font = `bold 28px ${BOLD}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(fmtNum(data.solo_rank_match_score), 300, tY + 85);

  drawBox(ctx, 570, tY, 500, 120);
  ctx.font = `bold 16px ${BOLD}`;
  ctx.fillStyle = '#FFD700';
  ctx.fillText('파티 랭크전', 590, tY + 28);
  if (partyTierImg) ctx.drawImage(partyTierImg, 740, tY + 15, 80, 80);
  ctx.font = `bold 36px ${BOLD}`;
  ctx.fillStyle = tierColor(String(data.party_rank_match_tier || ''));
  ctx.fillText(String(data.party_rank_match_tier || '-'), 590, tY + 75);
  ctx.font = `16px ${REG}`;
  ctx.fillStyle = '#aaa';
  ctx.fillText('점수', 830, tY + 55);
  ctx.font = `bold 28px ${BOLD}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(fmtNum(data.party_rank_match_score), 830, tY + 85);

  const bY = 610;
  drawBox(ctx, 30, bY, W - 60, 55, 'rgba(0,0,0,0.25)');
  ctx.font = `13px ${REG}`;
  ctx.fillStyle = '#666';
  const items = [
    `닉네임: ${data.user_name || '-'}`,
    `클랜: ${clanName || '없음'}`,
    `칭호: ${data.title_name || '-'}`,
  ];
  if (data.user_date_create) {
    const d = new Date(String(data.user_date_create));
    items.push(
      `가입일: ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    );
  }
  ctx.fillText(items.join('  |  '), 50, bY + 25);

  if (logoImg) {
    ctx.drawImage(logoImg, W / 2 - 140, bY + 32, 24, 24);
  }
  ctx.font = `12px ${REG}`;
  ctx.fillStyle = '#444';
  ctx.textAlign = 'center';
  ctx.fillText('Powered by Nexon Open API · Cranky Bot', W / 2, bY + 48);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}
