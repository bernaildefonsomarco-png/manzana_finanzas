"use client";

import { useEffect, useId } from "react";
import { Card } from "@/ui/primitivas/card";
import { cn } from "@/ui/primitivas/cn";
import { ConfirmationCardActions } from "./confirmation-card-actions";
import { ConfirmationCardFieldRow } from "./confirmation-card-field-row";

export type ConfirmationCardField = {
  key: string;
  label: string;
  value: string;
  /** `26` §14.2: el motor no dedujo este campo con certeza — se resalta. */
  uncertain?: boolean;
  /** Si viene, el campo editable se renderiza como `<select>`, no `<input>`. */
  options?: Array<{ value: string; label: string }>;
  /** `RUL-ASI-17`: si viene y el campo es de solo lectura, se muestra con `MoneyText` (respeta el modo discreto) en vez de texto plano. */
  moneyValue?: number;
};

export type ConfirmationCardLevel =
  | "tarjeta"
  | "tarjeta_editable"
  | "riesgo"
  | "consentimiento";

export type ConfirmationCardProps = {
  level: ConfirmationCardLevel;
  /** "Voy a registrar" (41 §5) — nunca en pasado (`RUL-ASI-04`). */
  title: string;
  fields: ConfirmationCardField[];
  confirmLabel: string;
  /** `aria-label` completo del boton de confirmar (`18`: "Registrar gasto de 32 soles en Alimentación", nunca solo "Registrar"). */
  confirmAriaLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  /** Solo se usa cuando `level === "tarjeta_editable"`. */
  onFieldChange?: (key: string, value: string) => void;
  loading?: boolean;
  /** `nivel riesgo`: "Podrás deshacerlo durante 30 días." */
  undoNote?: string;
  /** `nivel consentimiento`: qué se autoriza, con qué frecuencia y como se revoca. */
  consentDetails?: { what: string; frequency: string; revoke: string };
  /** `RUL-ASI-06` vs `RUL-ASI-22`: en el asistente la tarjeta siempre llega como respuesta a un envío, así que el foco NO debe moverse — por defecto `false`; solo un contexto de navegación explícita a la tarjeta debería pasar `true`. */
  autoFocusUncertainField?: boolean;
  className?: string;
};

/**
 * `41` §5, el componente mas importante del documento: `WEB-D013` visible
 * — "el agente propone, el usuario confirma, el Core ejecuta". Un solo
 * componente para los cuatro niveles que SI tienen tarjeta (`ninguna` no
 * tiene tarjeta y lo decide quien llama, `masiva` es `MassivePreviewCard`,
 * `41` §6).
 */
export function ConfirmationCard({
  level,
  title,
  fields,
  confirmLabel,
  confirmAriaLabel,
  onConfirm,
  onCancel,
  cancelLabel,
  onFieldChange,
  loading = false,
  undoNote,
  consentDetails,
  autoFocusUncertainField = false,
  className,
}: ConfirmationCardProps) {
  const headingId = useId();
  const isEditable = level === "tarjeta_editable";
  const isRisk = level === "riesgo";
  const firstUncertainField = fields.find((field) => field.uncertain);
  const firstUncertainFieldId = firstUncertainField
    ? `${headingId}-${firstUncertainField.key}`
    : null;

  // `RUL-ASI-06`: el foco entra en el primer campo que el motor no dedujo
  // con certeza, sin mover el foco cuando no hay ninguno (RUL-ASI-22: el
  // foco nunca salta por sorpresa fuera de este caso explicito). Por `id`,
  // no por `ref`: `Input`/`Select` son componentes de funcion simples, sin
  // `forwardRef`.
  useEffect(() => {
    if (!autoFocusUncertainField || !isEditable || !firstUncertainFieldId) return;
    document.getElementById(firstUncertainFieldId)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card
      aria-labelledby={headingId}
      className={cn("space-y-4 p-5", className)}
    >
      <h3 id={headingId} className="font-heading text-base font-medium text-text">
        {title}
      </h3>

      <dl className="space-y-3">
        {fields.map((field) => (
          <ConfirmationCardFieldRow
            key={field.key}
            field={field}
            fieldId={`${headingId}-${field.key}`}
            isEditable={isEditable}
            onFieldChange={onFieldChange}
          />
        ))}
      </dl>

      {isRisk && undoNote ? (
        <p className="text-sm text-text-secondary">{undoNote}</p>
      ) : null}

      {level === "consentimiento" && consentDetails ? (
        <dl className="space-y-1 rounded-md bg-bg-surface p-3 text-sm text-text-secondary">
          <div>
            <dt className="inline font-medium text-text">Autoriza: </dt>
            <dd className="inline">{consentDetails.what}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-text">Frecuencia: </dt>
            <dd className="inline">{consentDetails.frequency}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-text">Revocar: </dt>
            <dd className="inline">{consentDetails.revoke}</dd>
          </div>
        </dl>
      ) : null}

      <ConfirmationCardActions
        isRisk={isRisk}
        confirmLabel={confirmLabel}
        confirmAriaLabel={confirmAriaLabel}
        cancelLabel={cancelLabel}
        loading={loading}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </Card>
  );
}
