/** «Пригласить близких»: ссылка, которая сразу открывает приложение; каждый вводит свои данные сам. */
import { useState } from 'react';
import { INVITE_TEXT, inviteLink } from '../../config';
import { haptic, tg } from '../../telegram';
import { Button, Card } from '../ui';

export function shareUrl(link: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
}

export function InviteCard() {
  const [copied, setCopied] = useState(false);
  const link = inviteLink();

  const share = async () => {
    haptic.tap();
    const t = tg();
    if (t?.openTelegramLink) {
      t.openTelegramLink(shareUrl(link, INVITE_TEXT));
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: 'Энергия дня', text: INVITE_TEXT, url: link }).catch(() => {});
      return;
    }
    await copy();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${INVITE_TEXT}\n${link}`);
      haptic.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* буфер недоступен */
    }
  };

  return (
    <Card className="hero space-y-3">
      <div className="flex items-center gap-3">
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden className="shrink-0">
          <circle cx="13" cy="17" r="9" fill="var(--moon-lit)" opacity="0.9" />
          <circle cx="21" cy="17" r="9" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
        </svg>
        <div>
          <div className="text-[16px] font-medium">Пригласить близких</div>
          <div className="text-[13px] leading-5 text-muted">Каждый введёт свои данные и получит свой день</div>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button onClick={share}>Пригласить</Button>
        <Button variant="ghost" onClick={copy}>
          {copied ? '✓' : 'Ссылка'}
        </Button>
      </div>
    </Card>
  );
}
