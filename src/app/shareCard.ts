/**
 * «Карточка дня» (D-142): картинка 1080×1920 (формат сторис) в стиле приложения, чтобы поделиться днём.
 * Рисуется на canvas: так подхватываются шрифты приложения (Cormorant Garamond и системный).
 */
import { moonLitPath } from './ui';
import { BOT_USERNAME } from '../config';

export interface ShareCardData {
  weekday: string;
  date: string;
  place: string;
  lunarDay: number;
  title: string;
  mood: string;
  phaseName: string;
  phaseAngle: number;
  sign: string;
  good: string[];
  mindful: string[];
  important: string;
  voc: string | null;
  areasGood: string[];
}

const W = 1080;
const H = 1920;
const GOLD = '#ecc98f';
const INK = '#f4eee3';
const MUTED = '#b4bacb';
const FAINT = '#7d859c';
const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS = "-apple-system, 'SF Pro Text', 'Inter', 'Segoe UI', Roboto, sans-serif";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number): void {
  const chars = [...text];
  const total = chars.reduce((s, c) => s + ctx.measureText(c).width, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  ctx.textAlign = 'left';
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + spacing;
  }
  ctx.textAlign = 'center';
}

export async function drawShareCard(d: ShareCardData): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load(`500 120px 'Cormorant Garamond'`), document.fonts.load(`600 60px 'Cormorant Garamond'`)]);
  } catch {
    /* шрифт не загрузился — будет Georgia */
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  // Фон: ночное небо, сияние сверху, редкие звёзды.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1C2443');
  bg.addColorStop(0.5, '#141B34');
  bg.addColorStop(1, '#0B1020');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 470, 0, W / 2, 470, 720);
  glow.addColorStop(0, 'rgba(46,58,110,0.95)');
  glow.addColorStop(1, 'rgba(46,58,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  let seed = d.lunarDay * 97 + d.date.length;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.15 + rnd() * 0.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(rnd() * W, 40 + rnd() * 700, 0.8 + rnd() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GOLD;
  ctx.font = `600 30px ${SANS}`;
  spaced(ctx, 'ЭНЕРГИЯ ДНЯ', W / 2, 150, 9);
  ctx.fillStyle = INK;
  ctx.font = `500 64px ${SERIF}`;
  ctx.fillText(`${d.weekday}, ${d.date}`, W / 2, 238);
  ctx.fillStyle = FAINT;
  ctx.font = `30px ${SANS}`;
  ctx.fillText(d.place, W / 2, 288);

  // Луна с настоящей фазой и мягким ореолом.
  const mx = W / 2;
  const my = 540;
  const r = 165;
  const halo = ctx.createRadialGradient(mx, my, r * 0.6, mx, my, r * 1.9);
  halo.addColorStop(0, 'rgba(248,227,181,0.28)');
  halo.addColorStop(1, 'rgba(248,227,181,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(mx, my, r * 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(mx, my);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  const path = moonLitPath(d.phaseAngle, r);
  if (path) {
    const lit = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    lit.addColorStop(0, '#fbf0d6');
    lit.addColorStop(1, '#e3c48d');
    ctx.fillStyle = lit;
    ctx.fill(new Path2D(path));
  }
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.font = `500 120px ${SERIF}`;
  ctx.fillText(`${d.lunarDay}-й лунный день`, W / 2, 870);
  ctx.fillStyle = GOLD;
  ctx.font = `500 52px ${SERIF}`;
  ctx.fillText(d.title, W / 2, 945);
  ctx.fillStyle = MUTED;
  ctx.font = `32px ${SANS}`;
  ctx.fillText(`${d.mood} · ${d.phaseName} · Луна ${d.sign}`, W / 2, 1005);

  // Блоки «Хорошо» и «Поберечься».
  let y = 1100;
  const block = (label: string, color: string, items: string[]) => {
    ctx.fillStyle = color;
    ctx.font = `600 26px ${SANS}`;
    spaced(ctx, label, W / 2, y, 6);
    y += 54;
    ctx.fillStyle = INK;
    ctx.font = `36px ${SANS}`;
    for (const it of items) {
      for (const line of wrap(ctx, it, W - 220)) {
        ctx.fillText(line, W / 2, y);
        y += 48;
      }
      y += 6;
    }
    y += 34;
  };
  block('ХОРОШО СЕГОДНЯ', '#8fd3a8', d.good.slice(0, 3).map((s) => s.charAt(0).toUpperCase() + s.slice(1)));
  block('ЛУЧШЕ ПОБЕРЕЧЬСЯ', '#e39a8f', d.mindful.slice(0, 2).map((s) => s.charAt(0).toUpperCase() + s.slice(1)));

  // Время для важного — золотая плашка.
  const pillY = Math.max(y, 1560);
  ctx.fillStyle = 'rgba(236,201,143,0.14)';
  const pw = 820;
  ctx.beginPath();
  ctx.roundRect((W - pw) / 2, pillY - 58, pw, d.voc ? 150 : 100, 36);
  ctx.fill();
  ctx.strokeStyle = 'rgba(236,201,143,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = FAINT;
  ctx.font = `30px ${SANS}`;
  ctx.fillText('Для важного', W / 2, pillY - 14);
  ctx.fillStyle = GOLD;
  ctx.font = `600 38px ${SANS}`;
  ctx.fillText(d.important, W / 2, pillY + 30);
  if (d.voc) {
    ctx.fillStyle = MUTED;
    ctx.font = `28px ${SANS}`;
    ctx.fillText(`Луна без курса ${d.voc}`, W / 2, pillY + 72);
  }

  ctx.strokeStyle = 'rgba(236,201,143,0.35)';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 70, 1790);
  ctx.lineTo(W / 2 + 70, 1790);
  ctx.stroke();
  ctx.fillStyle = FAINT;
  ctx.font = `500 34px ${SERIF}`;
  ctx.fillText(BOT_USERNAME ? `Энергия дня · @${BOT_USERNAME.replace(/^@/, '')}` : 'Энергия дня', W / 2, 1846);
  return c;
}

export function canvasBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Не удалось создать картинку'))), 'image/png'));
}
