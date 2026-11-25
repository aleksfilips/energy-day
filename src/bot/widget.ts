/**
 * Живая карточка дня для утреннего сообщения (D-147): виджет Telegram (Bot API 10.4, sendWidget).
 * HTML один для всех, данные дня — в chat_data (до 1024 байт). Карточка сама двигает Солнце по дуге,
 * подсвечивает текущее окно («Для важного» или «Луна без курса») и в момент смены лунного дня переключается на новый.
 * Ограничения Telegram: HTML до 4096 байт после сжатия, без clipPath, mask, color-mix, text-shadow; не больше 16 «тяжёлых» элементов.
 * Если Telegram не принимает виджет, бот молча шлёт обычные сообщения (scripts/bot.ts).
 */
import * as A from '../astro';
import { makeContent, type Content } from '../content';
import { DEFAULT_NUMEROLOGY } from '../personal/numerology';
import { computeDay } from '../synthesis/day';
import { synthesize } from '../synthesis/rules';
import { dayPlan, goodWindows, vocInDaylight } from '../synthesis/life';
import { plainText } from '../synthesis/explain';
import { moonPath } from './moonPath';

let contentCache: Content | null = null;
const content = () => (contentCache ??= makeContent());
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const WD = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
/** Минуты Unix-времени: так даты занимают 8 цифр. */
const um = (d: Date) => Math.round(d.getTime() / 60000);

export interface WidgetData {
  /** Подпись даты. */
  d: string;
  /** Сдвиг часового пояса в минутах. */
  z: number;
  /** Лунные дни на эти сутки: номер, символ, суть (одна фраза), начало и конец. */
  L: [number, string, string, number, number][];
  /** Освещённая часть Луны (путь SVG для круга радиусом 26), процент, растёт ли. */
  m: string;
  i: number;
  w: 0 | 1;
  /** «в Близнецах». */
  s: string;
  /** Восход и закат (или 0, если Солнце не встаёт / не садится). */
  r: number;
  t: number;
  /** Светлое окно дня. */
  a: [number, number];
  g: [number, number][];
  v: [number, number][];
  /** Характер дня. */
  k: string;
}

const firstSentence = (x: string) => {
  const p = plainText(x);
  const i = p.indexOf('. ');
  return (i > 0 ? p.slice(0, i) : p.replace(/\.$/, '')).replace(/:.*/, '');
};

export function widgetData(loc: A.ResolvedLocation, date: A.DateKey, at?: Date): WidgetData {
  const tz = loc.timeZone;
  const day = computeDay(loc, date, { daylight: { from: 7, to: 23 }, vocMode: 'modern', zodiac: 'tropical', vedic: false, garden: false, birthday: null, numerology: DEFAULT_NUMEROLOGY, at });
  const c = content();
  const plan = dayPlan(day, synthesize(day, c), c);
  const [y, mo, dd] = date.split('-').map(Number) as [number, number, number];
  const noon = new Date(Date.UTC(y, mo - 1, dd, 12));
  const z = Math.round((Date.parse(new Date(noon).toLocaleString('en-US', { timeZone: tz }) + ' UTC') - noon.getTime()) / 60000);
  // Лунные дни, которые идут в светлое окно, плюс следующий — чтобы карточка переключилась сама.
  const segs = day.lunarDays.filter((s) => s.to > day.window.from);
  const L = segs.map((s): [number, string, string, number, number] => {
    const ld = c.lunarDay(s.day.number);
    return [s.day.number, cap(ld.symbols[0] ?? ''), firstSentence(ld.essence), um(s.day.start), um(s.day.end)];
  });
  return {
    d: `${WD[new Date(Date.UTC(y, mo - 1, dd)).getUTCDay()]}, ${dd} ${MONTHS[mo - 1]}`,
    z,
    L,
    m: moonPath(day.phase.angle, 26),
    i: Math.round(day.phase.illuminationPct),
    w: day.phase.waxing ? 1 : 0,
    s: A.inSign(day.dominantSign),
    r: day.sun.sunrise ? um(day.sun.sunrise) : 0,
    t: day.sun.sunset ? um(day.sun.sunset) : 0,
    a: [um(day.window.from), um(day.window.to)],
    g: goodWindows(day).map((w) => [um(w.from), um(w.to)]),
    v: vocInDaylight(day).map((w) => [um(w.from), um(w.to)]),
    k: plan.mood.title,
  };
}

