import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/data/query-keys";
import { invalidateForMutation } from "@/shared/data/invalidation";
import { getMoneyDashboard } from "@/shared/api/money";
import { listSubcategories } from "@/shared/api/categories";
import { listDebts } from "@/shared/api/debts";
import { listRecurringRules } from "@/shared/api/recurring";
import { parseMoneyInput } from "@/shared/money/parse-money-input";
import { isoDateInLima, limaLocalInputToUtcIso, utcIsoToLimaParts } from "@/shared/dates/lima";
import {
  isMovementDateFuture,
  movementDateFieldsFromPrefill,
  type MovementPrefill,
} from "@/shared/movements/movement-prefill";
import {
  ApiClientError,
  createDebtOriginationMovement,
  createDebtPaymentMovement,
  createMovement,
  type DuplicateWarning,
} from "@/shared/api/movements";
import type { CategorySelectorValue } from "@/shared/ui/category-selector/category-selector";
import type { MovementType } from "@/shared/types/domain";
import { MOVEMENT_TYPE_GROUP } from "./movement-types";

function nowForDatetimeLocalInLima(): string {
  const parts = utcIsoToLimaParts(new Date().toISOString());
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month + 1)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/**
 * `SCR-MOV-03`: todo el estado y el envío de `MovementForm` (`26` §4.3),
 * separado del árbol JSX para que ningún fichero de este formulario supere
 * el límite de `tamano-componente` (`AC-ARQ-04`).
 *
 * Deliberadamente no usa `useZodForm` (`WEB-D186`): las tres formas de
 * payload (genérico/creación de deuda/pago de deuda) son tan distintas entre
 * sí que forzarlas a un único esquema de resolver hubiera significado
 * reinventar la discriminación que el servidor ya hace — la validación real
 * y autoritativa vive ahí (`schemas.ts`, ya probada); este formulario valida
 * lo mínimo para una buena experiencia y muestra el mensaje del servidor
 * cuando rechaza algo.
 */
