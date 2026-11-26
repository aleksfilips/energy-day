#!/bin/bash
# «Энергия дня» — приёмник обновлений бота на Бегете.
# Ключ GitHub может запускать ТОЛЬКО этот файл (так записано в ~/.ssh/authorized_keys).
# Что он делает: принимает архив с новой версией бота и кладёт его в ~/energy-bot.
# Чего он НЕ делает никогда: не выполняет присланные команды, не читает и не отдаёт файлы,
# не трогает ничего вне ~/energy-bot (сайты и другие папки), не меняет nastroyki.env, data/, log.txt, node/.
set -u
umask 077
B="$HOME/energy-bot"
W="$HOME/.energy-bot-priem"
N="$W/novoe"
A="$W/novoe.tgz"
MAX=80000000
ZAMOK=""
uborka() { rm -rf "$N" "$A" "$W/spisok.txt"; [ -n "$ZAMOK" ] && rmdir "$B/.zamok" 2>/dev/null; }
trap uborka EXIT
trap 'exit 1' TERM HUP INT PIPE
fail() { echo "ОТКАЗ: $*"; exit 1; }

[ -f "$B/nastroyki.env" ] || fail "нет папки бота ~/energy-bot."
mkdir -p "$W"
rm -rf "$N" "$A"
# 1) Принять архив (не больше 80 МБ). Любая присланная «команда» игнорируется.
timeout 300 head -c "$((MAX + 1))" > "$A" || fail "архив не дошёл целиком."
[ "$(wc -c < "$A")" -le "$MAX" ] || fail "архив слишком большой."
# 2) Проверить содержимое ДО распаковки: только обычные файлы и папки, только разрешённые имена.
tar -tvzf "$A" > "$W/spisok.txt" 2>/dev/null || fail "архив повреждён."
if cut -c1 "$W/spisok.txt" | grep -qv '^[-d]$'; then fail "в архиве есть ссылки или особые файлы."; fi
while IFS= read -r name; do
  n="${name#./}"
  [ -z "$n" ] && continue
  case "$n" in /*|*..*|*'\'*) fail "недопустимое имя в архиве." ;; esac
  case "$n" in
    bot.mjs|zapusk.sh|versiya.txt|fonts|fonts/|fonts/*.ttf|node_modules|node_modules/|node_modules/@resvg/*) ;;
    *) fail "лишний файл в архиве: $n" ;;
  esac
done < <(tar -tzf "$A")
# 3) Распаковать во временную папку и проверить ещё раз.
mkdir -p "$N"
tar -xzf "$A" -C "$N" --no-same-owner --no-same-permissions --no-overwrite-dir 2>/dev/null || fail "не распаковалось."
[ -z "$(find "$N" ! -type f ! -type d)" ] || fail "в архиве есть ссылки."
for f in bot.mjs zapusk.sh versiya.txt; do [ -f "$N/$f" ] || fail "нет $f."; done
[ -d "$N/fonts" ] && [ -d "$N/node_modules/@resvg" ] || fail "нет шрифтов или библиотеки."
# 4) Дождаться, пока бот не работает (его «замок»), и подменить файлы.
got=""
for i in $(seq 1 180); do if mkdir "$B/.zamok" 2>/dev/null; then got=1; break; fi; sleep 1; done
[ -n "$got" ] || fail "бот занят дольше 3 минут, попробую в другой раз."
ZAMOK=1
rm -rf "$B/fonts.old" "$B/node_modules.old"
[ -d "$B/fonts" ] && mv "$B/fonts" "$B/fonts.old"
[ -d "$B/node_modules" ] && mv "$B/node_modules" "$B/node_modules.old"
mv "$N/fonts" "$B/fonts"
mv "$N/node_modules" "$B/node_modules"
[ -f "$B/bot.mjs" ] && cp -p "$B/bot.mjs" "$B/bot.mjs.old"
mv -f "$N/bot.mjs" "$B/bot.mjs"
mv -f "$N/zapusk.sh" "$B/zapusk.sh"
mv -f "$N/versiya.txt" "$B/versiya.txt"
chmod 700 "$B/zapusk.sh"
rm -rf "$B/fonts.old" "$B/node_modules.old"
echo "$(date '+%d.%m %H:%M') Обновился с GitHub: $(head -c 100 "$B/versiya.txt")" >> "$B/log.txt"
echo "Готово: бот обновлён до $(head -c 100 "$B/versiya.txt")"
