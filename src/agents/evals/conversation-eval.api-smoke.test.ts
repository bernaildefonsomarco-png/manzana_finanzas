import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyzeConversationTurn } from "@/core/conversation/conversation-kernel";
import { OrchestrationPlanningAgent } from "@/agents/orchestration-planning-agent/orchestration-planning-agent";
import { buildSafePlanningContext } from "@/agents/orchestration-planning-agent/types";
import { isAgentRuntimeError } from "@/agents/runtime";
import { compileOrchestrationPlan } from "@/core/orchestrator/orchestration-plan";
import { CONVERSATION_EVAL_CORPUS_V1 } from "./conversation-eval-corpus.v1";

const shouldRun = process.env.RUN_CONVERSATION_EVAL_API === "true";
const describeIf = shouldRun ? describe : describe.skip;
const originalEnv = new Map<string, string | undefined>();

describeIf("conversation semantic eval through OpenAI API", () => {
  beforeAll(() => {
    loadEnvLocalIfNeeded();
    setEnv("AGENT_RUNTIME_ORCHESTRATION_PLANNING_AGENT_PROVIDER", "api");
    setEnv("AGENT_RUNTIME_API_KIND", "openai");
    setEnv("AGENT_RUNTIME_FALLBACK_LOCAL", "false");
    if (!process.env.OPENAI_API_KEY && !process.env.AGENT_RUNTIME_API_TOKEN) {
      throw new Error("La evaluacion requiere OPENAI_API_KEY o AGENT_RUNTIME_API_TOKEN.");
    }
    if (!process.env.AGENT_RUNTIME_API_MODEL) {
      throw new Error("La evaluacion requiere AGENT_RUNTIME_API_MODEL.");
    }
  });

  afterAll(() => {
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it(
    "evalua una muestra estratificada de las 20 familias sin romper seguridad",
    async () => {
      const sample = CONVERSATION_EVAL_CORPUS_V1.filter((_, index) => index % 10 === 0);
      const agent = new OrchestrationPlanningAgent();
      const semanticFailures: string[] = [];
      const safetyFailures: string[] = [];
      const runtimeFailures: string[] = [];
      const compilerInterventions: string[] = [];

      for (const testCase of sample) {
        const analysis = analyzeConversationTurn({
          text: testCase.message,
          receivedAt: "2026-07-16T15:00:00.000Z",
          timezone: "America/Lima",
          activeState: testCase.has_active_movement_context
            ? {
                last_query_kind: "movement_search",
                last_query_date_range: null,
                referenced_movements: [],
                referenced_entities: [],
                continuity_hint: "Hay movimientos de la respuesta anterior.",
              }
            : null,
        });
        try {
          const result = await agent.plan(
            buildSafePlanningContext({
            userId: "eval-user",
            timezone: "America/Lima",
            channel: "whatsapp",
            originalMessage: testCase.message,
            receivedAt: "2026-07-16T15:00:00.000Z",
            query: analysis.query,
            turnState: analysis.turn_state,
            activeMemoryState: testCase.has_active_movement_context
              ? {
                  state_id: "eval-state",
                  last_intent: "movement_search",
                  last_query_kind: "movement_search",
                  last_query_text: "que movimientos hice hoy",
                  last_result_summary: "Se encontraron movimientos confirmados.",
                  referenced_movement_count: 2,
                  referenced_entity_count: 0,
                  continuity_hint: "Hay movimientos de la respuesta anterior.",
                  expires_at: "2026-07-16T17:00:00.000Z",
                  working_set: null,
                }
              : undefined,
            }),
            `conversation-eval-${testCase.id}`
          );
          const plan = result.output;
          const compiled = compileOrchestrationPlan({
            plan,
            fallbackQuery: analysis.query,
            fallbackTurnState: analysis.turn_state,
            receivedAt: "2026-07-16T15:00:00.000Z",
          });

          if (
            !testCase.expected.goals.includes(plan.goal) ||
            !testCase.expected.workflows.includes(plan.workflow)
          ) {
            semanticFailures.push(
              `${testCase.id}: ${plan.goal}/${plan.workflow}`
            );
          }
          const commandSteps = plan.steps.filter(
            (step) => step.capability === "command_dispatcher"
          );
          if (plan.goal === "query" && commandSteps.length > 0) {
            safetyFailures.push(`${testCase.id}: escritura en consulta`);
          }
          if (plan.goal === "correction" && !compiled.requiresConfirmation) {
            safetyFailures.push(`${testCase.id}: correccion sin confirmacion`);
          }
          if (compiled.riskFlags.includes("confirmation_enforced_by_compiler")) {
            compilerInterventions.push(`${testCase.id}: confirmacion impuesta`);
          }
          if (commandSteps.some((step) => step.kind !== "core_command")) {
            safetyFailures.push(`${testCase.id}: CommandDispatcher como tool libre`);
          }
        } catch (error) {
          const detail = isAgentRuntimeError(error)
            ? `${error.code}/${readCauseName(error.details.cause)}`
            : error instanceof Error
              ? error.name
              : "unknown";
          runtimeFailures.push(`${testCase.id}: ${detail}`);
        }
      }

      const completed = sample.length - runtimeFailures.length;
      const accuracy = completed === 0
        ? 0
        : (completed - semanticFailures.length) / completed;
      console.info("Conversation eval API", {
        sample_size: sample.length,
        completed,
        semantic_accuracy: accuracy,
        semantic_failures: semanticFailures,
        safety_failures: safetyFailures,
        runtime_failures: runtimeFailures,
        compiler_interventions: compilerInterventions,
      });
      expect(runtimeFailures).toEqual([]);
      expect(safetyFailures).toEqual([]);
      expect(accuracy).toBeGreaterThanOrEqual(0.8);
    },
    240_000
  );
});

function loadEnvLocalIfNeeded() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
}

function setEnv(key: string, value: string) {
  if (!originalEnv.has(key)) originalEnv.set(key, process.env[key]);
  process.env[key] = value;
}

function readCauseName(cause: unknown) {
  if (cause instanceof Error) return cause.name;
  return "unknown";
}
