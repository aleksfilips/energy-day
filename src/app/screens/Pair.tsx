/** «Совместимость» (D-143): связи между двумя картами Дизайна человека. Данные партнёра хранятся только на этом устройстве. */
import { useMemo, useState } from 'react';
import { bodygraph, type Bodygraph } from '../../humandesign/chart';
import { composite, isLoveLink, LINK_TEXT, PAIR_TEXT, partnerLayer, profileAngle, profileBridge, sharedCenters, splitBridges, type Angle, type Link, type LinkKind } from '../../humandesign/composite';
import { graphView } from '../../humandesign/overlay';
import { centerTitle, channelTitle } from '../../humandesign/summary';
import content from '../../content/data/humandesign.json';
import { haptic } from '../../telegram';
import { useStore } from '../store';
import { Button, Card, Label } from '../ui';
import type { Nav } from '../App';
import { BodygraphSvg, PALETTE } from './Bodygraph';
import { Panel } from './Compact';
import { BirthForm, birthResult, birthValueOf, field, type BirthValue } from './Profile';

const ORDER: LinkKind[] = ['electromagnetic', 'companionship', 'compromise', 'dominance'];
const KIND_COLOR: Record<LinkKind, string> = { electromagnetic: 'var(--accent)', companionship: 'var(--good)', compromise: 'var(--care)', dominance: 'var(--silver)' };
const TILE: Record<LinkKind, string> = { electromagnetic: 'Электро\u00ADмагнит', companionship: 'Общий канал', compromise: 'Компро\u00ADмисс', dominance: 'Доми\u00ADнанта' };
const ANGLE: Record<Angle, string> = { right: 'правый угол', juxta: 'джукстапозиция', left: 'левый угол' };
const chText = (key: string) => (content.channels as Record<string, { name: string; text: string }>)[key]?.text ?? '';
const typeName = (t: string) => (content.types as Record<string, { name: string }>)[t]?.name ?? t;

