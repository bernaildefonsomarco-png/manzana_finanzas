import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StructureProposalRequest } from "@/agents/conversational-executive-agent/types";
import type { Database } from "@/data/supabase/types";
import type { CategoryId, UserSubcategory } from "@/shared/types/domain";
import { compileStructureProposal } from "./structure-proposal-compiler";
import { buildStructureCommandFromProposal } from "./structure-proposal";
import { executeStructureCommand } from "./structure-executor";
import type { StructureCommand } from "./structure-commands";

const mocks = vi.hoisted(() => ({
  findSubcategoryByLabel: vi.fn(),
  getSubcategoryById: vi.fn(),
  insertSubcategory: vi.fn(),
  updateSubcategory: vi.fn(),
  appendStructureAudit: vi.fn(),
}));

vi.mock("@/data/repositories/classification.repository", () => ({
  findSubcategoryByLabel: mocks.findSubcategoryByLabel,
  getSubcategoryById: mocks.getSubcategoryById,
  insertSubcategory: mocks.insertSubcategory,
  updateSubcategory: mocks.updateSubcategory,
}));

vi.mock("@/data/repositories/structure.repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/data/repositories/structure.repository")
  >("@/data/repositories/structure.repository");
  return {
    ...actual,
    appendStructureAudit: mocks.appendStructureAudit,
  };
});

const client = {} as SupabaseClient<Database>;

const NOW = "2026-08-09T10:00:00.000-05:00";
const USER_ID = "00000000-0000-4000-8000-0000000000f1";
const COMMAND_ID = "00000000-0000-4000-8000-0000000000d1";
const SUBCATEGORY_ID = "00000000-0000-4000-8000-00000000000b";

function subcategory(overrides: Partial<UserSubcategory> = {}): UserSubcategory {
  return {
    id: SUBCATEGORY_ID,
    user_id: USER_ID,
    category_id: "vivienda_hogar",
    label: "Animales",
    normalized_label: "animales",
    created_by: "user",
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    metadata: {},
    ...overrides,
  };
}

function request(
  overrides: Partial<StructureProposalRequest> = {},
): StructureProposalRequest {
  return {
    intent: "create",
    entity: "subcategoria",
    summary: "¿Creo la subcategoría Animales dentro de Vivienda / Hogar?",
    confirm_label: "Sí, créala",
    confidence: 0.9,
    ambiguities: [],
    target_id: null,
    name: "Animales",
    amount: null,
    target_amount: null,
    target_date: null,
    account_id: null,
    box_id: null,
    box_type: null,
    category_id: "vivienda_hogar",
    period_kind: null,
    budget_kind: null,
    frequency: null,
    next_expected_date: null,
    amount_variability: null,
    currency: null,
    account_type: null,
    institution: null,
    ...overrides,
  };
}

/**
 * El camino real del asistente, sin atajos: lo que el ejecutivo entendió se
 * compila en borrador, el borrador se confirma y solo entonces se escribe.
 * Nada se ejecuta sin pasar por el "sí" (`RUL-ESTR-03`).
 */
function confirmar(
  userText: string,
  overrides: Partial<StructureProposalRequest> = {},
): StructureCommand {
  const compiled = compileStructureProposal({
    request: request(overrides),
    userText,
    now: NOW,
  });
  if (compiled.kind !== "proposal") {
    throw new Error(`se esperaba un borrador, llegó ${compiled.kind}`);
  }

  const command = buildStructureCommandFromProposal({
    proposal: compiled.proposal,
    userId: USER_ID,
    commandId: COMMAND_ID,
    source: "orchestrator.structure_confirm",
    traceId: "trace-subcategoria",
  });
  if (!command) throw new Error("el borrador confirmado no reconstruyó comando");
  return command;
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.findSubcategoryByLabel.mockResolvedValue(null);
  mocks.getSubcategoryById.mockResolvedValue(subcategory());
  mocks.insertSubcategory.mockResolvedValue(subcategory());
  mocks.updateSubcategory.mockResolvedValue(subcategory());
  mocks.appendStructureAudit.mockResolvedValue(undefined);
});

