import { ApiClientError, type ApiResponse } from "@/features/movements/movements-api";

export type NaturalSearchScope =
  | "movements"
  | "money"
  | "debts"
  | "recurring"
  | "pending"
  | "memory"
  | "all";

export type NaturalSearchSource = {
  type:
    | "movement"
    | "debt"
    | "debt_installment"
    | "recurring_commitment"
    | "recurring_rule"
    | "pending"
    | "balance"
    | "memory";
  id: string;
  label: string;
  amount: number | null;
  currency: "PEN" | "USD";
  occurred_at: string | null;
  due_at?: string | null;
  status?: string | null;
  source_detail?: string | null;
};

export type NaturalSearchResult = {
  query: string;
  scope: NaturalSearchScope;
  mode: "answer" | "action_redirect";
  answer: {
    response_text: string;
    answer_kind:
      | "balance_snapshot"
      | "movement_summary"
      | "pending_summary"
      | "debt_summary"
      | "recurring_summary"
      | "memory_summary"
      | "clarification"
      | "unsupported";
    confidence: number;
    cited_facts: string[];
    used_tools: string[];
    follow_up_question: string | null;
    safety_flags: string[];
  };
  query_interpretation?: {
    kind: string;
    date_range: { start: string; end: string; label: string } | null;
    confidence: number;
  };
  sources: NaturalSearchSource[];
  tool_results?: Array<{
    tool_name: string;
    status: "called" | "skipped" | "failed";
    facts: string[];
    warnings: string[];
  }>;
  data_limits: string[];
};

export async function runNaturalSearch(input: {
  query: string;
  scope: NaturalSearchScope;
}): Promise<NaturalSearchResult> {
  const response = await fetch("/api/v1/search/natural", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as ApiResponse<NaturalSearchResult>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data;
}