export function useMovementForm(onSaved: () => void, prefill?: MovementPrefill) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<MovementType>(prefill?.type ?? "gasto");
  const [amountRaw, setAmountRaw] = useState(prefill?.amount ?? "");
  const [initialDateFields] = useState(() =>
    movementDateFieldsFromPrefill(prefill, nowForDatetimeLocalInLima()),
  );
  const [occurredDate, setOccurredDate] = useState(initialDateFields.date);
  const [occurredTime, setOccurredTime] = useState(initialDateFields.time);
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState<CategorySelectorValue | null>(
    prefill ? { kind: "category", categoryId: prefill.categoryId } : null,
  );
  const [accountOriginId, setAccountOriginId] = useState("");
  const [accountDestinationId, setAccountDestinationId] = useState("");
  const [boxOriginId, setBoxOriginId] = useState("");
  const [boxDestinationId, setBoxDestinationId] = useState("");
  const [relatedPersonName, setRelatedPersonName] = useState("");
  const [debtId, setDebtId] = useState("");
  const [recurringRuleId, setRecurringRuleId] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const moneyQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getMoneyDashboard });
  const debtsQuery = useQuery({
    queryKey: queryKeys.debts.all,
    queryFn: listDebts,
    enabled: MOVEMENT_TYPE_GROUP[type] === "debt_payment",
  });
  const recurringQuery = useQuery({
    queryKey: queryKeys.recurringRules.all,
    queryFn: listRecurringRules,
    enabled: type === "pago_recurrente",
  });
  const subcategoriesQuery = useQuery({
    queryKey: queryKeys.subcategories.list(),
    queryFn: () => listSubcategories(),
  });

  const accounts = moneyQuery.data?.accounts ?? [];
  const boxes = moneyQuery.data?.boxes ?? [];
  const recurringRules = recurringQuery.data ?? [];
  const subcategories = subcategoriesQuery.data ?? [];

  // `category_id` es el grupo (12 categorias); "sin clasificar" es
  // `category_id: null`, no un valor especial (`25` §5, W-08).
  function resolveCategorySelection(): { category_id: string | null; subcategory_id: string | null } {
    if (!category || category.kind === "unclassified") return { category_id: null, subcategory_id: null };
    if (category.kind === "category") {
      return { category_id: category.categoryId, subcategory_id: null };
    }
    const subcategory = subcategories.find((s) => s.id === category.subcategoryId);
    return { category_id: subcategory?.category_id ?? null, subcategory_id: category.subcategoryId };
  }

  const relevantDebts = useMemo(
    () =>
      (debtsQuery.data ?? []).filter((debt) =>
        type === "pago_deuda" ? debt.direction === "i_owe" : debt.direction === "they_owe_me",
      ),
    [debtsQuery.data, type],
  );

  function resetTypeSpecificFields() {
    setAccountOriginId("");
    setAccountDestinationId("");
    setBoxOriginId("");
    setBoxDestinationId("");
    setRelatedPersonName("");
    setDebtId("");
    setRecurringRuleId("");
    setAdjustmentReason("");
    setCategory(null);
    setError(null);
    setDuplicateWarning(null);
  }

  function changeType(next: MovementType) {
    setType(next);
    resetTypeSpecificFields();
  }

  function changeOccurredDate(next: string) {
    setOccurredDate(next);
    const today = isoDateInLima();
    if (next === today) {
      const current = nowForDatetimeLocalInLima().split("T")[1] ?? "";
      setOccurredTime(current);
    } else {
      // Una simulacion solo aporta el dia. Al cambiar a otro dia, exigir la
      // hora evita inventar un instante para un hecho financiero.
      setOccurredTime("");
    }
  }

  async function submitGeneric(occurredAtIso: string, amount: number, confirmDuplicate: boolean) {
    if (type === "ajuste" && !adjustmentReason.trim()) {
      setError("Un ajuste necesita un motivo.");
      return;
    }
    const categorySelection = resolveCategorySelection();
    // `26` §4.3: cada tipo solo llena los campos de cuenta/caja que le
    // corresponden; el resto queda `undefined` (no se envia el campo).
    const accountFields: Record<string, string | null> = {};
    if (type === "gasto" || type === "pago_recurrente") accountFields.account_origin_id = accountOriginId || null;
    if (type === "ingreso" || type === "transferencia") {
      accountFields.account_destination_id = accountDestinationId || null;
    }
    if (type === "transferencia") accountFields.account_origin_id = accountOriginId || null;
    // WEB-D197: la cuenta de un ajuste siempre va como destino.
    if (type === "ajuste") accountFields.account_destination_id = accountOriginId || null;

    const usesCategory = type === "gasto" || type === "ingreso" || type === "pago_recurrente";
    await createMovement({
      type: type as "gasto" | "ingreso" | "transferencia" | "asignacion_interna" | "ajuste" | "pago_recurrente",
      amount,
      occurred_at: occurredAtIso,
      description: description.trim() || null,
      merchant: type === "gasto" ? merchant.trim() || null : undefined,
      category_id: usesCategory ? categorySelection.category_id : undefined,
      subcategory_id: usesCategory ? categorySelection.subcategory_id : undefined,
      ...accountFields,
      box_origin_id: type === "asignacion_interna" ? boxOriginId || null : undefined,
      box_destination_id: type === "asignacion_interna" ? boxDestinationId || null : undefined,
      recurring_rule_id: type === "pago_recurrente" ? recurringRuleId || null : undefined,
      metadata: type === "ajuste" ? { reason: adjustmentReason.trim() } : undefined,
      confirm_duplicate: confirmDuplicate || undefined,
    });
    await invalidateForMutation(queryClient, "movement.create");
    onSaved();
  }

  async function submitDebtOrigination(occurredAtIso: string, amount: number) {
    if (!relatedPersonName.trim()) {
      setError("Necesito saber con quién es esta deuda.");
      return;
    }
    await createDebtOriginationMovement({
      type: type as "deuda_adquirida" | "prestamo_dado" | "prestamo_recibido",
      amount,
      occurred_at: occurredAtIso,
      description: description.trim() || null,
      related_person_name: relatedPersonName.trim(),
      account_id: type === "deuda_adquirida" ? null : accountOriginId || accountDestinationId || null,
    });
    await invalidateForMutation(queryClient, "debt.create");
    onSaved();
  }

  async function submitDebtPayment(occurredAtIso: string, amount: number) {
    if (!debtId) {
      setError("Para registrar esto necesito saber cuál deuda.");
      return;
    }
    await createDebtPaymentMovement({
      type: type as "pago_deuda" | "devolucion_recibida",
      debt_id: debtId,
      amount,
      occurred_at: occurredAtIso,
      description: description.trim() || null,
      account_origin_id: type === "pago_deuda" ? accountOriginId || null : undefined,
      account_destination_id: type === "devolucion_recibida" ? accountDestinationId || null : undefined,
    });
    await invalidateForMutation(queryClient, "debt.pay", { debtId });
    onSaved();
  }

  async function handleSubmit(confirmDuplicate = false) {
    setError(null);
    const amount = parseMoneyInput(amountRaw);
    if (amount === null || (type !== "ajuste" && amount <= 0) || (type === "ajuste" && amount === 0)) {
      setError("No entendí ese monto. Escríbelo como 40 o 40.50.");
      return;
    }
    if (!occurredDate) {
      setError("Necesito la fecha.");
      return;
    }
    const today = isoDateInLima();
    if (isMovementDateFuture(occurredDate, today)) {
      setError("Esa fecha todavía no llega. ¿Quieres anotarlo como un pago que viene?");
      return;
    }
    if (!occurredTime) {
      setError("Necesito la hora para registrar ese día sin inventarla.");
      return;
    }
    const occurredAtLocal = `${occurredDate}T${occurredTime}`;
    const occurredAtIso = limaLocalInputToUtcIso(occurredAtLocal);
    // `RUL-MOV-10`: el servidor es quien decide de verdad; esto solo evita
    // un viaje de red para el caso obvio.
    if (new Date(occurredAtIso).getTime() > Date.now()) {
      setError("Esa fecha todavía no llega. ¿Quieres anotarlo como un pago que viene?");
      return;
    }

    setSubmitting(true);
    try {
      const group = MOVEMENT_TYPE_GROUP[type];
      if (group === "generic") await submitGeneric(occurredAtIso, amount, confirmDuplicate);
      else if (group === "debt_origination") await submitDebtOrigination(occurredAtIso, amount);
      else await submitDebtPayment(occurredAtIso, amount);
    } catch (thrown) {
      if (thrown instanceof ApiClientError) {
        if (thrown.code === "CONFLICT" && thrown.details.reason === "cross_channel_duplicate") {
          setDuplicateWarning(thrown.details as unknown as DuplicateWarning);
          return;
        }
        setError(thrown.message);
      } else {
        setError("No pude guardar el movimiento. Intenta de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return {
    type,
    changeType,
    amountRaw,
    setAmountRaw,
    occurredDate,
    changeOccurredDate,
    occurredTime,
    setOccurredTime,
    occurredDateIsFuture: isMovementDateFuture(occurredDate, isoDateInLima()),
    description,
    setDescription,
    merchant,
    setMerchant,
    category,
    setCategory,
    accountOriginId,
    setAccountOriginId,
    accountDestinationId,
    setAccountDestinationId,
    boxOriginId,
    setBoxOriginId,
    boxDestinationId,
    setBoxDestinationId,
    relatedPersonName,
    setRelatedPersonName,
    debtId,
    setDebtId,
    recurringRuleId,
    setRecurringRuleId,
    adjustmentReason,
    setAdjustmentReason,
    accounts,
    boxes,
    recurringRules,
    relevantDebts,
    error,
    duplicateWarning,
    setDuplicateWarning,
    submitting,
    handleSubmit,
  };
}

export type MovementFormState = ReturnType<typeof useMovementForm>;