describe("crear una subcategoría conversando", () => {
  it("de la frase del usuario a la subcategoría escrita, con su rastro", async () => {
    const command = confirmar(
      "ese gasto de comida de gatos ponlo dentro de una nueva subcategoria llamada Animales dentro de Vivienda",
    );

    const result = await executeStructureCommand({
      client,
      command,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "applied",
      entity: "subcategoria",
      operation: "create",
      entity_id: SUBCATEGORY_ID,
      idempotent: false,
    });

    expect(mocks.insertSubcategory).toHaveBeenCalledWith(client, {
      userId: USER_ID,
      categoryId: "vivienda_hogar",
      label: "Animales",
      // La persona la nombró y confirmó la tarjeta: es suya, no una
      // inferencia del motor.
      createdBy: "user",
    });

    expect(mocks.appendStructureAudit).toHaveBeenCalledTimes(1);
    expect(mocks.appendStructureAudit.mock.calls[0][1]).toMatchObject({
      userId: USER_ID,
      entityType: "user_subcategory",
      entityId: SUBCATEGORY_ID,
      action: "created",
      idempotencyKey: command.idempotency_key,
    });
  });

  it("el resumen nombra la categoría como la nombra el catálogo", async () => {
    const command = confirmar("crea una subcategoria Animales en Vivienda");

    const result = await executeStructureCommand({
      client,
      command,
      movementSource: "dashboard_manual",
    });

    if (result.kind !== "applied") throw new Error("se esperaba aplicada");
    expect(result.summary).toBe(
      "la subcategoría Animales dentro de Vivienda / Hogar",
    );
  });

  it("confirmar dos veces no crea dos subcategorías iguales", async () => {
    // La unicidad dura vive en la base (`user_subcategories_unique_label`).
    // Leerla antes permite contarlo como "eso ya estaba hecho" en vez de
    // fallar, y cubre además que ya la hubiera creado desde Configuración.
    mocks.findSubcategoryByLabel.mockResolvedValue(subcategory());

    const command = confirmar("crea una subcategoria Animales en Vivienda");
    const result = await executeStructureCommand({
      client,
      command,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "applied",
      entity_id: SUBCATEGORY_ID,
      idempotent: true,
    });
    expect(mocks.insertSubcategory).not.toHaveBeenCalled();
    expect(mocks.appendStructureAudit).not.toHaveBeenCalled();
  });

  it("dos confirmaciones a la vez terminan en la misma subcategoría, no en un error", async () => {
    mocks.findSubcategoryByLabel
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(subcategory());
    mocks.insertSubcategory.mockRejectedValue({ code: "23505" });

    const command = confirmar("crea una subcategoria Animales en Vivienda");
    const result = await executeStructureCommand({
      client,
      command,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "applied",
      entity_id: SUBCATEGORY_ID,
      idempotent: true,
    });
  });
});

describe("renombrar y archivar una subcategoría conversando", () => {
  it("renombrarla escribe la etiqueta nueva y deja rastro", async () => {
    mocks.updateSubcategory.mockResolvedValue(subcategory({ label: "Mascotas" }));

    const command = confirmar("renombra la subcategoria Animales a Mascotas", {
      intent: "update",
      target_id: SUBCATEGORY_ID,
      name: "Mascotas",
      category_id: null,
      summary: "¿Le cambio el nombre a Mascotas?",
    });

    const result = await executeStructureCommand({
      client,
      command,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "applied",
      entity: "subcategoria",
      operation: "update",
      idempotent: false,
    });
    expect(mocks.updateSubcategory).toHaveBeenCalledWith(client, {
      userId: USER_ID,
      id: SUBCATEGORY_ID,
      label: "Mascotas",
    });
  });

  it("renombrarla a como ya se llama no vuelve a escribir", async () => {
    const command = confirmar("renombra la subcategoria a Animales", {
      intent: "update",
      target_id: SUBCATEGORY_ID,
      name: "Animales",
      category_id: null,
      summary: "¿Le dejo el nombre Animales?",
    });

    const result = await executeStructureCommand({
      client,
      command,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({ kind: "applied", idempotent: true });
    expect(mocks.updateSubcategory).not.toHaveBeenCalled();
  });

  it("archivarla la marca como borrada sin tocar los movimientos que ya la usan", async () => {
    mocks.updateSubcategory.mockResolvedValue(
      subcategory({ deleted_at: NOW }),
    );

    const command = confirmar("archiva la subcategoria Animales", {
      intent: "archive",
      target_id: SUBCATEGORY_ID,
      confidence: 0.95,
      summary: "¿Archivo la subcategoría Animales?",
    });

    const result = await executeStructureCommand({
      client,
      command,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "applied",
      entity: "subcategoria",
      operation: "archive",
      entity_id: SUBCATEGORY_ID,
    });
    expect(mocks.updateSubcategory).toHaveBeenCalledWith(client, {
      userId: USER_ID,
      id: SUBCATEGORY_ID,
      archive: true,
    });
    expect(mocks.appendStructureAudit.mock.calls[0][1]).toMatchObject({
      entityType: "user_subcategory",
      action: "deleted",
    });
  });

  it("archivar una que no existe se dice, no se da por hecho", async () => {
    mocks.getSubcategoryById.mockResolvedValue(null);

    const command = confirmar("archiva la subcategoria Animales", {
      intent: "archive",
      target_id: SUBCATEGORY_ID,
      confidence: 0.95,
      summary: "¿Archivo la subcategoría Animales?",
    });

    const result = await executeStructureCommand({
      client,
      command,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      entity: "subcategoria",
      operation: "archive",
      reason: "reference_not_found",
      error_code: "SUBCATEGORY_NOT_FOUND",
    });
    expect(mocks.updateSubcategory).not.toHaveBeenCalled();
  });
});

describe("una subcategoría siempre cuelga de una categoría real", () => {
  it.each([
    ["vivienda_hogar", "Vivienda / Hogar"],
    ["alimentacion", "Alimentación"],
  ] as Array<[CategoryId, string]>)(
    "%s se le muestra al usuario como %s",
    async (categoryId, label) => {
      mocks.insertSubcategory.mockResolvedValue(
        subcategory({ category_id: categoryId }),
      );

      const command = confirmar("crea una subcategoria Animales", {
        category_id: categoryId,
      });

      const result = await executeStructureCommand({
        client,
        command,
        movementSource: "dashboard_manual",
      });

      if (result.kind !== "applied") throw new Error("se esperaba aplicada");
      expect(result.summary).toContain(label);
    },
  );
});