/** Короткая подпись: её видят приложения, где виджеты не показываются. */
export function widgetCaption(w: WidgetData): string {
  const t = (m: number) => {
    const x = (((m + w.z) % 1440) + 1440) % 1440;
    return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;
  };
  const cur = w.L.find((l) => l[4] > w.a[0]) ?? w.L[0]!;
  const good = w.g.map((g) => `${t(g[0])}–${t(g[1])}`).join(', ');
  return `🌙 ${w.d}: ${cur[0]}-й лунный день. ${w.k}.${good ? ` Для важного: ${good}.` : ''}`;
}

/* Разметка карточки. Шрифты — только общие семейства (serif, system-ui): свои шрифты виджеты не грузят. */
export const WIDGET_HTML = `<!doctype html><meta charset=utf-8><style>
*{box-sizing:border-box;margin:0}
html,body{background:#0b1020}
body{font:13px/1.35 system-ui,sans-serif;color:#e9e4d8;padding:14px 16px 12px;background:linear-gradient(165deg,#222b4d,#0b1020 70%);overflow:hidden}
.top{display:flex;justify-content:space-between;align-items:center;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#ecc98f}
.mood{letter-spacing:0;text-transform:none;font-size:12px;color:#cfc6b4;border:1px solid #3a4266;border-radius:20px;padding:2px 9px}
.hero{display:flex;gap:14px;align-items:center;margin:12px 0 6px}
.moon{position:relative;width:76px;height:76px;flex:none}
.halo{position:absolute;inset:-6px;border-radius:50%;background:radial-gradient(#ecc98f55,#ecc98f00 68%);animation:br 5s ease-in-out infinite}
@keyframes br{50%{transform:scale(1.12);opacity:.55}}
.moon svg{position:relative}
h1{font:500 25px/1.1 serif;color:#f4ead6}
h1 b{font-weight:500;color:#ecc98f}
.sub{color:#cfc6b4;margin-top:3px}
.meta{color:#8f93ad;font-size:12px;margin-top:4px}
.arc{position:relative;height:64px;margin-top:6px}
.arc svg{position:absolute;inset:0}
.sun{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;transition:left 1s,top 1s}
.sun i{position:absolute;inset:0;border-radius:50%;background:radial-gradient(#fff3d1,#f2b766 60%,#e0954a);filter:drop-shadow(0 0 6px #f2b766)}
.sun u{position:absolute;inset:-6px;border-radius:50%;border:2px dotted #f2b76699;animation:rot 12s linear infinite}
@keyframes rot{to{transform:rotate(360deg)}}
.hz{display:flex;justify-content:space-between;color:#8f93ad;font-size:11px;margin-top:-2px}
.bar{position:relative;height:8px;border-radius:4px;background:#1d2440;margin:12px 0 4px}
.bar span{position:absolute;top:0;bottom:0;border-radius:4px}
.bar .g{background:linear-gradient(90deg,#c99a55,#ecc98f)}
.bar .v{background:#b8734f}
.bar .n{width:3px;margin-left:-1.5px;top:-4px;bottom:-4px;background:#fff;border-radius:2px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.c{border-radius:12px;padding:5px 10px;font-size:12px;background:#1d2440;color:#cfc6b4}
.c.on{color:#14182b;font-weight:600;animation:pu 2.4s ease-in-out infinite}
.c.gd.on{background:#ecc98f}.c.vc.on{background:#d08a62}
@keyframes pu{50%{transform:scale(1.04)}}
.nx{margin-top:10px;color:#a9a6b8;font-size:12px}
.nx b{color:#ecc98f;font-weight:500}
</style>
<div class=top><span id=d></span><span class=mood id=k></span></div>
<div class=hero><div class=moon><div class=halo></div><svg width=76 height=76 viewBox="-38 -38 76 76"><defs><radialGradient id=l cx=40% cy=35% r=75%><stop offset=0 stop-color=#fff /><stop offset=.7 stop-color=#efe7d2 /><stop offset=1 stop-color=#b9b3a3 /></radialGradient></defs><circle r=26 fill=#2a3050 /><path id=m fill=url(#l) /></svg></div>
<div><h1><b id=n></b>-й лунный день</h1><div class=sub id=e></div><div class=meta id=s></div></div></div>
<div class=arc><svg viewBox="0 0 300 64" preserveAspectRatio=none><defs><linearGradient id=a><stop offset=0 stop-color=#f2b766 stop-opacity=.2 /><stop offset=.5 stop-color=#ecc98f /><stop offset=1 stop-color=#c06a4a stop-opacity=.3 /></linearGradient></defs><path d="M10 58A140 52 0 0 1 290 58" fill=none stroke=url(#a) stroke-width=1.5 stroke-dasharray="3 4" /><path d="M0 58H300" stroke=#3a4266 /></svg><div class=sun id=u><u></u><i></i></div></div>
<div class=hz><span id=r></span><span id=t></span></div>
<div class=bar id=b></div>
<div class=chips id=c></div>
<div class=nx id=x></div>
<script>
var W=window.TelegramWidget||{},D;
function $(i){return document.getElementById(i)}
function f(m){m=((m+D.z)%1440+1440)%1440;return(m/60|0)+':'+('0'+m%60).slice(-2)}
function sp(a){return f(a[0])+'–'+f(a[1])}
function data(){var c=W.chatData;D=typeof c=='string'?JSON.parse(c):c}
function draw(){
if(!D)return;
var now=Date.now()/6e4,L=D.L,cur=L[0],nx=null,i;
for(i=0;i<L.length;i++)if(L[i][3]<=now){cur=L[i];nx=L[i+1]||null}
$('d').textContent=D.d;$('k').textContent=D.k;
$('n').textContent=cur[0];$('e').textContent=cur[1]+'. '+cur[2];
$('s').textContent='Луна '+D.s+' · '+D.i+'% · '+(D.w?'растёт':'убывает');
$('m').setAttribute('d',D.m);
var u=$('u').style,p=D.r&&D.t?(now-D.r)/(D.t-D.r):.5,q=Math.min(1,Math.max(0,p));
u.left=(10+280*(1-Math.cos(Math.PI*q))/2)/3+'%';u.top=58-52*Math.sin(Math.PI*q)+'px';u.opacity=p<0||p>1?.35:1;
$('r').textContent=D.r?'восход '+f(D.r):'';$('t').textContent=D.t?'закат '+f(D.t):'';
var a=D.a,w=a[1]-a[0],h='',ch='',on;
function pc(x){return Math.max(0,Math.min(100,(x-a[0])/w*100))}
function seg(s,k){h+='<span class='+k+' style="left:'+pc(s[0])+'%;width:'+(pc(s[1])-pc(s[0]))+'%"></span>'}
D.g.forEach(function(s){seg(s,'g')});D.v.forEach(function(s){seg(s,'v')});
if(now>a[0]&&now<a[1])h+='<span class=n style="left:'+pc(now)+'%"></span>';
$('b').innerHTML=h;
D.g.forEach(function(s){on=now>=s[0]&&now<s[1];ch+='<span class="c gd'+(on?' on':'')+'">'+(on?'Сейчас для важного до '+f(s[1]):'Для важного '+sp(s))+'</span>'});
D.v.forEach(function(s){on=now>=s[0]&&now<s[1];ch+='<span class="c vc'+(on?' on':'')+'">'+(on?'Луна без курса до '+f(s[1]):'Луна без курса '+sp(s))+'</span>'});
if(!D.g.length)ch='<span class=c>Сегодня лучше без важных начинаний</span>'+ch;
$('c').innerHTML=ch;
$('x').innerHTML=now>a[1]+90?'Карточка за этот день. Свежая придёт утром.':nx&&nx[3]<a[1]+60?'В <b>'+f(nx[3])+'</b> начнётся '+nx[0]+'-й лунный день: '+nx[2].toLowerCase():'Лунный день продлится до <b>'+f(cur[4])+'</b>'+(cur[4]-a[0]+(a[0]+D.z)%1440>=1440?' завтра':'');
}
data();draw();setInterval(draw,3e4);
W.onEvent&&W.onEvent('chatDataChanged',function(){data();draw()});
W.ready&&W.ready();
</script>`;
