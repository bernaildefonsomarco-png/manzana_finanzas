// `AC-SEG-04` (`15` §8): un recurso de otro usuario devuelve 404, nunca 403.
// Criterio agregado (`51` §5): su conjunto son las 145 rutas de `/api/v1`
// (`AC-SEG-04` no se cierra con una prueba, se cierra con la unión de que
// ninguna de las 145 use 403 para "no es tuyo" — que es exactamente lo que
// produce el patrón de repositorio del proyecto: toda consulta de un
// recurso filtra por `user_id` e `id` a la vez, así que un recurso ajeno
// simplemente no aparece, nunca se detecta y se rechaza aparte). W-08 sumó
// `v1/accounts/[id]/restore`, la 59; W-09 sumó `v1/movements/[id]/history`,
// la 60; W-10 sumó once: `pending/[id]/already-registered`,
// `pending/[id]/context`, `pending/batch/[batch_id]/undo`,
// `email/suggestions`, `email/suggestions/[id]/{accept,reject,silence}`,
// `templates`, `templates/[id]`, `templates/[id]/use`, `capture/parse`.
// W-11 suma doce: `debts/[id]/close`, `debts/[id]/installments`,
// `debts/[id]/installments/[iid]/{reschedule,skip}`,
// `debts/[id]/payments/preview`, `debts/[id]/reopen`,
// `recurring/[id]/occurrences`,
// `recurring/[id]/occurrences/[occurrence_id]/skip`,
// `recurring/[id]/{pause,resume}`, `recurring/candidates`, `upcoming`.
// W-12 suma veintiuna rutas para presupuestos, metas, proyecciones y
// simulación; las colecciones sin `:id` prueban aislamiento por alcance
// (`WEB-D230`) y las rutas con recurso conservan 404.
// W-13 suma dieciséis rutas para clasificación masiva, merge,
// Descubrimientos y Memoria; las acciones mantienen recibo idempotente y los
// recursos ajenos siguen siendo indistinguibles de uno inexistente.
// W-14 suma veintidós rutas: `reminders`, `reminders/count`,
// `reminders/[id]/{read,snooze,dismiss}`, `reminders/read-all`,
// `reminder-preferences`, `reminder-preferences/{pause,resume}`, `search`,
// `search/palette`, `search/suggest`, `saved-searches`,
// `saved-searches/[id]`, `reports/{period,compare,chart}`, `saved-reports`,
// `saved-reports/[id]`, `exports`, `exports/[id]`, `exports/[id]/link`.
// Las colecciones sin `:id` (reminders, search, saved-searches, saved-reports,
// exports) prueban aislamiento por alcance (WEB-D230); las rutas con recurso
// mapean "ajeno" a `REMINDER_FORBIDDEN`/`EXPORT_FORBIDDEN` u ownership de RLS,
// y en los dos casos la ruta HTTP responde 404, nunca 403.
// W-15 retira `dashboard/home` (Home legacy borrado) y suma cuatro:
// `home`, `home/next`, `home/next/[id]/postpone`, `home/preferences` — neto
// +3, de 142 a 145. `home`/`home/next` son colecciones sin recurso
// identificable y prueban aislamiento por alcance (WEB-D230); `postpone`
// mapea "ajeno" a `REMINDER_FORBIDDEN` igual que `reminders/[id]/dismiss`,
// del que reutiliza el mapeo de errores.
// W-18 suma cinco (de 152 a 157): `auth/attempt`, `auth/events`,
// `auth/password`, `auth/email`, `preferences/discreet`. Las cinco son
// colecciones sin recurso identificable por `[id]` — `auth/attempt` y
// `auth/events` (POST) no tienen sesión de otro usuario que confundir
// (pre-sesión o siempre el propio `auth.uid()`); `auth/password`/`auth/email`
// actúan siempre sobre la sesión propia; `preferences/discreet` es un
// resolvedor de solo lectura sobre el propio usuario (`45` `RUL-CONF-03`).
// Las cinco prueban aislamiento por alcance (mismo patrón que `WEB-D230`),
// no por `id` ajeno.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_V1 = join(process.cwd(), "src", "app", "api", "v1");

function recorrer(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      recorrer(ruta, acumulado);
    } else if (entrada === "route.ts") {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

describe("AC-SEG-04 (agregado): ninguna de las 157 rutas de /api/v1 usa 403 para un recurso ajeno", () => {
  const rutas = recorrer(RAIZ_V1, []);

  it("el conjunto declarado tiene 157 rutas — si cambia, hay que revisar esta prueba", () => {
    expect(rutas.length).toBe(157);
  });

  it.each(rutas.map((rutaAbsoluta) => [relative(RAIZ_V1, rutaAbsoluta).split("\\").join("/"), rutaAbsoluta]))(
    "%s no devuelve 403",
    (_rutaRelativa, rutaAbsoluta) => {
      const contenido = readFileSync(rutaAbsoluta, "utf8");
      expect(contenido).not.toMatch(/\b403\b/);
    }
  );
});
