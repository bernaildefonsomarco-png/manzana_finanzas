// `AC-ASI-22`/`41` §20: el contenido de los mensajes no se registra en
// telemetría — "lo que alguien escribe sobre su dinero no se registra"
// (mismo criterio que `WEB-D080` en búsqueda). No existe todavía un
// pipeline de eventos de producto en esta app (ni aquí ni en búsqueda,
// cuyo `AC-BUS-12`/`AC-BUS-13` tampoco tienen código): lo único real que
// se puede verificar hoy es que los `logger.*` del camino del asistente
// nunca llevan el texto crudo del turno como metadato.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const FICHEROS_DEL_ASISTENTE = [
  "src/core/assistant/handle-web-turn.ts",
  "src/adapters/web/present-turn.ts",
];

// Argumentos de `logger.*` que nunca deben llevar el texto del turno: la
// palabra `text` como clave (`text:`) o como forma abreviada (`text,`/`text }`).
const PATRON_TEXTO_EN_METADATO = /\btext[,:}\s]/;

describe("AC-ASI-22 (sin-contenido-en-telemetria): el texto del turno nunca es metadato de log", () => {
  for (const ruta of FICHEROS_DEL_ASISTENTE) {
    it(`${ruta} no pasa \`text\` a ningún logger.*`, () => {
      const contenido = readFileSync(join(RAIZ, ruta), "utf8");
      const llamadas = contenido.match(/logger\.\w+\([^;]*?\)\s*;/g) ?? [];
      expect(llamadas.length).toBeGreaterThan(0);

      for (const llamada of llamadas) {
        expect(llamada).not.toMatch(PATRON_TEXTO_EN_METADATO);
      }
    });
  }
});
