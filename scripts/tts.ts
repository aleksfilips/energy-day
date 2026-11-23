/**
 * Озвучка утреннего сообщения (D-137). Голоса:
 *  1 Светлана, 2 Дария — нейроголоса Microsoft через edge-tts (бесплатно, без ключа; ставится в Actions из pip);
 *  3 Алёна — Яндекс SpeechKit, если задан секрет YANDEX_TTS_KEY (API-ключ сервисного аккаунта); иначе — Светлана.
 * Результат — MP3: Telegram принимает его как голосовое сообщение.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { VoiceId } from '../src/bot/payload';

const EDGE: Record<1 | 2, string> = { 1: 'ru-RU-SvetlanaNeural', 2: 'ru-RU-DariyaNeural' };

let edgeReady: boolean | null = null;
function ensureEdge(): boolean {
  if (edgeReady !== null) return edgeReady;
  const has = () => spawnSync('python3', ['-m', 'edge_tts', '--help'], { stdio: 'ignore' }).status === 0;
  if (!has()) spawnSync('python3', ['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', 'edge-tts'], { stdio: 'inherit', timeout: 120_000 });
  edgeReady = has();
  if (!edgeReady) console.error('edge-tts не установился — голосовые сообщения пропущены.');
  return edgeReady;
}

function edge(text: string, voice: 1 | 2): Buffer | null {
  if (!ensureEdge()) return null;
  const dir = mkdtempSync(join(tmpdir(), 'tts-'));
  const src = join(dir, 'text.txt');
  const out = join(dir, 'voice.mp3');
  writeFileSync(src, text);
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = spawnSync('python3', ['-m', 'edge_tts', '--voice', EDGE[voice], '--rate=-6%', '-f', src, '--write-media', out], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 180_000 });
    if (r.status === 0) {
      const b = readFileSync(out);
      if (b.length > 1000) return b;
    }
    console.error('edge-tts: ошибка озвучки', (r.stderr?.toString() ?? '').split('\n').slice(-2).join(' '));
  }
  return null;
}

/** Делит текст на куски до max знаков по абзацам и предложениям. */
export function chunks(paragraphs: string[], max: number): string[] {
  const out: string[] = [];
  let cur = '';
  const push = (s: string) => {
    if (cur && cur.length + s.length + 1 > max) {
      out.push(cur);
      cur = '';
    }
    cur = cur ? `${cur}\n${s}` : s;
  };
  for (const p of paragraphs) {
    if (p.length <= max) push(p);
    else for (const sentence of p.split(/(?<=[.!?])\s+/)) push(sentence.slice(0, max));
  }
  if (cur) out.push(cur);
  return out;
}

async function yandex(paragraphs: string[], key: string): Promise<Buffer | null> {
  const parts: Buffer[] = [];
  for (const text of chunks(paragraphs, 4800)) {
    const body = new URLSearchParams({ text, lang: 'ru-RU', voice: 'alena', emotion: 'good', speed: '0.95', format: 'mp3' });
    const res = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', { method: 'POST', headers: { Authorization: `Api-Key ${key}` }, body });
    if (!res.ok) {
      console.error('Яндекс SpeechKit:', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    parts.push(Buffer.from(await res.arrayBuffer()));
  }
  return Buffer.concat(parts);
}

/** Озвучить абзацы выбранным голосом. null — не получилось (тогда человек получит только текст). */
export async function synth(paragraphs: string[], voice: Exclude<VoiceId, 0>): Promise<Buffer | null> {
  const key = process.env.YANDEX_TTS_KEY?.trim();
  if (voice === 3 && key) {
    const y = await yandex(paragraphs, key);
    if (y) return y;
  }
  return edge(paragraphs.join('\n\n'), voice === 2 ? 2 : 1);
}
