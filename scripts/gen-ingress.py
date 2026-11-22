"""
Таблица смен ворот (ингрессий) для транзитов Дизайна человека — по Swiss Ephemeris.

Зачем: astronomy-engine даёт долготы планет с точностью до нескольких угловых секунд. Для быстрых
тел (Солнце, Земля, Луна) это ±1 минута по времени смены ворот, а у медленных планет у станции
(Нептун, Плутон, Сатурн, узлы) те же секунды дуги превращаются в часы. Поэтому моменты смены ворот
для Меркурия…Плутона и узлов берутся из этой таблицы, посчитанной полной Swiss Ephemeris
(файлы sepl_18.se1, semo_18.se1) — той же, на которой работают сайты по Дизайну человека.

Запуск (вне приложения, нужен Python):
  pip install pyswisseph
  скачать sepl_18.se1 и semo_18.se1 из https://github.com/aloistr/swisseph/tree/master/ephe в папку EPHE
  python scripts/gen-ingress.py EPHE > src/humandesign/data/ingress.json
"""
import sys, json, datetime as dt
import swisseph as swe

swe.set_ephe_path(sys.argv[1])
FROM = dt.datetime(2024, 1, 1, tzinfo=dt.timezone.utc)
TO = dt.datetime(2041, 1, 1, tzinfo=dt.timezone.utc)
ORDER = [41,19,13,49,30,55,37,63,22,36,25,17,21,51,42,3,27,24,2,23,8,20,16,35,45,12,15,52,39,53,62,56,31,33,7,4,29,59,40,64,47,6,46,18,48,57,32,50,28,44,1,43,14,34,9,5,26,11,10,58,38,54,61,60]
BODIES = {'mercury': swe.MERCURY, 'venus': swe.VENUS, 'mars': swe.MARS, 'jupiter': swe.JUPITER, 'saturn': swe.SATURN,
          'uranus': swe.URANUS, 'neptune': swe.NEPTUNE, 'pluto': swe.PLUTO, 'northNode': swe.TRUE_NODE, 'southNode': swe.TRUE_NODE}

def jd(t):
    return swe.julday(t.year, t.month, t.day, t.hour + t.minute / 60 + t.second / 3600 + t.microsecond / 3.6e9)

def gate(name, t):
    lon = swe.calc_ut(jd(t), BODIES[name], swe.FLG_SWIEPH)[0][0]
    if name == 'southNode':
        lon = (lon + 180) % 360
    return ORDER[int(((lon - 302) % 360) // 5.625)]

out = {
    'source': 'Swiss Ephemeris %s (pyswisseph, файлы sepl_18/semo_18), геоцентрические видимые тропические долготы, узел — True Node' % swe.version,
    'from': FROM.isoformat().replace('+00:00', 'Z'),
    'to': TO.isoformat().replace('+00:00', 'Z'),
    'unit': 'секунды от from',
    'bodies': {},
}
STEP = dt.timedelta(minutes=30)  # самые быстрые здесь (Меркурий) проходят ворота за ~2 дня
for name in BODIES:
    t = FROM
    g = gate(name, t)
    rows = [[0, g]]
    while t < TO:
        n = min(t + STEP, TO)
        g2 = gate(name, n)
        if g2 != g:
            lo, hi = t, n
            while (hi - lo).total_seconds() > 1:
                m = lo + (hi - lo) / 2
                if gate(name, m) == g: lo = m
                else: hi = m
            rows.append([round((hi - FROM).total_seconds()), gate(name, hi)])
            g = gate(name, hi)
        t = n
    out['bodies'][name] = rows
print(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
