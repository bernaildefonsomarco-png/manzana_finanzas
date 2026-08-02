import { ApiClientError } from "@/features/movements/movements-api";

type ApiResponse<T> =
  | { ok: true; data: T; meta: { trace_id: string } }
  | { ok: false; error: { code: string; message: string }; meta: { trace_id: string } };

export type ReportPeriod = {
  from: string;
  to: string;
  gastoTotal: number;
  ingresoTotal: number;
  gastoMovementCount: number;
  ingresoMovementCount: number;
  byCategory: { category_id: string | null; total: number; movement_count: number }[];
  exclusions: { reason: string; count: number }[];
};

export function currentMonthValue(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function getReportPeriod(periodo: string, valor: string): Promise<ReportPeriod> {
  return request<ReportPeriod>(`/api/v1/reports/period?periodo=${periodo}&valor=${valor}`);
}

export type ExportJob = {
  id: string;
  kind: string;
  format: string;
  status: string;
  row_count: number | null;
  requested_at: string;
  completed_at: string | null;
  expires_at: string | null;
};

export async function listExports(): Promise<ExportJob[]> {
  const data = await request<{ exports: ExportJob[] }>("/api/v1/exports");
  return data.exports;
}

export async function requestExport(kind: "movimientos" | "datos_completos"): Promise<ExportJob> {
  const data = await request<{ export: ExportJob }>("/api/v1/exports", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ kind, format: kind === "datos_completos" ? "json" : "csv" }),
  });
  return data.export;
}

export async function getExportLink(id: string): Promise<string> {
  const data = await request<{ url: string }>(`/api/v1/exports/${id}/link`, { method: "POST" });
  return data.url;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new ApiClientError(payload.error.code, payload.error.message, response.status, payload.meta?.trace_id ?? null, {});
  }
  return payload.data;
}
