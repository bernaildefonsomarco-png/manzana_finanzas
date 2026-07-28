// La comprobación en sí, para `AC-RT-01` y `AC-REU-06` (`23`, `42` §6,
// `53` D-04, `RUL-PLAN-04`: los cierra `W-02` aunque sus documentos sean de
// `W-16`). Separada de `instrumentation.ts` para poder probarla sin
// depender del ciclo de vida real del servidor de Next, y para que no
// arrastre `process.exit` (que solo vive en `instrumentation.node.ts`) al
// analizador de compatibilidad de Next con el runtime Edge.
//
// El riesgo que cierra (`53` D-04): un motor de prueba sirviendo en
// producción responde con datos financieros inventados **sin fallar**. Es
// el modo de fallo más peligroso del producto — silencioso y plausible — y
// por eso no basta con que algo lo reporte: tiene que impedir que arranque.

import { readAgentRuntimeConfig, type AgentRuntimeConfig } from "@/agents/runtime/config";
import { getAgentRuntimeReadiness } from "@/agents/runtime/readiness";

/** Lanza si el arranque no es seguro; no hace nada si lo es. */
export function verificarArranqueSeguro(config: AgentRuntimeConfig = readAgentRuntimeConfig()): void {
  if (config.appEnvironment !== "production") return;

  const readiness = getAgentRuntimeReadiness(config);

  // AC-RT-01: el motor de prueba no puede servir en producción.
  if (config.localFixtureAllowed) {
    throw new Error(
      "[gate:arranque-seguro] AC-RT-01: local_fixture está permitido en " +
        "producción (APP_ENV=production con localFixtureAllowed=true). " +
        "El servidor no arranca."
    );
  }

  // AC-REU-06: el arranque falla si production_safe es falso.
  if (!readiness.production_safe) {
    const bloqueados = readiness.agents
      .filter((agente) => agente.status === "blocked")
      .map((agente) => `${agente.agent_name} (${agente.reasons.join(", ")})`);
    throw new Error(
      "[gate:arranque-seguro] AC-REU-06: production_safe es falso en " +
        `producción. Agentes bloqueados: ${bloqueados.join("; ") || "ninguno, pero el gate general falló"}. ` +
        "El servidor no arranca."
    );
  }
}
