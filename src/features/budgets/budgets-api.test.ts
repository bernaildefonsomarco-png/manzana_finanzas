import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  copyPreviousBudgets,
  createBudget,
  linkGoalBox,
  listBudgets,
  listGoalBoxes,
  updateBudget,
} from "./budgets-api";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("budgets-api W-12", () => {
  it("consulta el periodo y la fecha solicitados, sin fijarlos a mensual", async () => {
    fetchMock.mockResolvedValueOnce(
      apiResponse({ budgets: [], timezone: "America/Lima" })
    );

    await listBudgets("quincenal", "2026-07-15");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/budgets?period_kind=quincenal&limit=100&date=2026-07-15",
      { credentials: "same-origin" }
    );
  });

  it("ajusta la base y reglas con PATCH idempotente", async () => {
    fetchMock.mockResolvedValueOnce(apiResponse({ budget: { id: "budget-1" } }));

    await updateBudget("budget-1", {
      amount: 780.5,
      kind: "limite_blando",
      rollover: true,
      auto_renew: false,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/budgets/budget-1");
    expect(init).toEqual(
      expect.objectContaining({
        credentials: "same-origin",
        method: "PATCH",
        body: JSON.stringify({
          amount: 780.5,
          kind: "limite_blando",
          rollover: true,
          auto_renew: false,
        }),
      })
    );
    expect(init.headers).toEqual(
      expect.objectContaining({
        "content-type": "application/json",
        "idempotency-key": expect.stringMatching(/^budget-update:/),
      })
    );
  });

  it("mantiene la creación en POST mientras el ajuste usa PATCH", async () => {
    fetchMock.mockResolvedValueOnce(apiResponse({ budget: { id: "budget-new" } }));

    await createBudget({
      amount: 420,
      category_id: "alimentacion",
      period_kind: "mensual",
      kind: "presupuesto",
      rollover: false,
      auto_renew: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/budgets",
      expect.objectContaining({
        credentials: "same-origin",
        method: "POST",
      })
    );
  });

  it("copia el periodo anterior con fecha Lima e idempotencia", async () => {
    fetchMock.mockResolvedValueOnce(apiResponse({ budgets: [{ id: "copy-1" }] }));

    const copied = await copyPreviousBudgets("semanal", "2026-07-30");

    expect(copied).toEqual([{ id: "copy-1" }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/budgets/copy-previous");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({ period_kind: "semanal", date: "2026-07-30" })
    );
    expect(init.headers).toEqual(
      expect.objectContaining({
        "idempotency-key": expect.stringMatching(/^budget-copy-previous:/),
      })
    );
  });

  it("lista solo cajas objetivo existentes y vincula la elegida sin inventar cuenta", async () => {
    fetchMock
      .mockResolvedValueOnce(
        apiResponse({
          boxes: [
            {
              id: "objective-box",
              type: "objetivo",
              deleted_at: null,
            },
            {
              id: "expense-box",
              type: "gasto",
              deleted_at: null,
            },
            {
              id: "deleted-objective-box",
              type: "objetivo",
              deleted_at: "2026-07-01T05:00:00.000Z",
            },
          ],
        })
      )
      .mockResolvedValueOnce(apiResponse({ goal: { id: "goal-1" } }));

    const boxes = await listGoalBoxes();
    await linkGoalBox("goal-1", boxes[0].id);

    expect(boxes.map((box) => box.id)).toEqual(["objective-box"]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/boxes?limit=100");
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/v1/goals/goal-1/link-box");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ box_id: "objective-box" }));
    expect(init.headers).toEqual(
      expect.objectContaining({
        "idempotency-key": expect.stringMatching(/^goal-link-box:/),
      })
    );
  });
});

function apiResponse(data: unknown) {
  return new Response(
    JSON.stringify({
      ok: true,
      data,
      meta: { trace_id: "trace-test" },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    }
  );
}
