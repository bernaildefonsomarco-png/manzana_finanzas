import type { AccountType, BoxType } from "@/shared/types/domain";
import type { AccountMoneySummary } from "@/shared/api/money-types";

// `fisico` se muestra como "Efectivo", no "Físico" (04_glosario_y_lenguaje_visible.md).
export const accountTypeLabels: Record<AccountType, string> = {
  digital: "Digital",
  banco: "Banco",
  fisico: "Efectivo",
  tarjeta: "Tarjeta",
};

export const boxTypeLabels: Record<BoxType, string> = {
  compromiso: "Compromiso",
  objetivo: "Objetivo",
  emergencia: "Emergencia",
};

export function getAccountStatusLabel(account: AccountMoneySummary): string {
  if (account.balance_status === "negative") return "Saldo negativo";
  if (account.balance_status === "overspent") return "Libre negativo";
  if (account.box_count > 0) return `${account.box_count} cajas`;
  return "Sin cajas";
}

/**
 * `09` §6: jerarquía derivada del modelo mental — la frase bajo "Dinero
 * libre" explica de dónde sale la cifra, con los compromisos por cubrir
 * antes que las cajas (`upcomingUncoveredCommitments` antes que
 * `separatedInBoxes`), porque son la razón más probable de una sorpresa.
 */
export function getMoneyHeroCopy(input: {
  hasAccounts: boolean;
  separatedInBoxes: number;
  upcomingUncoveredCommitments: number;
}): string {
  if (!input.hasAccounts) {
    return "Agrega una cuenta para que Manzana pueda calcular dinero libre sin asumir saldos.";
  }
  if (input.upcomingUncoveredCommitments > 0) {
    return "Libre operativo descuenta compromisos proximos no cubiertos por cajas.";
  }
  if (input.separatedInBoxes > 0) {
    return "Este numero descuenta lo que ya separaste en cajas.";
  }
  return "Por ahora coincide con tu saldo registrado porque aun no hay cajas ni compromisos por descontar.";
}
