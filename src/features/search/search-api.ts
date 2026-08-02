import { ApiClientError } from "@/features/movements/movements-api";

type ApiResponse<T> =
  | { ok: true; data: T; meta: { trace_id: string } }
  | { ok: false; error: { code: string; message: string }; meta: { trace_id: string } };

export type SearchMovementResult = {
  id: string;
  description: string | null;
  merchant: string | null;
  amount: number;
  currency: string;
  occurred_at: string;
  category_id: string | null;
  confirmed: boolean;
};

export type SearchResponse = {
  is_question: boolean;
  query?: string;
  filters?: {
    text: string | null;
    amount: { kind: string; amount: number } | null;
    date_range: { from: string; to: string; label: string } | null;
  };
  results: {
    movements: SearchMovementResult[];
    pending: SearchMovementResult[];
    accounts: { id: string; name: string; kind: string }[];
    categories: { id: string; label: string }[];
    debts: { id: string; name: string; related_person_name: string | null }[];
    commitments: { id: string; name: string }[];
  } | null;
};

export async function search(q: string): Promise<SearchResponse> {
  return request<SearchResponse>(`/api/v1/search?q=${encodeURIComponent(q)}`);
}

export async function suggestSpelling(q: string): Promise<string | null> {
  const data = await request<{ suggestion: string | null }>(`/api/v1/search/suggest?q=${encodeURIComponent(q)}`);
  return data.suggestion;
}

export async function saveSearch(name: string, query: string): Promise<void> {
  await request(`/api/v1/saved-searches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, query }),
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new ApiClientError(payload.error.code, payload.error.message, response.status, payload.meta?.trace_id ?? null, {});
  }
  return payload.data;
}
