import { getCurrentDegradation } from "@/core/degradation/current-grade";

export const dynamic = "force-dynamic";

/**
 * `41` S9: el grado de degradacion actual, consultado al abrir el panel
 * (S19: bajo 100 ms). `getCurrentDegradation` es la misma composicion que
 * usa `handle-web-turn.ts` para decidir si llama al motor o filtra bloques
 * de accion (`WEB-D268`) — una sola fuente para las dos lecturas.
 */
export async function GET() {
  const { decision, readiness } = getCurrentDegradation();

  return Response.json(
    {
      grado: decision.grado,
      puede_proponer_acciones: decision.puedeProponerAcciones,
      debe_ofrecer_via_manual: decision.debeOfrecerViaManualConcreta,
      agent_runtime: readiness,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
