import { getAgentRuntimeReadiness, type AgentRuntimeReadinessReport } from "@/agents/runtime";
import { determinarGradoDeDegradacion, type DegradationDecision } from "./grade";

export type CurrentDegradation = {
  decision: DegradationDecision;
  readiness: AgentRuntimeReadinessReport;
};

/**
 * Composición de `getAgentRuntimeReadiness()` (W-16) con
 * `determinarGradoDeDegradacion` (`23` §7) — la misma que ya hacía
 * `GET /assistant/health` (`WEB-D264`: no existe todavía señal en vivo de
 * `lento` ni de `coreRechazaEscrituras`, se documentan `false`). Un solo
 * lugar para que la ruta de salud y el turno del asistente lean el mismo
 * grado, en vez de que cada llamador repita la composición.
 */
export function getCurrentDegradation(): CurrentDegradation {
  const readiness = getAgentRuntimeReadiness();
  const decision = determinarGradoDeDegradacion({
    modeloNoDisponible: !readiness.overall_ready,
    modeloTardando: false,
    coreRechazaEscrituras: false,
  });
  return { decision, readiness };
}
