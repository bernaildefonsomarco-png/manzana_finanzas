import { describe, expect, it, vi } from "vitest";
import { listMemory } from "./memory.repository";

describe("presentador público de Memoria", () => {
  it("AC-MEM-19 elimina confianza, pesos y metadata de las tres clases", async () => {
    const client = memoryClient();
    const result = await listMemory(client as never, { userId: "user-1", includeInactive: true });
    expect(result.classification[0]).toMatchObject({ statement: "Rappi va en Alimentación", positive_evidence_count: 8 });
    expect(result.profile[0]).toMatchObject({ statement: "Cobras el 15", status: "vigente" });
    expect(result.preference[0]).toMatchObject({ subject_key: "default_view", status: "activa" });
    expect(JSON.stringify(result)).not.toMatch(/confidence|weight|metadata/i);
  });
});

function memoryClient() {
  const rows: Record<string, Record<string, unknown>[]> = {
    financial_memory_items: [{
      id: "11111111-1111-4111-8111-111111111111",
      canonical_key: "merchant:rappi",
      summary: "Rappi va en Alimentación",
      lifecycle_status: "confirmed",
      positive_evidence_refs: ["movement:1"],
      negative_evidence_refs: [],
      positive_evidence_count: 8,
      negative_evidence_count: 1,
      confidence: 0.95,
      metadata: { internal_weight: 9 },
      created_at: "2026-07-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
      last_used_at: "2026-08-01T00:00:00Z",
    }],
    user_profile_facts: [{
      id: "22222222-2222-4222-8222-222222222222",
      subject_key: "income_day:15",
      statement: "Cobras el 15",
      status: "vigente",
      positive_evidence_refs: ["movement:2"],
      negative_evidence_refs: [],
      positive_evidence_count: 1,
      negative_evidence_count: 0,
      metadata: { confidence: 1 },
      created_at: "2026-07-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    }],
    learned_preferences: [{
      id: "33333333-3333-4333-8333-333333333333",
      key: "default_view",
      value: "mensual",
      status: "activa",
      positive_evidence_refs: ["view:1"],
      negative_evidence_refs: [],
      positive_evidence_count: 15,
      negative_evidence_count: 0,
      metadata: { weight: 15 },
      created_at: "2026-07-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
      last_observed_at: "2026-08-01T00:00:00Z",
    }],
  };
  return {
    rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
    from: vi.fn((table: string) => thenableQuery(rows[table] ?? [])),
  };
}

function thenableQuery(data: Record<string, unknown>[]) {
  const result = { data, error: null };
  const query = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(),
    then: (fulfilled?: (value: typeof result) => unknown) => Promise.resolve(result).then(fulfilled),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  return query;
}
