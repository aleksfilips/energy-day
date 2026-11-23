/** Освещённая часть диска Луны (как moonLitPath в приложении), с округлением — для виджета, где важен каждый байт. */
export function moonPath(angle: number, r: number): string {
  const a = ((angle % 360) + 360) % 360;
  if (a < 0.5 || a > 359.5) return '';
  const rx = +(Math.abs(Math.cos((a * Math.PI) / 180)) * r).toFixed(1);
  if (Math.abs(a - 180) < 0.5) return `M0 ${-r}A${r} ${r} 0 1 1 0 ${r}A${r} ${r} 0 1 1 0 ${-r}Z`;
  return a < 180 ? `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${rx} ${r} 0 0 ${a > 90 ? 1 : 0} 0 ${-r}Z` : `M0 ${-r}A${r} ${r} 0 0 0 0 ${r}A${rx} ${r} 0 0 ${a < 270 ? 0 : 1} 0 ${-r}Z`;
}
