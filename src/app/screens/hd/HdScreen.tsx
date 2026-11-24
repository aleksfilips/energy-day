/** Раздел «Дизайн человека» (D-148): вкладки Карта · Мандала · Циклы · Мои люди. Грузится отдельно, когда его открывают. */
import { useMemo } from 'react';
import { bodygraph } from '../../../humandesign/chart';
import { useStore } from '../../store';
import type { Nav } from '../../App';
import { ChartTab } from './ChartTab';
import { CyclesTab } from './CyclesTab';
import { Header, Tabs, typeName, type HdTab } from './common';
import { MandalaTab } from './MandalaTab';
import { PeopleTab, PersonScreen } from './PeopleTab';
import { TimeScreen } from './TimeScreen';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const TITLE: Record<HdTab, [string, string | null]> = {
  chart: ['Моя карта', null],
  mandala: ['Мандала', 'Круг 64 ворот и 12 знаков: где стояли планеты в момент твоего рождения'],
  cycles: ['Циклы жизни', 'Большие этапы, когда медленные планеты возвращаются в свои точки'],
  people: ['Мои люди', 'Карты близких в одном месте'],
};

export function HdScreen({ tab = 'chart', nav }: { tab?: HdTab; nav: Nav }) {
  const { settings } = useStore();
  const birth = settings.humanDesign;
  const chart = useMemo(() => {
    if (!birth) return null;
    try {
      return bodygraph(birth);
    } catch {
      return null;
    }
  }, [birth]);
  const [title, sub] = TITLE[tab];
  const chartSub =
    chart && birth
      ? `${typeName(chart.type)} · ${chart.profile.join('/')} · ${birth.day} ${MONTHS[birth.month - 1]} ${birth.year}, ${String(birth.hour).padStart(2, '0')}:${String(birth.minute).padStart(2, '0')}${birth.place ? `, ${birth.place}` : ''}`
      : undefined;

  return (
    <div className="space-y-4 pb-8">
      <Header title={title} sub={sub ?? chartSub} />
      <Tabs active={tab} nav={nav} />
      {tab === 'people' ? (
        <PeopleTab nav={nav} />
      ) : !chart ? (
        <div className="rounded-[24px] border border-line bg-surface p-5 text-center shadow-[var(--shadow)]">
          <p className="text-[15px] leading-6 text-muted">Чтобы открыть карту, укажи дату, время и место рождения.</p>
          <button onClick={() => nav.push({ name: 'profile' })} className="mt-4 h-12 rounded-full bg-accent px-6 text-[16px] font-semibold text-bg">
            Указать данные рождения
          </button>
        </div>
      ) : tab === 'chart' ? (
        <ChartTab chart={chart} nav={nav} />
      ) : tab === 'mandala' ? (
        <MandalaTab chart={chart} />
      ) : (
        <CyclesTab chart={chart} />
      )}
    </div>
  );
}

export { PersonScreen, TimeScreen };
export default HdScreen;
