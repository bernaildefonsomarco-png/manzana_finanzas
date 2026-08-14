import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TurnInput } from "@/core/channel/types";
import {
  buildPendingItemReferenceCode,
  extractPendingReferenceCode,
} from "@/core/pending/reference-code";
import type { PendingResolutionResult } from "@/core/orchestrator/pending-resolution-from-text";
import { CATEGORY_IDS, type PendingItem } from "@/shared/types/domain";
import { planTurnBlocks, type PlanTurnBlocksResult } from "./response-planner";

const originalManzanaAppUrl = process.env.MANZANA_APP_URL;
const DEFAULT_USER_ID = "00000000-0000-4000-8000-000000000002";

function turnInput(text: string): TurnInput {
  return {
    actor: "user",
    text,
    choice: null,
    confirmation: null,
    attachments: [],
    context: { where: null, filters: null, selected: null, visible: [] },
    channel: "whatsapp",
  };
}

function pendingItem(overrides: Partial<PendingItem> = {}): PendingItem {
  return {
    id: "00000000-0000-4000-8000-000000000020",
    user_id: DEFAULT_USER_ID,
    type: "ambiguous_movement",
    status: "user_edited",
    source: "email_pending",
    source_ref: "whatsapp:external:action_1",
    proposed_action: {
      action: "record_expense",
      movement_type: "gasto",
    },
    normalized_summary: {
      title: "recibo de luz",
      amount: 120,
      currency: "PEN",
      occurred_at: "2026-06-08T12:00:00.000Z",
      category_id: "vivienda_hogar",
    },
    dedup_status: null,
    risk_level: "medium",
    confirmable: true,
    confirm_command: {},
    expires_at: null,
    sent_for_confirmation_at: null,
    resolved_at: null,
    resolved_by: null,
    created_at: "2026-06-08T12:00:00.000Z",
    updated_at: "2026-06-08T12:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

type PendingUpdatedResolution = Extract<
  PendingResolutionResult,
  { kind: "updated" }
>;

function pendingUpdated(
  item: PendingItem,
  overrides: Partial<PendingUpdatedResolution> = {}
): PendingUpdatedResolution {
  return {
    kind: "updated",
    reason: "pending_ready_for_confirmation",
    action: "classify_expense",
    pending_code: buildPendingItemReferenceCode(item),
    pending_count: 1,
    pending_item: item,
    account_options: [],
    ready_for_confirmation: true,
    learned_account_hints: [],
    movement: null,
    idempotent: false,
    ...overrides,
  };
}

function blockText(result: PlanTurnBlocksResult, index = 0): string {
  const block = result.blocks[index];
  if (!block) return "";
  if ("text" in block) return block.text;
  return "";
}

describe("legibilidad del texto que devuelve el planificador", () => {
  beforeEach(() => {
    process.env.MANZANA_APP_URL = "http://127.0.0.1:3100";
  });

  afterEach(() => {
    if (originalManzanaAppUrl) {
      process.env.MANZANA_APP_URL = originalManzanaAppUrl;
    } else {
      delete process.env.MANZANA_APP_URL;
    }
  });

  it("nombra la categoria del pendiente con su etiqueta visible, no con el id interno", () => {
    const item = pendingItem();
    const code = buildPendingItemReferenceCode(item);

    const result = planTurnBlocks({
      turnInput: turnInput(`${code} fue un gasto sin cuenta`),
      userId: DEFAULT_USER_ID,
      pendingResolution: pendingUpdated(item),
    });

    expect(result.reason).toBe("pending_updated");
    expect(blockText(result)).toContain("en Vivienda / Hogar");
    expect(blockText(result)).not.toContain("vivienda_hogar");
  });

  it("ninguna categoria canonica llega al usuario como slug", () => {
    for (const categoryId of CATEGORY_IDS) {
      const item = pendingItem({
        normalized_summary: {
          title: "recibo",
          amount: 120,
          currency: "PEN",
          occurred_at: "2026-06-08T12:00:00.000Z",
          category_id: categoryId,
        },
      });

      const result = planTurnBlocks({
        turnInput: turnInput(
          `${buildPendingItemReferenceCode(item)} fue un gasto sin cuenta`
        ),
        userId: DEFAULT_USER_ID,
        pendingResolution: pendingUpdated(item),
      });

      expect(blockText(result), `la categoria ${categoryId} se filtro cruda`).not.toContain(
        categoryId
      );
    }
  });

  it("un ingreso clasificado tampoco expone el id de categoria", () => {
    const item = pendingItem({
      proposed_action: {
        action: "record_income",
        movement_type: "ingreso",
        account_destination_id: "11111111-1111-4111-8111-111111111111",
      },
      normalized_summary: {
        title: "reembolso",
        amount: 300,
        currency: "PEN",
        occurred_at: "2026-06-08T12:00:00.000Z",
        category_id: "trabajo_productividad",
      },
    });

    const result = planTurnBlocks({
      turnInput: turnInput(
        `${buildPendingItemReferenceCode(item)} fue un ingreso a Cuenta Sueldo`
      ),
      userId: DEFAULT_USER_ID,
      pendingResolution: pendingUpdated(item, {
        action: "classify_income",
        account_options: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Cuenta Sueldo",
            institution: "BCP",
            currency: "PEN",
            is_default: true,
          },
        ],
      }),
    });

    expect(blockText(result)).toContain("a Cuenta Sueldo");
    expect(blockText(result)).toContain("en Trabajo / Productividad");
    expect(blockText(result)).not.toContain("trabajo_productividad");
  });

  it("conserva el codigo de referencia porque la persona lo cita para confirmar", () => {
    const item = pendingItem();
    const code = buildPendingItemReferenceCode(item);

    const result = planTurnBlocks({
      turnInput: turnInput(`${code} fue un gasto sin cuenta`),
      userId: DEFAULT_USER_ID,
      pendingResolution: pendingUpdated(item),
    });

    const text = blockText(result);
    expect(text).toContain(code);
    expect(extractPendingReferenceCode(text)).toBe(code);
  });
});
