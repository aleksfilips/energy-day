/**
 * Проверка текста утреннего сообщения без отправки:
 *   npx tsx scripts/morning.ts 57.13 60.15 Asia/Yekaterinburg [ДД.ММ]
 * Рассылку теперь делает scripts/bot.ts (каждому подписчику своё сообщение).
 */
import * as A from '../src/astro';
import { morningText } from '../src/bot/message';

const [lat = '56.84', lon = '60.61', tz = 'Asia/Yekaterinburg', bd] = process.argv.slice(2);
const loc: A.ResolvedLocation = { id: 'check', name: 'проверка', latitude: Number(lat), longitude: Number(lon), elevation: 0, timeZone: tz };
const [d, m] = (bd ?? '').split('.').map(Number);
console.log(morningText({ loc, date: A.toDateKey(new Date(), tz), birthday: d && m ? { day: d, month: m } : null }));
