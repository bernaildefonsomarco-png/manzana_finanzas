import type { Debt } from "@/shared/types/domain";
import { ApiClientError, parseApiResponse } from "./http-client";

export { ApiClientError };

export type DebtWithPerson = Debt & { related_person?: { display_name: string } | null };

/** Selector de deuda existente para `pago_deuda`/`devolucion_recibida` (`26` §4.3). */
export async function listDebts(): Promise<DebtWithPerson[]> {
  const response = await fetch("/api/v1/debts", { credentials: "same-origin" });
  const data = await parseApiResponse<{ debts: DebtWithPerson[] }>(response);
  return data.debts;
}
