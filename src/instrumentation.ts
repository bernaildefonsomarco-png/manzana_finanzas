// Gate de arranque para `AC-RT-01` y `AC-REU-06` (`23`, `42` §6, `53` D-04,
// `RUL-PLAN-04`: los cierra `W-02` aunque sus documentos sean de `W-16`).
//
// `register()` se ejecuta una sola vez al iniciar el servidor y debe
// completar antes de que atienda peticiones (convención de Next.js 16,
// `node_modules/next/dist/docs/.../instrumentation.md`). Si lanza, el
// servidor no arranca — que es la diferencia entre esto y el endpoint de
// salud existente (`/api/health/agent-runtime`), que solo *informa* con un
// 503 después de que el proceso ya está arriba.
//
// El riesgo que cierra (`53` D-04): un motor de prueba sirviendo en
// producción responde con datos financieros inventados **sin fallar**. Es
// el modo de fallo más peligroso del producto — silencioso y plausible — y
// por eso no basta con que algo lo reporte: tiene que impedir que arranque.

import { readAgentRuntimeConfig, type AgentRuntimeConfig } from "@/agents/runtime/config";
import { getAgentRuntimeReadiness } from "@/agents/runtime/readiness";

/**
 * La comprobación en sí, separada de `register()` para poder probarla sin
 * depender del ciclo de vida real del servidor de Next.
 *
 * Lanza si el arranque no es seguro; no hace nada si lo es.
 */
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

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    verificarArranqueSeguro();
  } catch (error) {
    // Medido en `next start` real (LIVE, W-02): lanzar aquí no evita que el
    // proceso siga vivo — Next.js ya ha enlazado el puerto y cada petición
    // responde 500, pero el proceso no termina por sí solo. Para que "no
    // arranca" sea literal y no solo "todo falla", se fuerza la salida.
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
