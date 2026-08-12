import type { DebtCloseReason } from "./debt-action-proposal";

/**
 * `RUL-DEUDAS-13` (mismo contrato que `RUL-ESTR-05` en estructura): lo que pasa
 * de verdad al cerrar, reabrir o saltar, dicho antes de tocar nada y siempre con
 * las mismas palabras.
 *
 * Este texto **no lo redacta el modelo**. Una confirmacion destructiva vale lo
 * que valga el entendimiento de lo que se va a perder, y el modelo puede
 * suavizarlo, omitirlo o inventarlo. Aqui esta escrito una vez, es
 * deterministico y se antepone a la pregunta del turno.
 *
 * Cada frase describe la consecuencia **real**, verificada contra
 * `manzana.commit_debt_operation` (`supabase/migrations/057`):
 *
 *  - **cerrar como pagada**: `status = 'paid'`, `closed_at = now()`. El RPC
 *    exige `current_balance = 0` (`DEBT_OPERATION_PAID_WITH_BALANCE`), asi que
 *    esta rama nunca oculta saldo.
 *  - **cerrar como condonada**: `status = 'cancelled'`, guarda
 *    `metadata.forgiven_balance` con el saldo vivo y **despues** lo lleva a 0.
 *    El RPC exige saldo > 0 (`DEBT_OPERATION_FORGIVEN_WITHOUT_BALANCE`). Ese
 *    saldo no se pagó y no cuenta como pago (`WEB-D204`).
 *  - **reabrir**: solo una condonada (`status = 'cancelled'`) con
 *    `forgiven_balance`; devuelve exactamente esa cifra al saldo. Una **pagada
 *    no se reabre** (`DEBT_OPERATION_PAID_CANNOT_REOPEN`).
 *  - **saltar cuota**: marca la cuota `skipped` con motivo auditable. No mueve
 *    dinero ni reduce el saldo de la deuda: lo que se debia se sigue debiendo.
 *  - **reprogramar cuota**: cambia solo la fecha de vencimiento y conserva
 *    `reschedule_history`. No toca importes ni asignaciones (`RUL-DEUDAS-12`).
 */

/**
 * La mitad que mas cuesta entender de un cierre: que significa cada opcion para
 * el saldo. Se dice con la cifra real porque "te la perdonaron" sin el numero
 * no permite decidir nada.
 */
export function describeDebtCloseConsequence(input: {
  debtName: string;
  reason: DebtCloseReason;
  balance: number;
  currency: "PEN" | "USD";
}): string {
  if (input.reason === "paid") {
    return `Ojo con esto: cerrar «${input.debtName}» como pagada deja constancia de que se pagó entera. Solo puedo hacerlo porque su saldo ya está en cero; si faltara algo, habría que registrarlo primero.`;
  }

  return `Ojo con esto: cerrar «${input.debtName}» como condonada dice que esos ${formatDebtMoney(input.balance, input.currency)} **no se pagaron** y ya no se van a pagar. Guardo esa cifra como perdonada, el saldo queda en cero y no cuenta como pago tuyo. La puedo reabrir después si te equivocaste.`;
}

/**
 * Lo que hay que decir antes de reabrir. Nombra el limite duro —una pagada no
 * vuelve— porque es la confusion que trae a la gente aqui.
 */
export function describeDebtReopenConsequence(input: {
  debtName: string;
}): string {
  return `Al reabrir «${input.debtName}» te devuelvo el saldo que quedó perdonado y vuelve a contar como deuda viva.`;
}

/**
 * `RUL-DEUDAS-08`: saltar no perdona. Es la frase que impide que alguien salte
 * cuotas creyendo que baja lo que debe.
 */
export function describeInstallmentSkipConsequence(input: {
  installmentNumber: number;
  debtName: string;
}): string {
  return `Ojo con esto: saltar la cuota ${input.installmentNumber} de «${input.debtName}» la marca como omitida con tu motivo, pero **no reduce lo que debes**: ese dinero se sigue debiendo y va a reaparecer en el saldo.`;
}

/** Reprogramar solo mueve la fecha. Decirlo evita que se lea como una quita. */
export function describeInstallmentRescheduleConsequence(input: {
  installmentNumber: number;
  debtName: string;
}): string {
  return `Solo muevo la fecha de la cuota ${input.installmentNumber} de «${input.debtName}»: el importe y lo que ya está pagado no cambian.`;
}

export function formatDebtMoney(
  amount: number,
  currency: "PEN" | "USD",
): string {
  const symbol = currency === "USD" ? "$" : "S/";
  return `${symbol}${amount.toFixed(2)}`;
}
