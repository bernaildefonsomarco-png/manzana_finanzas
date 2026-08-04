// `48` caso borde 10 / `AC-AYUDA-13`: el modo discreto oculta montos, no
// texto descriptivo — usado donde una cifra viene ya formateada dentro de
// una oración (título/línea de procedencia) y por eso `MoneyText` no puede
// enmascararla por sí solo (`RUL-CONF-03`).
// `upcoming-view-model.ts` `formatUpcomingMoney` reduce el USD a `$` sin el
// prefijo `US`, así que el patrón también cubre el signo solo.
const AMOUNT_PATTERN = /(?:S\/|US\$|\$)[\d,]+(?:\.\d{2})?/g;

export function maskAmounts(text: string, discreet: boolean): string {
  if (!discreet) return text;
  return text.replace(AMOUNT_PATTERN, "••••");
}
