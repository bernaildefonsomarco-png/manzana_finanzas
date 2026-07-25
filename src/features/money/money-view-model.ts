import type { AccountMoneySummary } from "./money-types";
import type { BoxType } from "@/shared/types/domain";

export const accountTypeLabels: Record<AccountMoneySummary["type"], string> = {
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

export function getMoneyHeroCopy(input: {
  hasAccounts: boolean;
  freeInAccounts: number;
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
