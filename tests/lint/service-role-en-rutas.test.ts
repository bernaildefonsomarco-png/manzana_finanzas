// `AC-SEG-01` (`15` §5, `53` D-02, `WEB-D168`): ninguna ruta de `src/app/api/`
// importa `createServiceClient` sin justificación registrada. Este test es
// el que corre en `npm test`; el mismo gate corre tambien en `prebuild`
// (51 §7: los seis — ahora siete — que fallan el build, no solo la suite).
import { describe, expect, it } from "vitest";
import { verificarServiceRoleEnRutas } from "../../scripts/gates/service-role-en-rutas.ts";
import { EXCEPCIONES_TEMPORALES, LISTA_BLANCA_PERMANENTE } from "../../scripts/gates/service-role-lista.ts";

describe("AC-SEG-01: service-role solo con justificación registrada", () => {
  it("toda ruta que usa createServiceClient está en una de las dos listas, y ninguna excepción temporal es obsoleta", () => {
    const resultado = verificarServiceRoleEnRutas();
    expect(resultado.sinJustificar).toEqual([]);
    expect(resultado.entradasObsoletas).toEqual([]);
  });

  it("la lista de excepciones temporales tiene 57 rutas: W-15 retira dashboard/home, reemplazado por v1/home", () => {
    // /api/v1/onboarding y /api/v1/privacy/account están entre las 48 que
    // 15 §1 mide como "usan createServiceClient", pero 15 §4 ya las
    // justifica como categoría permanente (registro sin sesión completa,
    // borrado de todas las tablas). No son pendientes de migrar: no
    // deberían estar en la lista que AC-SEG-07 quiere vaciar.
    // `v1/accounts/*/restore` es una ruta nueva de W-08 (ACT-CUENTAS-04),
    // y W-10 sumó siete más sobre `pending`/`email` que comparten la misma
    // razón de RLS (15 §9): `pending/*/already-registered`,
    // `pending/*/context`, `pending/batch/*/undo`, `email/suggestions`,
    // `email/suggestions/*/accept`, `.../reject`, `.../silence`.
    // (`templates` y `capture/parse` de W-10 NO están aquí: AC-CAP-15 exige
    // cero service-role en ese módulo, y su RLS ya lo permite sin él.)
    // W-11 suma cinco rutas de lifecycle de Deudas y tres de Recurrentes;
    // siguen siendo excepciones temporales hasta la migración autenticada
    // de sus contratos, no una autorización permanente del service-role.
    // W-12 añade `internal/jobs/budgets-daily`, cubierto por la lista blanca
    // permanente de jobs: no incrementa estas excepciones de `/api/v1`.
    // W-13 retira tres acciones de Descubrimientos y la colección de Memoria:
    // ya operan con el cliente autenticado y RLS, por lo que conservarlas en
    // la lista sería una excepción obsoleta, no documentación preventiva.
    // W-14 no cambia el total: sus nuevas rutas usan cliente autenticado.
    // W-15 retira `v1/dashboard/home`: el Home legacy que lo usaba se borra
    // y `GET /home` (su reemplazo) escribe `service_role` por una razón
    // estructural distinta (tabla "no client write"), así que entra en la
    // lista blanca permanente, no en esta — ver `v1/home` arriba.
    // W-17 añade tres rutas de `v1/assistant/proposals/*`: mismo patrón y
    // misma razón que `v1/pending/*` — confirmar/editar/descartar una
    // propuesta opera sobre un `pending_item` real (`WEB-D263`).
    expect(EXCEPCIONES_TEMPORALES.length).toBe(60);
  });

  it("AC-SEG-07 (agregado): la lista temporal no está vacía todavía — no cierra en W-02 (WEB-D168)", () => {
    // Este test documenta el estado, no lo exige en verde-vacio: AC-SEG-07
    // cierra cuando la ultima ruta sale de EXCEPCIONES_TEMPORALES, en el
    // corte que la migre. Si algún día está vacía, esta prueba lo veria y
    // habria que promover AC-SEG-07 a verificado en la matriz.
    expect(EXCEPCIONES_TEMPORALES.length).toBeGreaterThan(0);
  });

  it("las dos listas no se solapan: ninguna ruta aparece dos veces", () => {
    const patrones = [...LISTA_BLANCA_PERMANENTE, ...EXCEPCIONES_TEMPORALES].map((e) => e.patron);
    expect(new Set(patrones).size).toBe(patrones.length);
  });

  it("toda entrada de las dos listas declara una justificación no vacía", () => {
    for (const entrada of [...LISTA_BLANCA_PERMANENTE, ...EXCEPCIONES_TEMPORALES]) {
      expect(entrada.justificacion.length).toBeGreaterThan(10);
    }
  });
});
