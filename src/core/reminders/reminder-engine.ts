import type { ReminderKind } from "@/shared/types/domain";

export type ReminderDraft = {
  kind: ReminderKind;
  subjectKey: string;
  title: string;
  body: string;
  actionUrl: string | null;
  priority: number;
  expiresAt: string;
};

// RUL-NOTIF-08: orden de prioridad cuando compiten (solo importa para el
// correo, que tiene limite diario; se reutiliza tambien para ordenar la
// bandeja, donde no cambia nada funcional pero da un orden estable).
const PRIORITY_BY_KIND: Record<ReminderKind, number> = {
  descarga_lista: 100,
  correo_desconectado: 90,
  pago_vencido: 82,
  cuota_vencida: 81,
  pago_proximo: 72,
  cuota_proxima: 71,
  presupuesto_umbral: 60,
  confirmar_hecho: 55,
  pendientes_acumulados: 50,
  sin_registrar: 10,
};

export function priorityForKind(kind: ReminderKind): number {
  return PRIORITY_BY_KIND[kind];
}

const DEFAULT_EXPIRY_DAYS = 30;

function expiresAtFrom(now: Date, days: number = DEFAULT_EXPIRY_DAYS): string {
  const expires = new Date(now.getTime());
  expires.setUTCDate(expires.getUTCDate() + days);
  return expires.toISOString();
}

function formatMoney(amount: number | null, currency: string): string {
  if (amount === null) return "";
  const symbol = currency === "USD" ? "US$" : "S/";
  return `${symbol}${amount.toFixed(2)}`;
}

function localIsoDate(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function daysBetweenIsoDates(from: string, to: string): number {
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
}

function formatDueDay(dueDate: string, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    weekday: "long",
  });
  return formatter.format(new Date(`${dueDate}T12:00:00Z`));
}

export type RecurringDueInput = {
  ruleId: string;
  ruleName: string;
  amount: number | null;
  currency: string;
  expectedDate: string; // AAAA-MM-DD
  overdue: boolean;
};

export type DebtInstallmentDueInput = {
  debtId: string;
  debtName: string;
  number: number;
  amount: number;
  currency: string;
  dueDate: string; // AAAA-MM-DD
  overdue: boolean;
};

export type UnhealthyEmailSourceInput = {
  id: string;
  label: string;
  disconnectedSinceIso: string | null;
};

export type ReminderEvaluatorInput = {
  now?: Date;
  timezone?: string;
  recurringDue?: RecurringDueInput[];
  debtInstallmentsDue?: DebtInstallmentDueInput[];
  openPendingCount?: number;
  pendingResolvedInLast24h?: boolean;
  lastMovementAt?: string | null;
  lastAssistantOrCorrectionAt?: string | null;
  unhealthyEmailSources?: UnhealthyEmailSourceInput[];
  existingOpenSubjectKeys?: ReadonlySet<string>;
  isPaused?: boolean;
};

