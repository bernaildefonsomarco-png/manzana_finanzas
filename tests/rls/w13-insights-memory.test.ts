import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  crearUsuarioDePrueba,
  limpiarUsuariosDePrueba,
  type UsuarioDePrueba,
} from "./lib/entorno";

let owner: UsuarioDePrueba;
let intruder: UsuarioDePrueba;

beforeAll(async () => {
  owner = await crearUsuarioDePrueba("w13-memory-owner");
  intruder = await crearUsuarioDePrueba("w13-memory-intruder");
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("W-13: RLS de Descubrimientos, Memoria y lotes", () => {
  it.each([
    "insight_feedback_events",
    "insight_type_preferences",
    "insight_action_receipts",
    "user_profile_facts",
    "user_profile_candidates",
    "learned_preferences",
    "memory_tombstones",
    "memory_events",
    "memory_operation_receipts",
    "classification_batches",
    "classification_action_receipts",
  ])("%s oculta filas ajenas y bloquea escritura directa", async (table) => {
    const read = await intruder.client.from(table).select("*").eq("user_id", owner.id);
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
    const write = await intruder.client.from(table).insert({ user_id: intruder.id });
    expect(write.error).not.toBeNull();
  });

  it("las operaciones autenticadas no pueden operar un recurso ajeno", async () => {
    const memory = await insertMemory(owner.id, `merchant:${randomUUID()}`, ["movement:one"]);
    const result = await intruder.client.rpc("commit_financial_memory_operation", {
      p_user_id: intruder.id,
      p_memory_id: memory.id,
      p_operation: "forget",
      p_summary: "",
      p_reason: "intruder",
      p_idempotency_key: `intruder-${randomUUID()}`,
      p_now: "2026-08-01T12:00:00Z",
    });
    expect(result.error?.message).toContain("MEMORY_NOT_FOUND");
  });
});

describe("RUL-MEM-03: umbral numérico de contradicción", () => {
  it("4 positivas + 2 negativas no suspenden; la tercera negativa consecutiva sí", async () => {
    const key = `merchant:${randomUUID()}`;
    let candidateId = "";
    const positiveRefs = [];
    for (let index = 1; index <= 4; index += 1) {
      const ref = `movement:positive-${index}-${randomUUID()}`;
      positiveRefs.push(ref);
      const recorded = await recordEvidence({ canonicalKey: key, evidenceRef: ref, polarity: "positive" });
      expect(recorded.error).toBeNull();
      candidateId = String((recorded.data as { id: string }).id);
    }
    const memory = await insertMemory(owner.id, key, positiveRefs, candidateId);

    for (let index = 1; index <= 2; index += 1) {
      const recorded = await recordEvidence({
        canonicalKey: key,
        evidenceRef: `movement:negative-${index}-${randomUUID()}`,
        polarity: "negative",
      });
      expect(recorded.error).toBeNull();
      const current = await admin.from("financial_memory_items").select("lifecycle_status").eq("id", memory.id).single();
      expect(current.data?.lifecycle_status).toBe("confirmed");
    }

    const third = await recordEvidence({
      canonicalKey: key,
      evidenceRef: `movement:negative-3-${randomUUID()}`,
      polarity: "negative",
    });
    expect(third.error).toBeNull();
    const suspended = await admin.from("financial_memory_items").select("lifecycle_status,negative_evidence_count").eq("id", memory.id).single();
    expect(suspended.data).toMatchObject({ lifecycle_status: "suspended", negative_evidence_count: 3 });
  });
});

describe("RUL-MEM-08/09/10: lápida, undo e idempotencia", () => {
  it("olvida atómicamente, bloquea reaprendizaje y una corrección explícita levanta la lápida", async () => {
    const key = `merchant:${randomUUID()}`;
    const memory = await insertMemory(owner.id, key, ["movement:seed"]);
    const idempotencyKey = `forget-${randomUUID()}`;
    const first = await commitMemory(owner, memory.id, "forget", idempotencyKey, "2026-08-01T12:00:00Z");
    const retry = await commitMemory(owner, memory.id, "forget", idempotencyKey, "2026-08-01T12:00:00Z");
    expect(first.error).toBeNull();
    expect(retry.data).toMatchObject({ idempotent: true });

    const [forgotten, tombstone, events] = await Promise.all([
      admin.from("financial_memory_items").select("lifecycle_status").eq("id", memory.id).single(),
      admin.from("memory_tombstones").select("id,lifted_at").eq("user_id", owner.id).eq("subject_key", key).single(),
      admin.from("memory_events").select("action,actor").eq("user_id", owner.id).eq("subject_id", memory.id),
    ]);
    expect(forgotten.data?.lifecycle_status).toBe("revoked");
    expect(tombstone.data?.lifted_at).toBeNull();
    expect(events.data).toContainEqual(expect.objectContaining({ action: "olvidado", actor: "usuario" }));

    const automatic = await recordEvidence({
      canonicalKey: key,
      evidenceRef: `movement:auto-${randomUUID()}`,
      polarity: "positive",
      basis: "repeated_behavior",
    });
    expect(automatic.error?.message).toContain("MEMORY_TOMBSTONED");
    const explicit = await recordEvidence({
      canonicalKey: key,
      evidenceRef: `movement:explicit-${randomUUID()}`,
      polarity: "positive",
      basis: "confirmed_correction",
    });
    expect(explicit.error).toBeNull();
    const lifted = await admin.from("memory_tombstones").select("lifted_at").eq("id", tombstone.data!.id).single();
    expect(lifted.data?.lifted_at).not.toBeNull();
  });

  it("deshace dentro de 30 días y rechaza al día 31", async () => {
    const recent = await insertMemory(owner.id, `merchant:${randomUUID()}`, ["movement:recent"]);
    await commitMemory(owner, recent.id, "forget", `forget-${randomUUID()}`, "2026-07-01T12:00:00Z");
    const undoRecent = await commitMemory(owner, recent.id, "undo", `undo-${randomUUID()}`, "2026-07-30T12:00:00Z");
    expect(undoRecent.error).toBeNull();
    expect(undoRecent.data).toMatchObject({ memory: { lifecycle_status: "confirmed" } });

    const old = await insertMemory(owner.id, `merchant:${randomUUID()}`, ["movement:old"]);
    await commitMemory(owner, old.id, "forget", `forget-${randomUUID()}`, "2026-07-01T12:00:00Z");
    const undoOld = await commitMemory(owner, old.id, "undo", `undo-${randomUUID()}`, "2026-08-01T12:00:01Z");
    expect(undoOld.error?.message).toContain("MEMORY_UNDO_WINDOW_EXPIRED");
  });

  it("la misma clave con otros datos devuelve conflicto y no crea una segunda versión", async () => {
    const memory = await insertMemory(owner.id, `merchant:${randomUUID()}`, ["movement:idempotency"]);
    const key = `memory-operation-${randomUUID()}`;
    const first = await commitMemory(owner, memory.id, "correct", key, "2026-08-01T12:00:00Z", "Rappi va en Alimentación");
    const conflict = await commitMemory(owner, memory.id, "correct", key, "2026-08-01T12:00:00Z", "Rappi va en Ocio");
    expect(first.error).toBeNull();
    expect(conflict.error?.message).toContain("MEMORY_IDEMPOTENCY_CONFLICT");
    const rows = await admin.from("financial_memory_items").select("id").eq("user_id", owner.id).like("canonical_key", `${memory.canonical_key}%`);
    expect(rows.data).toHaveLength(2);
  });

  it("ver, corregir, deshacer y olvidar guardan anterior, siguiente y actor", async () => {
    const memory = await insertMemory(owner.id, `classification:rappi:${randomUUID()}`, ["movement:audit"]);
    const viewed = await owner.client.rpc("commit_financial_memory_operation", {
      p_user_id: owner.id,
      p_memory_id: memory.id,
      p_operation: "view",
      p_summary: "",
      p_reason: "evidence_view",
      p_idempotency_key: `view-${randomUUID()}`,
      p_now: "2026-08-01T12:00:00Z",
    });
    expect(viewed.error).toBeNull();
    const corrected = await commitMemory(
      owner,
      memory.id,
      "correct",
      `correct-${randomUUID()}`,
      "2026-08-01T12:01:00Z",
      "Rappi va en Ocio",
    );
    expect(corrected.error).toBeNull();
    const replacementId = (corrected.data as { replacement: { id: string } }).replacement.id;
    const undone = await commitMemory(owner, replacementId, "undo", `undo-${randomUUID()}`, "2026-08-01T12:02:00Z");
    expect(undone.error).toBeNull();
    const forgotten = await commitMemory(owner, memory.id, "forget", `forget-${randomUUID()}`, "2026-08-01T12:03:00Z");
    expect(forgotten.error).toBeNull();

    const events = await admin
      .from("memory_events")
      .select("action,previous,next,actor")
      .eq("user_id", owner.id)
      .in("action", ["visto", "corregido", "deshecho", "olvidado"]);
    expect(events.error).toBeNull();
    for (const action of ["visto", "corregido", "deshecho", "olvidado"]) {
      expect(events.data).toContainEqual(expect.objectContaining({
        action,
        actor: "usuario",
        previous: expect.any(Object),
        next: expect.any(Object),
      }));
    }
  });
});

describe("RUL-MEM-01/11/13: perfil y caducidad", () => {
  it("rechaza atributos protegidos antes de guardarlos", async () => {
    const attempt = await admin.from("user_profile_candidates").insert({
      user_id: owner.id,
      subject_key: "salud:condicion",
      statement: "Tiene una condición",
      status: "pending_confirmation",
      evidence_refs: ["movement:sensitive"],
    });
    expect(attempt.error?.message).toContain("MEMORY_PROTECTED_ATTRIBUTE_REJECTED");
  });

  it("un candidato no es hecho hasta confirmarlo explícitamente", async () => {
    const candidateId = randomUUID();
    const inserted = await admin.from("user_profile_candidates").insert({
      id: candidateId,
      user_id: owner.id,
      subject_key: `income_day:${randomUUID()}`,
      statement: "Cobras el 15",
      status: "pending_confirmation",
      evidence_refs: ["movement:income-1"],
    });
    expect(inserted.error).toBeNull();
    const before = await owner.client.from("user_profile_facts").select("id").eq("user_id", owner.id);
    const confirm = await owner.client.rpc("resolve_profile_candidate", {
      p_user_id: owner.id,
      p_candidate_id: candidateId,
      p_resolution: "confirm",
      p_statement: "Cobro el 15",
      p_idempotency_key: `confirm-${randomUUID()}`,
    });
    expect(confirm.error).toBeNull();
    const after = await owner.client.from("user_profile_facts").select("origin,last_confirmed_at").eq("user_id", owner.id).eq("subject_key", (confirm.data as { fact: { subject_key: string } }).fact.subject_key).single();
    expect(after.data?.origin).toBe("observado_confirmado");
    expect(after.data?.last_confirmed_at).not.toBeNull();
    expect((before.data ?? []).some((row) => row.id === (confirm.data as { fact: { id: string } }).fact.id)).toBe(false);
  });

  it("11 meses y 29 días sigue vigente; al cumplir 12 meses caduca y queda visible", async () => {
    const now = "2026-08-01T12:00:00Z";
    const recent = await insertMemory(owner.id, `merchant:${randomUUID()}`, ["movement:11m29"], undefined, "2025-08-03T12:00:00Z");
    const old = await insertMemory(owner.id, `merchant:${randomUUID()}`, ["movement:12m"], undefined, "2025-08-01T12:00:00Z");
    const lifecycle = await owner.client.rpc("apply_user_memory_lifecycle", { p_user_id: owner.id, p_now: now });
    expect(lifecycle.error).toBeNull();
    const rows = await admin.from("financial_memory_items").select("id,lifecycle_status").in("id", [recent.id, old.id]);
    expect(rows.data?.find((row) => row.id === recent.id)?.lifecycle_status).toBe("confirmed");
    expect(rows.data?.find((row) => row.id === old.id)?.lifecycle_status).toBe("expired");
  });

  it("perfil y preferencia corrigen encadenando y deshacen sin sobrescribir historia", async () => {
    const fact = await admin.from("user_profile_facts").insert({
      user_id: owner.id,
      subject_key: `work:${randomUUID()}`,
      statement: "Trabajo de forma independiente",
      origin: "dicho",
      positive_evidence_refs: ["conversation:profile"],
      positive_evidence_count: 1,
    }).select("id").single();
    expect(fact.error).toBeNull();
    const correctedFact = await owner.client.rpc("commit_profile_memory_operation", {
      p_user_id: owner.id,
      p_fact_id: fact.data!.id,
      p_operation: "correct",
      p_statement: "Trabajo con contrato",
      p_reason: "profile_test",
      p_idempotency_key: `profile-correct-${randomUUID()}`,
      p_now: "2026-08-01T12:00:00Z",
    });
    expect(correctedFact.error).toBeNull();
    const replacementFact = (correctedFact.data as { replacement: { id: string; supersedes_fact_id: string } }).replacement;
    expect(replacementFact.supersedes_fact_id).toBe(fact.data!.id);
    const undoFact = await owner.client.rpc("commit_profile_memory_operation", {
      p_user_id: owner.id,
      p_fact_id: replacementFact.id,
      p_operation: "undo",
      p_statement: "",
      p_reason: "profile_test",
      p_idempotency_key: `profile-undo-${randomUUID()}`,
      p_now: "2026-08-02T12:00:00Z",
    });
    expect(undoFact.error).toBeNull();

    const preference = await admin.from("learned_preferences").insert({
      user_id: owner.id,
      source_module: "reports",
      key: `view:${randomUUID()}`,
      value: { period: "weekly" },
      positive_evidence_refs: ["navigation:weekly"],
      positive_evidence_count: 1,
    }).select("id").single();
    expect(preference.error).toBeNull();
    const correctedPreference = await owner.client.rpc("commit_preference_memory_operation", {
      p_user_id: owner.id,
      p_preference_id: preference.data!.id,
      p_operation: "correct",
      p_value: { period: "monthly" },
      p_reason: "preference_test",
      p_idempotency_key: `preference-correct-${randomUUID()}`,
      p_now: "2026-08-01T12:00:00Z",
    });
    expect(correctedPreference.error).toBeNull();
    const replacementPreference = (correctedPreference.data as { replacement: { id: string; supersedes_preference_id: string } }).replacement;
    expect(replacementPreference.supersedes_preference_id).toBe(preference.data!.id);
    const undoPreference = await owner.client.rpc("commit_preference_memory_operation", {
      p_user_id: owner.id,
      p_preference_id: replacementPreference.id,
      p_operation: "undo",
      p_value: null,
      p_reason: "preference_test",
      p_idempotency_key: `preference-undo-${randomUUID()}`,
      p_now: "2026-08-02T12:00:00Z",
    });
    expect(undoPreference.error).toBeNull();
  });

  it("eliminar la cuenta elimina las siete familias canónicas, lápidas y auditoría", async () => {
    const disposable = await crearUsuarioDePrueba("w13-memory-cascade");
    const memory = await insertMemory(disposable.id, `merchant:${randomUUID()}`, ["movement:cascade"]);
    await admin.from("learning_candidates").insert({
      user_id: disposable.id,
      kind: "correction_pattern",
      canonical_key: `candidate:${randomUUID()}`,
      proposal_summary: "Candidato",
      basis: "confirmed_correction",
      evidence_sources: ["movement"],
      evidence_refs: ["movement:candidate"],
      evidence_count: 1,
      positive_evidence_refs: ["movement:candidate"],
      positive_evidence_count: 1,
      positive_evidence_weight: 1,
      last_evidence_at: "2026-08-01T12:00:00Z",
    });
    await disposable.client.rpc("commit_financial_memory_operation", {
      p_user_id: disposable.id,
      p_memory_id: memory.id,
      p_operation: "forget",
      p_summary: "",
      p_reason: "cascade",
      p_idempotency_key: `cascade-${randomUUID()}`,
      p_now: "2026-08-01T12:00:00Z",
    });
    await admin.from("user_profile_facts").insert({
      user_id: disposable.id,
      subject_key: `work:${randomUUID()}`,
      statement: "Declarado",
      origin: "dicho",
    });
    await admin.from("user_profile_candidates").insert({
      user_id: disposable.id,
      subject_key: `income_day:${randomUUID()}`,
      statement: "Candidato",
      evidence_refs: ["movement:candidate"],
    });
    await admin.from("learned_preferences").insert({
      user_id: disposable.id,
      source_module: "reports",
      key: `view:${randomUUID()}`,
      value: { period: "monthly" },
    });

    const deletion = await admin.auth.admin.deleteUser(disposable.id);
    expect(deletion.error).toBeNull();
    for (const table of [
      "financial_memory_items",
      "learning_candidates",
      "user_profile_facts",
      "user_profile_candidates",
      "learned_preferences",
      "memory_tombstones",
      "memory_events",
    ]) {
      const rows = await admin.from(table).select("id").eq("user_id", disposable.id);
      expect(rows.error).toBeNull();
      expect(rows.data).toEqual([]);
    }
  });
});

describe("RUL-CAT-07/12: lotes y fusión reversibles en Postgres real", () => {
  it("previsualiza, excluye la corrección manual, aplica y deshace un lote completo", async () => {
    const accountId = await insertAccount(owner.id, "bulk");
    const movementIds = await insertMovements(owner.id, accountId, 4, {
      categoryId: "transporte",
      metadataForIndex: (index) => index === 3 ? { classification_source: "user" } : {},
    });
    const preview = await owner.client.rpc("commit_classification_bulk", {
      p_user_id: owner.id,
      p_movement_ids: movementIds,
      p_excluded_ids: [],
      p_category_id: "alimentacion",
      p_subcategory_id: null,
      p_include_manually_corrected: false,
      p_preview: true,
      p_idempotency_key: `bulk-preview-${randomUUID()}`,
      p_now: "2026-08-01T12:00:00Z",
    });
    expect(preview.error).toBeNull();
    expect(preview.data).toMatchObject({ count: 3, excluded_count: 1 });

    const committed = await owner.client.rpc("commit_classification_bulk", {
      p_user_id: owner.id,
      p_movement_ids: movementIds,
      p_excluded_ids: [],
      p_category_id: "alimentacion",
      p_subcategory_id: null,
      p_include_manually_corrected: false,
      p_preview: false,
      p_idempotency_key: `bulk-commit-${randomUUID()}`,
      p_now: "2026-08-01T12:01:00Z",
    });
    expect(committed.error).toBeNull();
    const batchId = (committed.data as { batch: { id: string } }).batch.id;
    const changed = await admin.from("movements").select("id,category_id").in("id", movementIds);
    expect(changed.data?.filter((row) => row.category_id === "alimentacion")).toHaveLength(3);
    expect(changed.data?.find((row) => row.id === movementIds[3])?.category_id).toBe("transporte");

    const evidence = await admin.from("learning_evidence")
      .select("polarity")
      .eq("user_id", owner.id)
      .like("evidence_ref", `classification-bulk:${batchId}:%`);
    expect(evidence.data?.filter((row) => row.polarity === "negative")).toHaveLength(3);
    expect(evidence.data?.filter((row) => row.polarity === "positive")).toHaveLength(3);

    const undone = await owner.client.rpc("undo_classification_batch", {
      p_user_id: owner.id,
      p_batch_id: batchId,
      p_expected_kind: "bulk",
      p_expected_source_id: null,
      p_idempotency_key: `bulk-undo-${randomUUID()}`,
      p_now: "2026-08-02T12:00:00Z",
    });
    expect(undone.error).toBeNull();
    const restored = await admin.from("movements").select("category_id").in("id", movementIds.slice(0, 3));
    expect(restored.data?.every((row) => row.category_id === "transporte")).toBe(true);
  });

  it("RUL-CAT-07 calcula 47 + 89 = 136, fusiona sin perder filas y deshace en siete días", async () => {
    const accountId = await insertAccount(owner.id, "merge");
    const stamp = randomUUID();
    const subcategories = await admin.from("user_subcategories").insert([
      { user_id: owner.id, category_id: "transporte", label: `Uber ${stamp}`, normalized_label: `uber_${stamp}`, created_by: "user" },
      { user_id: owner.id, category_id: "transporte", label: `Taxi ${stamp}`, normalized_label: `taxi_${stamp}`, created_by: "user" },
    ]).select("id");
    expect(subcategories.error).toBeNull();
    const sourceId = subcategories.data![0].id;
    const targetId = subcategories.data![1].id;
    await insertMovements(owner.id, accountId, 47, { categoryId: "transporte", subcategoryId: sourceId });
    await insertMovements(owner.id, accountId, 89, { categoryId: "transporte", subcategoryId: targetId });

    const preview = await owner.client.rpc("commit_subcategory_merge", {
      p_user_id: owner.id,
      p_source_id: sourceId,
      p_target_id: targetId,
      p_preview: true,
      p_idempotency_key: `merge-preview-${randomUUID()}`,
      p_now: "2026-08-01T12:00:00Z",
    });
    expect(preview.error).toBeNull();
    expect(preview.data).toMatchObject({ count: 47, target_count_before: 89, target_count_after: 136 });

    const committed = await owner.client.rpc("commit_subcategory_merge", {
      p_user_id: owner.id,
      p_source_id: sourceId,
      p_target_id: targetId,
      p_preview: false,
      p_idempotency_key: `merge-commit-${randomUUID()}`,
      p_now: "2026-08-01T12:01:00Z",
    });
    expect(committed.error).toBeNull();
    const batchId = (committed.data as { batch: { id: string } }).batch.id;
    const merged = await admin.from("movements").select("id", { count: "exact", head: true }).eq("user_id", owner.id).eq("subcategory_id", targetId);
    expect(merged.count).toBe(136);

    const undone = await owner.client.rpc("undo_classification_batch", {
      p_user_id: owner.id,
      p_batch_id: batchId,
      p_expected_kind: "merge",
      p_expected_source_id: sourceId,
      p_idempotency_key: `merge-undo-${randomUUID()}`,
      p_now: "2026-08-08T12:00:00Z",
    });
    expect(undone.error).toBeNull();
    const sourceRows = await admin.from("movements").select("id", { count: "exact", head: true }).eq("user_id", owner.id).eq("subcategory_id", sourceId);
    expect(sourceRows.count).toBe(47);
  });
});

async function insertMemory(
  userId: string,
  canonicalKey: string,
  positiveRefs: string[],
  sourceCandidateId?: string,
  lastUsedAt = "2026-07-01T12:00:00Z",
) {
  const row = {
    id: randomUUID(),
    user_id: userId,
    kind: "correction_pattern",
    canonical_key: canonicalKey,
    summary: `${canonicalKey} va en Alimentación`,
    evidence_source: "explicit_feedback",
    evidence_ref: positiveRefs[0],
    confidence: 1,
    confirmation_status: "confirmed",
    lifecycle_status: "confirmed",
    positive_evidence_refs: positiveRefs,
    positive_evidence_count: positiveRefs.length,
    negative_evidence_refs: [],
    negative_evidence_count: 0,
    source_candidate_id: sourceCandidateId ?? null,
    last_used_at: lastUsedAt,
  };
  const inserted = await admin.from("financial_memory_items").insert(row).select("id,canonical_key").single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "No se insertó memoria");
  return inserted.data;
}

function recordEvidence(input: {
  canonicalKey: string;
  evidenceRef: string;
  polarity: "positive" | "negative";
  basis?: "confirmed_correction" | "repeated_behavior";
}) {
  return admin.rpc("record_learning_evidence", {
    p_user_id: owner.id,
    p_kind: "correction_pattern",
    p_canonical_key: input.canonicalKey,
    p_proposal_summary: `${input.canonicalKey} va en Alimentación`,
    p_search_terms: [input.canonicalKey],
    p_basis: input.basis ?? "confirmed_correction",
    p_evidence_source: "movement",
    p_evidence_ref: input.evidenceRef,
    p_polarity: input.polarity,
    p_evidence_weight: 1,
    p_sensitivity: "normal",
    p_requires_user_confirmation: false,
    p_valid_until: null,
    p_source_entity_type: "movement",
    p_source_entity_id: randomUUID(),
    p_claim_value: { category_id: "alimentacion" },
    p_observed_at: new Date().toISOString(),
    p_metadata: {},
  });
}

async function insertAccount(userId: string, suffix: string) {
  const account = await admin.from("accounts").insert({
    user_id: userId,
    name: `W13 ${suffix} ${randomUUID()}`,
    type: "banco",
    currency: "PEN",
  }).select("id").single();
  if (account.error || !account.data) throw new Error(account.error?.message ?? "No se creó cuenta");
  return account.data.id;
}

async function insertMovements(
  userId: string,
  accountId: string,
  count: number,
  options: {
    categoryId: string;
    subcategoryId?: string;
    metadataForIndex?: (index: number) => Record<string, unknown>;
  },
) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: randomUUID(),
    user_id: userId,
    type: "gasto" as const,
    status: "confirmed" as const,
    amount: index + 1,
    currency: "PEN" as const,
    occurred_at: new Date(Date.UTC(2026, 6, 1, 12, index % 60)).toISOString(),
    category_id: options.categoryId,
    subcategory_id: options.subcategoryId ?? null,
    source: "dashboard_manual",
    idempotency_key: `w13-${randomUUID()}`,
    account_origin_id: accountId,
    metadata: options.metadataForIndex?.(index) ?? {},
  }));
  const inserted = await admin.from("movements").insert(rows);
  if (inserted.error) throw new Error(inserted.error.message);
  return rows.map((row) => row.id);
}

function commitMemory(
  user: UsuarioDePrueba,
  memoryId: string,
  operation: "forget" | "undo" | "correct",
  idempotencyKey: string,
  now: string,
  summary = "",
) {
  return user.client.rpc("commit_financial_memory_operation", {
    p_user_id: user.id,
    p_memory_id: memoryId,
    p_operation: operation,
    p_summary: summary,
    p_reason: "rls_test",
    p_idempotency_key: idempotencyKey,
    p_now: now,
  });
}