export function PairScreen({ nav }: { nav: Nav }) {
  const { settings, update } = useStore();
  const pair = settings.pair;
  const [editing, setEditing] = useState(!pair);
  const [name, setName] = useState(pair?.name ?? '');
  const [birth, setBirth] = useState<BirthValue>(birthValueOf(null, pair?.birth ?? null));
  const tone = settings.theme === 'light' ? 'light' : 'night';

  const me = useMemo<Bodygraph | null>(() => {
    try {
      return settings.humanDesign ? bodygraph(settings.humanDesign) : null;
    } catch {
      return null;
    }
  }, [settings.humanDesign]);
  const partner = useMemo<Bodygraph | null>(() => {
    try {
      return pair ? bodygraph(pair.birth) : null;
    } catch {
      return null;
    }
  }, [pair]);

  if (!me) {
    return (
      <div className="space-y-4 pb-8 pt-2">
        <Header />
        <Card className="space-y-3 text-[15px] leading-6">
          <p>Чтобы сравнить карты, сначала нужны твои дата, время и место рождения.</p>
          <Button className="w-full" onClick={() => nav.push({ name: 'profile' })}>
            Указать мои данные
          </Button>
        </Card>
      </div>
    );
  }

  const r = birthResult(birth);
  const canSave = !!r.humanDesign && name.trim().length > 0;
  if (editing || !partner || !pair) {
    return (
      <div className="space-y-4 pb-8 pt-2">
        <Header />
        <Card className="space-y-3">
          <Label>Как зовут</Label>
          <input className={field} value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Имя" aria-label="Имя" />
        </Card>
        <BirthForm value={birth} onChange={setBirth} />
        {!r.humanDesign && birth.date && <div className="px-1 text-[13px] text-faint">Для совместимости нужны и время, и место рождения.</div>}
        <Button
          className="w-full"
          disabled={!canSave}
          onClick={() => {
            haptic.success();
            void update({ pair: { name: name.trim(), birth: r.humanDesign! } });
            setEditing(false);
          }}
        >
          Показать совместимость
        </Button>
        <p className="px-1 text-[12px] leading-5 text-faint">Данные второго человека хранятся только на этом телефоне и никуда не отправляются.</p>
      </div>
    );
  }

  const c = composite(me, partner);
  const g = graphView(me, { from: new Date(0), to: new Date(0), segments: [], channels: [], centers: [], gateHits: [] } as never);
  const layer = partnerLayer(me, partner);
  const P = PALETTE[tone];
  const by = (k: LinkKind) => c.links.filter((l) => l.kind === k);
  const shared = sharedCenters(me, partner);
  const bridge = profileBridge(me, partner);
  const split = splitBridges(me, partner);
  const D = PAIR_TEXT.definition;
  const defText = me.definition === 'single' ? D.single : me.definition === 'split' ? D.split : me.definition === 'none' ? D.none : D.multi;

  return (
    <div className="space-y-4 pb-8 pt-2">
      <Header sub={`Ты и ${pair.name}`} />
      <Panel className="p-4">
        <BodygraphSvg g={g} layer={layer} tone={tone} silhouette={settings.hdSilhouette ?? 'm'} className="mx-auto block w-full max-w-[420px]" />
        <div className="mt-2 flex justify-center gap-5 text-[13px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: P.personality }} />
            ты
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: P.transit }} />
            {pair.name}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {ORDER.map((k) => (
            <div key={k} className="rounded-2xl bg-surface-2 px-1 py-2.5">
              <div className="font-display text-[22px] font-light" style={{ color: KIND_COLOR[k] }}>
                {by(k).length}
              </div>
              <div className="hyphens-manual text-[10.5px] leading-tight text-muted">{TILE[k]}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Card className="space-y-2 text-[15px] leading-6">
        <Label>Основа: общие центры</Label>
        {shared.length ? (
          <p>
            Определены у обоих: <b>{shared.map(centerTitle).join(', ')}</b>.
          </p>
        ) : null}
        <p className={shared.length ? 'text-[14px] leading-5 text-muted' : ''}>{shared.length ? PAIR_TEXT.shared.text : PAIR_TEXT.shared.none}</p>
        <Source s={PAIR_TEXT.shared.source} />
      </Card>

      {c.links.some(isLoveLink) && (
        <Card className="space-y-1.5">
          <div className="flex items-center gap-2 text-[15px] font-medium">
            <span style={{ color: 'var(--accent)' }}>♡</span> Ворота любви
          </div>
          <p className="text-[14px] leading-5 text-muted">{PAIR_TEXT.love.text}</p>
          <Source s={PAIR_TEXT.love.source} />
        </Card>
      )}

      {ORDER.map((k) =>
        by(k).length ? (
          <Card key={k} className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: KIND_COLOR[k] }} />
                <span className="font-serif text-[22px] font-medium">{LINK_TEXT[k].title}</span>
              </div>
              <p className="mt-1 text-[14px] leading-5 text-muted">{LINK_TEXT[k].text}</p>
            </div>
            {by(k)
              .slice()
              .sort((x, y) => Number(isLoveLink(y)) - Number(isLoveLink(x)))
              .map((l) => (
                <LinkRow key={l.key} l={l} who={l.holder === 'a' ? 'ты' : l.holder === 'b' ? pair.name : null} />
              ))}
            <Source s={LINK_TEXT[k].source} />
          </Card>
        ) : null,
      )}

      <Card className="space-y-2 text-[15px] leading-6">
        <Label>Профили</Label>
        <p>
          Ты <b>{me.profile.join('/')}</b> ({ANGLE[profileAngle(me.profile)]}), {pair.name} <b>{partner.profile.join('/')}</b> ({ANGLE[profileAngle(partner.profile)]}).
        </p>
        {bridge ? (
          <p className="text-muted">
            Мостик: {[...bridge.resonance.map((l) => `резонанс по ${l}-й линии`), ...bridge.harmony.map(([m, t]) => `гармония ${m} и ${t}`)].join(', ')}.
          </p>
        ) : null}
        <p className="text-[14px] leading-5 text-muted">
          {bridge ? PAIR_TEXT.profile.bridge : PAIR_TEXT.profile.noBridge}
          {profileAngle(me.profile) !== profileAngle(partner.profile) ? ` ${PAIR_TEXT.profile.angles}` : ''}
        </p>
        <Source s={PAIR_TEXT.profile.source} />
      </Card>

      <Card className="space-y-2 text-[15px] leading-6">
        <Label>Типы</Label>
        <p>
          Ты — <b>{typeName(me.type).toLowerCase()}</b>, {pair.name} — <b>{typeName(partner.type).toLowerCase()}</b>.
        </p>
        <p className="text-[14px] leading-5 text-muted">{me.type === partner.type ? PAIR_TEXT.types.same : PAIR_TEXT.types.diff}</p>
        <Source s={PAIR_TEXT.types.source} />
      </Card>

      <Card className="space-y-2 text-[15px] leading-6">
        <Label>Твоя определённость и мостики</Label>
        <p className="text-[14px] leading-5 text-muted">{defText}</p>
        {split && (
          <>
            {split.gates.length > 0 && (
              <p>
                У {pair.name} есть твои ворота-мостики: <b>{split.gates.join(', ')}</b>. {PAIR_TEXT.definition.simple}
              </p>
            )}
            {split.channels.length > 0 && (
              <p>
                {pair.name} соединяет твои части целым каналом: <b>{split.channels.map((k) => `${k.replace('-', '–')} «${channelTitle(k)}»`).join(', ')}</b>. {PAIR_TEXT.definition.wide}
              </p>
            )}
            {!split.gates.length && !split.channels.length && <p className="text-muted">{pair.name} напрямую не соединяет части твоей определённости.</p>}
            {split.whole && (split.gates.length > 0 || split.channels.length > 0) && <p className="text-muted">Вместе ваша общая определённость соединяет все твои части в одну.</p>}
          </>
        )}
        <Source s={PAIR_TEXT.definition.source} />
      </Card>

      <button className="mx-auto block text-[14px] text-accent" onClick={() => setEditing(true)}>
        Изменить данные или выбрать другого человека
      </button>
      <p className="px-1 text-[12px] leading-5 text-faint">Тексты о связях — по книге Ра Уру Ху «Книга любви» и материалу «Определённости и разрывы», смыслы каналов — по материалам курса. Данные второго человека хранятся только на этом телефоне.</p>
    </div>
  );
}

function Source({ s }: { s: string }) {
  return <div className="text-[11.5px] leading-4 text-faint">Источник: {s}</div>;
}

function LinkRow({ l, who }: { l: Link; who: string | null }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3.5 py-3">
      <div className="text-[15px] font-medium">
        {isLoveLink(l) && <span style={{ color: 'var(--accent)' }}>♡ </span>}
        {l.gates[0]}–{l.gates[1]} «{channelTitle(l.key)}»{who ? <span className="font-normal text-faint"> · целиком: {who}</span> : null}
      </div>
      <div className="mt-0.5 text-[14px] leading-5 text-muted">{chText(l.key).charAt(0).toUpperCase() + chText(l.key).slice(1)}.</div>
    </div>
  );
}

function Header({ sub }: { sub?: string }) {
  return (
    <header className="px-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Дизайн человека</div>
      <h1 className="mt-1 font-serif text-[32px] font-medium leading-[1.1]">Совместимость</h1>
      {sub && <p className="mt-1 text-[15px] text-muted">{sub}</p>}
    </header>
  );
}
