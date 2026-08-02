import { describe, expect, it } from "vitest";
import type { BudgetWithProgress } from "@/data/repositories/budgets.repository";
import type { PublicReminder } from "@/data/repositories/reminders.repository";
import type { UpcomingCommitmentSummary } from "@/data/repositories/recurring.repository";
import type { InsightCandidate, Movement } from "@/shared/types/domain";
import {
  composeHome,
  computeHomeState,
  type FreeMoneyComposition,
  type HomeComposerInput,
  type PendingSummary,
} from "./home-composer";

function reminder(overrides: Partial<PublicReminder>): PublicReminder {
  return {
    id: "reminder-1",
    kind: "pago_proximo",
    title: "titulo",
    body: "cuerpo",
    action_url: "/pagos-que-vienen",
    status: "en_bandeja",
    created_at: "2026-07-20T00:00:00.000Z",
    expires_at: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

const okFreeMoney: FreeMoneyComposition = {
  has_accounts: true,
  total_balance: 1140,
  separated_balance: 500,
  free_balance: 560,
  account_count: 2,
  box_count: 1,
};

const emptyPending: PendingSummary = { active_count: 0, needs_completion_count: 0, high_risk_count: 0 };

function baseInput(overrides: Partial<HomeComposerInput> = {}): HomeComposerInput {
  return {
    confirmedMovementsCount: 30,
    hiddenBlocks: new Set(),
    freeMoney: { ok: true, value: okFreeMoney },
    reminders: { ok: true, value: [] },
    pending: { ok: true, value: emptyPending },
    budgets: { ok: true, value: [] },
    projection: { ok: true, value: null },
    periodTotal: { ok: true, value: null },
    upcoming: { ok: true, value: [] },
    insight: { ok: true, value: null },
    movements: { ok: true, value: [] },
    ...overrides,
  };
}

describe("computeHomeState: 39 §5 umbrales", () => {
  it("0 movimientos -> vacio", () => expect(computeHomeState(0)).toBe("vacio"));
  it("1 movimiento -> temprano", () => expect(computeHomeState(1)).toBe("temprano"));
  it("10 movimientos -> temprano", () => expect(computeHomeState(10)).toBe("temprano"));
  it("11 movimientos -> funcional", () => expect(computeHomeState(11)).toBe("funcional"));
  it("50 movimientos -> funcional", () => expect(computeHomeState(50)).toBe("funcional"));
  it("51 movimientos -> completo", () => expect(computeHomeState(51)).toBe("completo"));
  it("39 §19 caso 7: 60 movimientos en un dia -> completo de inmediato (umbral de volumen, no de tiempo)", () => {
    expect(computeHomeState(60)).toBe("completo");
  });
});

describe("composeHome: RUL-HOME-05 excepción de estado vacío (WEB-D251)", () => {
  it("con 0 movimientos confirmados, no compone ningún bloque aunque haya datos", () => {
    const { state, blocks } = composeHome(baseInput({ confirmedMovementsCount: 0 }));
    expect(state).toBe("vacio");
    expect(blocks).toEqual([]);
  });
});

describe("composeHome: RUL-HOME-01/02", () => {
  it("AC-HOME-01/03: el dinero libre siempre llega con su composicion", () => {
    const { blocks } = composeHome(baseInput());
    const freeMoney = blocks.find((block) => block.kind === "free_money");
    expect(freeMoney?.status).toBe("ok");
    expect(freeMoney?.data).toEqual(okFreeMoney);
  });

  it("AC-HOME-02/AC-HOME-21 (39 §19 caso 1): sin cuentas, no se muestra S/0.00, se explica que falta", () => {
    const { blocks } = composeHome(baseInput({ freeMoney: { ok: true, value: { has_accounts: false } } }));
    const freeMoney = blocks.find((block) => block.kind === "free_money");
    expect(freeMoney?.status).toBe("unavailable");
    expect(freeMoney?.data).toEqual({ reason: "no_accounts" });
  });

  it("39 §19 caso 2: dinero libre exactamente 0 SI se muestra (dato real, no ausencia de dato)", () => {
    const { blocks } = composeHome(
      baseInput({
        freeMoney: {
          ok: true,
          value: { has_accounts: true, total_balance: 500, separated_balance: 500, free_balance: 0, account_count: 1, box_count: 1 },
        },
      }),
    );
    const freeMoney = blocks.find((block) => block.kind === "free_money");
    expect(freeMoney?.status).toBe("ok");
    expect((freeMoney?.data as FreeMoneyComposition & { has_accounts: true }).free_balance).toBe(0);
  });

  it("RUL-HOME-09: si el dinero libre falla, se marca error reintentable y no tumba nada mas", () => {
    const { blocks } = composeHome(baseInput({ freeMoney: { ok: false } }));
    expect(blocks.find((block) => block.kind === "free_money")).toEqual({
      kind: "free_money",
      status: "error",
      retryable: true,
    });
  });
});

describe("composeHome: RUL-HOME-04 lo siguiente", () => {
  it("AC-HOME-06: sin candidatos de nivel 1-4, el bloque no aparece", () => {
    const { blocks } = composeHome(baseInput({ reminders: { ok: true, value: [reminder({ kind: "sin_registrar" })] } }));
    expect(blocks.find((block) => block.kind === "next_action")).toBeUndefined();
  });

  it("AC-HOME-06: con un candidato, aparece exactamente uno", () => {
    const { blocks } = composeHome(
      baseInput({
        reminders: {
          ok: true,
          value: [reminder({ id: "a", kind: "pago_vencido" }), reminder({ id: "b", kind: "cuota_proxima" })],
        },
      }),
    );
    const nextActions = blocks.filter((block) => block.kind === "next_action");
    expect(nextActions).toHaveLength(1);
    expect((nextActions[0].data as PublicReminder).id).toBe("a");
  });

  it("un recordatorio pospuesto no compite (RUL-HOME-04: 'ahora no' lo oculta hasta que cambie el estado)", () => {
    const { blocks } = composeHome(
      baseInput({ reminders: { ok: true, value: [reminder({ kind: "pago_vencido", status: "pospuesto" })] } }),
    );
    expect(blocks.find((block) => block.kind === "next_action")).toBeUndefined();
  });
});

describe("composeHome: RUL-HOME-05 bloque vacio no se muestra", () => {
  it("AC-HOME-04: sin pendientes, sin compromisos, sin descubrimiento, sin movimientos -> ninguno de esos bloques aparece", () => {
    const { blocks } = composeHome(baseInput());
    const kinds = blocks.map((block) => block.kind);
    expect(kinds).not.toContain("pending");
    expect(kinds).not.toContain("upcoming");
    expect(kinds).not.toContain("insight");
    expect(kinds).not.toContain("movements");
    expect(kinds).not.toContain("month");
  });

  it("39 §19 caso 4: nada pendiente ni por vencer -> solo cifra y movimientos si los hay; pantalla corta es correcta", () => {
    const movement = { id: "m1" } as unknown as Movement;
    const { blocks } = composeHome(baseInput({ movements: { ok: true, value: [movement] } }));
    expect(blocks.map((block) => block.kind)).toEqual(["free_money", "movements"]);
  });
});

describe("composeHome: WEB-D064 bloques ocultos por el usuario", () => {
  it("AC-HOME-19: un bloque oculto no reaparece aunque tenga contenido, incluso con status error", () => {
    const movement = { id: "m1" } as unknown as Movement;
    const { blocks } = composeHome(
      baseInput({
        hiddenBlocks: new Set(["movements", "free_money"]),
        movements: { ok: true, value: [movement] },
        freeMoney: { ok: false },
      }),
    );
    expect(blocks.find((block) => block.kind === "movements")).toBeUndefined();
    expect(blocks.find((block) => block.kind === "free_money")).toBeUndefined();
  });
});

describe("composeHome: bloque 'este mes'", () => {
  it("con presupuestos, se recorta a 3 (39 §19 caso 12)", () => {
    const budgets = Array.from({ length: 9 }, (_, index) => ({ id: `b${index}` }) as unknown as BudgetWithProgress);
    const { blocks } = composeHome(baseInput({ budgets: { ok: true, value: budgets } }));
    const month = blocks.find((block) => block.kind === "month");
    expect((month?.data as { budgets: unknown[] }).budgets).toHaveLength(3);
  });

  it("sin presupuestos ni proyeccion, cae al total simple del periodo", () => {
    const { blocks } = composeHome(
      baseInput({ periodTotal: { ok: true, value: { gasto_total: 100, ingreso_total: 200 } } }),
    );
    const month = blocks.find((block) => block.kind === "month");
    expect(month?.data).toEqual({ variant: "period_total", period_total: { gasto_total: 100, ingreso_total: 200 } });
  });

  it("39 §19 caso 8: presupuesto superado y proyeccion negativa a la vez, ambos se muestran juntos", () => {
    const budgets = [{ id: "b1" }] as unknown as BudgetWithProgress[];
    const { blocks } = composeHome(
      baseInput({
        budgets: { ok: true, value: budgets },
        projection: { ok: true, value: { free_money: -50, projected_close: -50, currency: "PEN" } },
      }),
    );
    const month = blocks.find((block) => block.kind === "month");
    const data = month?.data as { budgets: unknown[]; projection: { projected_close: number } | null };
    expect(data.budgets).toHaveLength(1);
    expect(data.projection?.projected_close).toBe(-50);
  });

  it("sin ninguna de las tres fuentes, no aparece (RUL-HOME-05)", () => {
    const { blocks } = composeHome(baseInput());
    expect(blocks.find((block) => block.kind === "month")).toBeUndefined();
  });

  it("RUL-HOME-09: si los presupuestos fallan y no hay proyección ni total que compense, se marca error en vez de desaparecer", () => {
    const { blocks } = composeHome(baseInput({ budgets: { ok: false } }));
    expect(blocks.find((block) => block.kind === "month")).toEqual({
      kind: "month",
      status: "error",
      retryable: true,
    });
  });

  it("si los presupuestos fallan pero la proyección sí tiene datos, se muestra igual (no se pierde contenido real)", () => {
    const { blocks } = composeHome(
      baseInput({
        budgets: { ok: false },
        projection: { ok: true, value: { free_money: 100, projected_close: 80, currency: "PEN" } },
      }),
    );
    const month = blocks.find((block) => block.kind === "month");
    expect(month?.status).toBe("ok");
    expect((month?.data as { budgets: unknown[] }).budgets).toEqual([]);
  });
});

describe("composeHome: bloque de compromisos proximos", () => {
  it("se recorta a 5 y ordena por fecha", () => {
    const upcoming: UpcomingCommitmentSummary[] = Array.from({ length: 7 }, (_, index) => ({
      id: `c${index}`,
      title: `c${index}`,
      amount: 10,
      currency: "PEN",
      due_at: `2026-08-${String(20 - index).padStart(2, "0")}`,
      kind: "recurring",
      linked_box_id: null,
    }));
    const { blocks } = composeHome(baseInput({ upcoming: { ok: true, value: upcoming } }));
    const block = blocks.find((b) => b.kind === "upcoming");
    const data = block?.data as { items: UpcomingCommitmentSummary[]; count: number };
    expect(data.items).toHaveLength(5);
    expect(data.count).toBe(7);
    expect(data.items[0].due_at.localeCompare(data.items[1].due_at)).toBeLessThan(0);
  });
});

describe("composeHome: insight destacado", () => {
  it("con un hallazgo, aparece 'insight'; sin ninguno, no aparece", () => {
    const insight = { id: "i1" } as unknown as InsightCandidate;
    const withInsight = composeHome(baseInput({ insight: { ok: true, value: insight } }));
    expect(withInsight.blocks.find((b) => b.kind === "insight")?.data).toEqual(insight);

    const withoutInsight = composeHome(baseInput());
    expect(withoutInsight.blocks.find((b) => b.kind === "insight")).toBeUndefined();
  });
});

describe("composeHome: AC-HOME-05 orden declarado y reproducible", () => {
  it("con todos los bloques presentes, el orden es exactamente el de 39 §8 (cifra, siguiente, pendientes, mes, próximos, hallazgo, movimientos)", () => {
    const movement = { id: "m1" } as unknown as Movement;
    const insight = { id: "i1" } as unknown as InsightCandidate;
    const budgets = [{ id: "b1" }] as unknown as BudgetWithProgress[];
    const upcoming: UpcomingCommitmentSummary[] = [
      { id: "c1", title: "c1", amount: 10, currency: "PEN", due_at: "2026-08-01", kind: "recurring", linked_box_id: null },
    ];
    const { blocks } = composeHome(
      baseInput({
        reminders: { ok: true, value: [reminder({ kind: "pago_vencido" })] },
        pending: { ok: true, value: { active_count: 1, needs_completion_count: 0, high_risk_count: 0 } },
        budgets: { ok: true, value: budgets },
        upcoming: { ok: true, value: upcoming },
        insight: { ok: true, value: insight },
        movements: { ok: true, value: [movement] },
      }),
    );
    expect(blocks.map((block) => block.kind)).toEqual([
      "free_money",
      "next_action",
      "pending",
      "month",
      "upcoming",
      "insight",
      "movements",
    ]);
  });
});

describe("composeHome: pendientes", () => {
  it("con pendientes activos, aparece con su conteo; en 0, no aparece", () => {
    const withPending = composeHome(
      baseInput({ pending: { ok: true, value: { active_count: 6, needs_completion_count: 2, high_risk_count: 0 } } }),
    );
    expect(withPending.blocks.find((b) => b.kind === "pending")?.data).toEqual({
      active_count: 6,
      needs_completion_count: 2,
      high_risk_count: 0,
    });

    const withoutPending = composeHome(baseInput());
    expect(withoutPending.blocks.find((b) => b.kind === "pending")).toBeUndefined();
  });
});
