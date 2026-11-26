#!/bin/bash
# Собирает папку бота для Бегета: dist-bot/energy-bot (bot.mjs, zapusk.sh, fonts/, node_modules/@resvg).
# Запуск: bash beget/sobrat.sh (после npm ci). Настройки, данные и журнал сюда НЕ попадают никогда.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=dist-bot/energy-bot
rm -rf dist-bot && mkdir -p "$OUT/node_modules/@resvg" "$OUT/fonts"
npx esbuild scripts/bot.ts --bundle --platform=node --format=esm --target=node18 \
  --external:@resvg/resvg-js \
  "--banner:js=import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" \
  --outfile="$OUT/bot.mjs" --log-level=warning
cp beget/zapusk.sh "$OUT/zapusk.sh" && chmod +x "$OUT/zapusk.sh"
cp scripts/fonts/*.ttf "$OUT/fonts/"
cp -r node_modules/@resvg/resvg-js "$OUT/node_modules/@resvg/"
cp -r node_modules/@resvg/resvg-js-linux-x64-gnu "$OUT/node_modules/@resvg/"
rm -rf "$OUT/node_modules/@resvg/resvg-js/node_modules"
echo "${GITHUB_SHA:-local} $(date -u '+%Y-%m-%d %H:%M UTC')" > "$OUT/versiya.txt"
echo "Собрано: $OUT"; ls -la "$OUT"