// RUL-NOTIF-01 a RUL-NOTIF-07: candidatos deterministas para los tipos que
// se evaluan por escaneo diario. `presupuesto_umbral`, `descarga_lista` y
// `confirmar_hecho` no viven aqui: el primero nace del evento
// `budget_threshold_crossed` (un umbral es un evento, no un nivel
// re-derivable sin recordar el dia anterior) y los otros dos nacen de un
// trigger de base de datos sobre su propia tabla (export_jobs,
// user_profile_candidates) para no perder la garantia de "misma
// transaccion" de RUL-NOTIF-06 en su resolucion.
export function buildReminderDrafts(input: ReminderEvaluatorInput): ReminderDraft[] {
  if (input.isPaused) return [];

  const now = input.now ?? new Date();
  const timezone = input.timezone ?? "America/Lima";
  const today = localIsoDate(now, timezone);
  const existing = input.existingOpenSubjectKeys ?? new Set<string>();
  const drafts: ReminderDraft[] = [];

  for (const rule of input.recurringDue ?? []) {
    const subjectKey = `compromiso:${rule.ruleId}`;
    if (existing.has(subjectKey)) continue;
    const kind: ReminderKind = rule.overdue ? "pago_vencido" : "pago_proximo";
    const amountText = formatMoney(rule.amount, rule.currency);
    const title = rule.overdue
      ? `${rule.ruleName} venció y no lo veo registrado`
      : `${rule.ruleName}${amountText ? ` (${amountText})` : ""} vence el ${formatDueDay(rule.expectedDate, timezone)}`;
    const body = rule.overdue
      ? `Esperaba este pago el ${rule.expectedDate} y todavía no aparece registrado.`
      : `Puedes registrarlo cuando lo pagues.`;
    drafts.push({
      kind,
      subjectKey,
      title: title.slice(0, 80),
      body: body.slice(0, 200),
      actionUrl: "/pagos-que-vienen",
      priority: priorityForKind(kind),
      expiresAt: expiresAtFrom(now),
    });
  }

  for (const installment of input.debtInstallmentsDue ?? []) {
    const subjectKey = `cuota:${installment.debtId}#${installment.number}`;
    if (existing.has(subjectKey)) continue;
    const kind: ReminderKind = installment.overdue ? "cuota_vencida" : "cuota_proxima";
    const amountText = formatMoney(installment.amount, installment.currency);
    const title = installment.overdue
      ? `Tu cuota de ${installment.debtName} venció el ${installment.dueDate} y no la veo registrada`
      : `Tu cuota de ${installment.debtName}${amountText ? ` (${amountText})` : ""} vence el ${formatDueDay(installment.dueDate, timezone)}`;
    drafts.push({
      kind,
      subjectKey,
      title: title.slice(0, 80),
      body: "Puedes registrar el pago cuando lo hagas.".slice(0, 200),
      actionUrl: `/deudas/${installment.debtId}`,
      priority: priorityForKind(kind),
      expiresAt: expiresAtFrom(now),
    });
  }

  const pendingSubjectKey = "pendientes";
  if (
    (input.openPendingCount ?? 0) >= 5 &&
    !input.pendingResolvedInLast24h &&
    !existing.has(pendingSubjectKey)
  ) {
    drafts.push({
      kind: "pendientes_acumulados",
      subjectKey: pendingSubjectKey,
      title: `Tienes ${input.openPendingCount} movimientos del banco sin confirmar.`.slice(0, 80),
      body: "Puedes revisarlos y confirmarlos en un momento.".slice(0, 200),
      actionUrl: "/pendientes",
      priority: priorityForKind("pendientes_acumulados"),
      expiresAt: expiresAtFrom(now),
    });
  }

  const ausenciaSubjectKey = "ausencia";
  const daysSinceMovement = input.lastMovementAt
    ? daysBetweenIsoDates(localIsoDate(new Date(input.lastMovementAt), timezone), today)
    : Number.POSITIVE_INFINITY;
  const daysSinceAssistant = input.lastAssistantOrCorrectionAt
    ? daysBetweenIsoDates(localIsoDate(new Date(input.lastAssistantOrCorrectionAt), timezone), today)
    : Number.POSITIVE_INFINITY;
  if (
    daysSinceMovement >= 7 &&
    daysSinceAssistant >= 7 &&
    !existing.has(ausenciaSubjectKey)
  ) {
    drafts.push({
      kind: "sin_registrar",
      subjectKey: ausenciaSubjectKey,
      title: "No has registrado nada en la última semana.".slice(0, 80),
      body: "Cuando quieras, puedes registrar algo o revisar tu Inicio.".slice(0, 200),
      actionUrl: "/movimientos/nuevo",
      priority: priorityForKind("sin_registrar"),
      expiresAt: expiresAtFrom(now, 7),
    });
  }

  for (const source of input.unhealthyEmailSources ?? []) {
    const subjectKey = `buzon:${source.id}`;
    if (existing.has(subjectKey)) continue;
    const sinceText = source.disconnectedSinceIso
      ? ` desde el ${localIsoDate(new Date(source.disconnectedSinceIso), timezone).slice(8, 10)}`
      : "";
    drafts.push({
      kind: "correo_desconectado",
      subjectKey,
      title: `Dejé de recibir correos de ${source.label}${sinceText}.`.slice(0, 80),
      body: "Puede que hayan cambiado la dirección. Revisa la conexión cuando puedas.".slice(0, 200),
      actionUrl: "/configuracion/correo/estado",
      priority: priorityForKind("correo_desconectado"),
      expiresAt: expiresAtFrom(now),
    });
  }

  return drafts.sort((a, b) => b.priority - a.priority);
}
