import templateDefinition from "./templates/manzana_movimiento_por_confirmar_v1.json";

export const EMAIL_PENDING_UTILITY_TEMPLATE = templateDefinition;

export type EmailPendingUtilityTemplateContract = {
  name: string;
  language: string;
  params: Record<string, never>;
};

export function buildEmailPendingUtilityTemplateContract():
  EmailPendingUtilityTemplateContract {
  return {
    name: templateDefinition.name,
    language: templateDefinition.language,
    params: {},
  };
}

export function renderEmailPendingUtilityTemplatePreview(): string {
  return (
    templateDefinition.components.find(
      (component) => component.type === "BODY",
    )?.text ?? ""
  );
}
