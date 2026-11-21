# Эталоны для сверки

- `phases-reference.json` — моменты новолуний и полнолуний (UTC).
- `eclipses-reference.json` — затмения 2025–2026.
- `personal-day.json` — результаты калькулятора «Личный день» с astromeridian.ru.
  Формат: `{ "birthday": { "day": 5, "month": 3 }, "cases": [ { "date": "2026-11-19", "personalDay": 7 } ] }`.

Этап 2 добавит сюда восходы Луны для Екатеринбурга, номера лунных суток с российских сайтов,
ингрессии и периоды Луны без курса.

- Оценки сфер по лунным дням: `src/content/data/lunar-areas.json` (life-moon.pp.ru, /moon-days/1/ … /30/, 21.11.2026). См. D-113.
