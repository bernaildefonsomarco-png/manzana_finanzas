import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import {
  batchConfirmPendingItems,
  batchDiscardPendingItems,
  confirmPendingItem,
  discardPendingItem,
  updatePendingItem,
} from "./pending-api";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

/**
 * La costura, no cada lado por separado: la cabecera que este cliente emite se
 * valida con `readIdempotencyKey`, el mismo lector que corre en la ruta. Las
 * rutas ya tenian test y el cliente tambien podria tenerlo, y aun asi
 * `confirm` devolvia 400 siempre porque nadie comparo lo que uno manda con lo
 * que el otro exige (`14` §7, `AC-API-05`).
 */
describe("pending-api: escrituras aceptadas por el lector real de la ruta", () => {
  const ESCRITURAS: Array<{
    nombre: string;
    /** `true` cuando la ruta hoy responde 400 sin la cabecera. */
    rutaLaExige: boolean;
    invocar: () => Promise<unknown>;
    respuesta: unknown;
  }> = [
    {
      nombre: "confirmPendingItem",
      rutaLaExige: true,
      invocar: () => confirmPendingItem("pending-1"),
      respuesta: {
        pending_item: { id: "pending-1" },
        movement: { id: "movement-1" },
        idempotent: false,
        auto_resolved_duplicate: false,
      },
    },
    {
      nombre: "batchConfirmPendingItems",
      rutaLaExige: true,
      invocar: () => batchConfirmPendingItems(["pending-1", "pending-2"]),
      respuesta: { requested: 2, confirmed: 2, failed: 0, results: [] },
    },
    {
      nombre: "updatePendingItem",
      rutaLaExige: false,
      invocar: () => updatePendingItem("pending-1", { title: "Comida" }),
      respuesta: { pending_item: { id: "pending-1" } },
    },
    {
      nombre: "discardPendingItem",
      rutaLaExige: false,
      invocar: () => discardPendingItem("pending-1"),
      respuesta: { pending_item: { id: "pending-1" } },
    },
    {
      nombre: "batchDiscardPendingItems",
      rutaLaExige: false,
      invocar: () => batchDiscardPendingItems(["pending-1"]),
      respuesta: { requested: 1, discarded: 1, failed: 0, results: [] },
    },
  ];

  it.each(ESCRITURAS)(
    "$nombre manda una Idempotency-Key que la ruta acepta",
    async ({ invocar, respuesta }) => {
      fetchMock.mockResolvedValueOnce(apiResponse(respuesta));

      await invocar();

      expect(readIdempotencyKey(peticionEmitida())).not.toBeNull();
    }
  );

  it("cubre todas las rutas de escritura que hoy exigen la cabecera", () => {
    // Si manana `discard` estrena la misma puerta, este recuento obliga a
    // revisar la lista en vez de descubrirlo con un 400 en produccion.
    expect(ESCRITURAS.filter((escritura) => escritura.rutaLaExige)).toHaveLength(
      2
    );
  });
});

/** La peticion tal como salio del cliente, para leerla como la leeria la ruta. */
function peticionEmitida(): Request {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return new Request(`https://manzana.test${url}`, {
    method: init.method ?? "GET",
    headers: init.headers,
    body: init.body,
  });
}

function apiResponse(data: unknown) {
  return new Response(
    JSON.stringify({ ok: true, data, meta: { trace_id: "trace-test" } }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
