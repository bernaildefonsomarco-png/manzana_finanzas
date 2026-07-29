"use client";

import { MOVEMENT_TYPE_GROUP } from "./movement-types";
import type { MovementFormState } from "./use-movement-form";
import { GenericMovementFields } from "./generic-movement-fields";
import { DebtOriginationFields } from "./debt-origination-fields";
import { DebtPaymentFields } from "./debt-payment-fields";

/**
 * `26` §4.3: los campos que cambian segun el tipo elegido, despachados por
 * grupo (`WEB-D195`). Separado de `movement-form.tsx` para que ningun
 * fichero supere `tamano-componente` (`AC-ARQ-04`).
 */
export function MovementTypeFields({ form }: { form: MovementFormState }) {
  const group = MOVEMENT_TYPE_GROUP[form.type];
  if (group === "debt_origination") return <DebtOriginationFields form={form} />;
  if (group === "debt_payment") return <DebtPaymentFields form={form} />;
  return <GenericMovementFields form={form} />;
}
