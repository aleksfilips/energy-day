#!/bin/bash
# «Энергия дня» — бот на Бегете. CronTab запускает этот файл каждую минуту.
# Всё, что происходит, пишется в log.txt (рядом с этим файлом). Личных данных в журнале нет.
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1
LOG="$DIR/log.txt"
say() { echo "$(date '+%d.%m %H:%M') $*" >> "$LOG"; }

# Один запуск за раз: если прошлый ещё идёт (утром с голосом — до пары минут), этот пропускаем.
if ! mkdir "$DIR/.zamok" 2>/dev/null; then
  if [ -n "$(find "$DIR/.zamok" -maxdepth 0 -mmin +15 2>/dev/null)" ]; then rmdir "$DIR/.zamok"; mkdir "$DIR/.zamok" || exit 0; else exit 0; fi
fi
trap 'rmdir "$DIR/.zamok" 2>/dev/null' EXIT

# Настройки (токен и ключ) — только из файла nastroyki.env, доступ к нему только у владельца аккаунта.
chmod 600 "$DIR/nastroyki.env" 2>/dev/null
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  case "$line" in ''|'#'*) continue ;; esac
  k="${line%%=*}"; v="${line#*=}"
  k="$(echo "$k" | tr -d ' ')"
  v="$(echo "$v" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  case "$v" in \'*\') v="${v#\'}"; v="${v%\'}" ;; \"*\") v="${v#\"}"; v="${v%\"}" ;; esac
  case "$k" in TELEGRAM_BOT_TOKEN|BOT_DATA_KEY|APP_URL|YANDEX_TTS_KEY|BOT_WIDGET|ADMIN_ID|ADMIN_TZ|ADMIN_NOTIFY) export "$k=$v" ;; esac
done < "$DIR/nastroyki.env"
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ "${#BOT_DATA_KEY}" -lt 16 ]; then
  say "ОШИБКА: в nastroyki.env нет токена бота или фраза BOT_DATA_KEY короче 16 букв."
  exit 0
fi

# Найти Node.js 18 или новее.
NODE=""
for n in "$(command -v node 2>/dev/null)" /usr/local/bin/node /usr/bin/node /usr/local/bin/node2* /usr/local/bin/node1[89]* /opt/node*/bin/node /usr/local/nodejs*/bin/node /opt/nodejs*/bin/node "$HOME"/.local/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do
  [ -x "$n" ] || continue
  major="$("$n" -p 'process.versions.node.split(".")[0]' 2>/dev/null)"
  if [ -n "$major" ] && [ "$major" -ge 18 ]; then NODE="$n"; break; fi
done
# Нет подходящего Node.js на сервере — один раз скачиваем свой в папку energy-bot/node.
if [ -z "$NODE" ] && [ -x "$DIR/node/bin/node" ] && "$DIR/node/bin/node" -v >/dev/null 2>&1; then NODE="$DIR/node/bin/node"; fi
if [ -z "$NODE" ]; then
  say "Node.js на сервере не нашёл — скачиваю свой (один раз, около минуты)."
  for url in "https://nodejs.org/dist/v20.18.1/node-v20.18.1-linux-x64.tar.gz" \
             "https://unofficial-builds.nodejs.org/download/release/v18.20.4/node-v18.20.4-linux-x64-glibc-217.tar.gz"; do
    rm -rf "$DIR/node" "$DIR/node.tgz"; mkdir -p "$DIR/node"
    if curl -fsSL -o "$DIR/node.tgz" "$url" && tar -xzf "$DIR/node.tgz" -C "$DIR/node" --strip-components=1 && "$DIR/node/bin/node" -v >/dev/null 2>&1; then
      NODE="$DIR/node/bin/node"; rm -f "$DIR/node.tgz"; say "Скачал Node.js $("$NODE" -v)."; break
    fi
    say "Этот вариант Node.js не подошёл: $url"
  done
  rm -f "$DIR/node.tgz"
fi
if [ -z "$NODE" ]; then say "ОШИБКА: не нашёл Node.js 18 или новее и не смог скачать. $(ldd --version 2>&1 | head -1)"; exit 0; fi
export PATH="$HOME/.local/bin:$PATH"

# Первый запуск: забрать список подписчиков с GitHub (он зашифрован той же фразой BOT_DATA_KEY).
mkdir -p "$DIR/data"
if [ ! -f "$DIR/data/.perenos" ]; then
  if curl -fsSL -o "$DIR/data/subscribers.enc" "https://raw.githubusercontent.com/aleksfilips/energy-day/bot-data/subscribers.enc"; then
    say "Перенёс список подписчиков с GitHub."
  else
    rm -f "$DIR/data/subscribers.enc"; say "Списка на GitHub нет — начинаю с пустого."
  fi
  touch "$DIR/data/.perenos"
  say "Node.js: $("$NODE" -v) ($NODE)"
fi

OUT="$("$NODE" --no-warnings "$DIR/bot.mjs" --data "$DIR/data/subscribers.enc" 2>&1)"
CODE=$?
# В журнал — только итоговая строка и ошибки (без «тишины» каждую минуту).
echo "$OUT" | grep -v '^Подписчиков: [0-9]*\. Сообщений боту: 0, подписались/обновили: 0, отписались: 0\. Отправлено утренних: 0, о смене дня: 0, прочих уведомлений: 0, ошибок: 0, удалено недоступных: 0\.$' | grep -v '^$' | while IFS= read -r line; do say "$line"; done
[ $CODE -ne 0 ] && say "Бот завершился с ошибкой (код $CODE)."
# Раз в час — короткая отметка «жив», чтобы было видно, что будильник работает.
[ "$(date +%M)" = "00" ] && say "Работаю. $(echo "$OUT" | grep -o 'Подписчиков: [0-9]*')"
# Журнал не больше 3000 строк.
if [ "$(wc -l < "$LOG")" -gt 3000 ]; then tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"; fi
exit 0
