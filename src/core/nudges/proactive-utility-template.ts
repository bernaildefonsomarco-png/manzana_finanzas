import templateDefinition from "./templates/manzana_compromiso_financiero_v1.json";
import type { NudgeCandidate, NudgeType } from "@/shared/types/domain";

const COMMITMENT_TEMPLATE_TYPES = new Set<NudgeType>([
  "payment_due",
  "overdue_payment",
  "debt_due",
]);

export const COMMITMENT_UTILITY_TEMPLATE = templateDefinition;

export type CommitmentUtilityTemplateContract = {
  name: string;
  language: string;
  params: Record<string, string>;
};

export function buildCommitmentUtilityTemplateContract(
  candidate: Pick<NudgeCandidate, "type" | "metadata">,
): CommitmentUtilityTemplateContract | null {
  if (!COMMITMENT_TEMPLATE_TYPES.has(candidate.type)) return null;

  return {
    name: templateDefinition.name,
    language: templateDefinition.language,
    params: {
      "1": resolveCommitmentTiming(candidate.metadata.days_until_due),
    },
  };
}

export function renderCommitmentUtilityTemplatePreview(
  contract: CommitmentUtilityTemplateContract,
): string {
  const body = templateDefinition.components.find(
    (component) => component.type === "BODY",
  )?.text;

  if (!body) return "";
  return body.replace("{{1}}", contract.params["1"] ?? "");
}

export function resolveCommitmentTiming(daysUntilDue: unknown): string {
  if (typeof daysUntilDue !== "number" || !Number.isFinite(daysUntilDue)) {
    return "que conviene revisar";
  }

  if (daysUntilDue < 0) return "que sigue pendiente";
  if (daysUntilDue === 0) return "para hoy";
  if (daysUntilDue === 1) return "para mañana";
  return "para los próximos días";
}
