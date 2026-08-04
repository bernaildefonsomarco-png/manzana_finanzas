// `46` `RUL-MAIL-07` — "recordatorio · cuota:debt_31c#4 · 2026-07-26". Un
// correo duplicado es peor que un correo tarde; la clave se compone del
// tipo, el sujeto y el día, nunca de un valor aleatorio por intento.
export function buildEmailIdempotencyKey(input: {
  template: string;
  subjectRef: string;
  isoDate: string;
}): string {
  return `${input.template}·${input.subjectRef}·${input.isoDate}`;
}
