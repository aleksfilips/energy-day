/**
 * Настройки публикации. Здесь нет личных данных — только адреса приложения и бота.
 */

/** Логин Telegram-бота без «@». Пусто — приглашение даёт ссылку на сайт. */
export const BOT_USERNAME = 'EnergyDayFilips_bot';

/** Адрес приложения в интернете (GitHub Pages). */
export const SITE_URL = 'https://aleksfilips.github.io/energy-day/';

/**
 * Ссылка-приглашение. С ботом — прямая ссылка, которая сразу открывает приложение в Telegram
 * (у бота должно быть включено «Main Mini App» в @BotFather). Без бота — ссылка на сайт.
 */
export function inviteLink(bot: string = BOT_USERNAME): string {
  const b = bot.replace(/^@/, '').trim();
  return b ? `https://t.me/${b}?startapp=invite` : SITE_URL;
}

export const INVITE_TEXT = 'Попробуй «Энергию дня» — лунный календарь, который каждый день подсказывает, что сегодня хорошо делать и какое время удачное. Считается для твоего места и даты рождения.';
