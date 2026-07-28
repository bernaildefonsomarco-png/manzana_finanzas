"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  Edit3,
  Eye,
  EyeOff,
  Mail,
  MessageCircle,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { useDiscreetMode } from "@/shared/privacy/discreet-mode-context";
import { ApiClientError } from "@/features/movements/movements-api";
import { categoryLabels } from "@/features/movements/movement-view-model";
import { Button } from "@/ui/primitivas/button";
import { cn } from "@/ui/primitivas/cn";
import { FieldShell, Input, Select } from "@/ui/primitivas/field";
import { MoneyText } from "@/ui/primitivas/money";
import { EmptyState, ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import type {
  Account,
  CategoryId,
  Debt,
  PendingItem,
  PendingSource,
} from "@/shared/types/domain";
import {
  batchConfirmPendingItems,
  batchDiscardPendingItems,
  confirmPendingItem,
  discardPendingItem,
  listPendingAccounts,
  listPendingDebts,
  listPendingItems,
  listPendingRecurring,
  updatePendingItem,
  type PendingActionPatch,
  type PendingRecurringOption,
} from "./pending-api";
import { toPendingViewItem, type PendingViewItem } from "./pending-view-model";

const categoryOptions = Object.entries(categoryLabels) as Array<
  [CategoryId, string]
>;

type PendingScreenProps = {
  onSignOut?: () => void;
  onNavigate?: (view: AppView) => void;
};

type LoadState = "loading" | "ready" | "error";

export function PendingScreen({ onSignOut, onNavigate }: PendingScreenProps) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const { discreet, setDiscreet } = useDiscreetMode();
  const [editingItem, setEditingItem] = useState<PendingItem | null>(null);
  const [editingSaving, setEditingSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [recurringRules, setRecurringRules] = useState<
    PendingRecurringOption[]
  >([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(() => new Set());
  const [batchSaving, setBatchSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const viewItems = useMemo(() => items.map(toPendingViewItem), [items]);
  const readyItems = viewItems.filter((item) => !item.needsCompletion);
  const selectedReadyItems = readyItems.filter((item) =>
    selectedIds.has(item.id),
  );
  const selectedItems = viewItems.filter((item) => selectedIds.has(item.id));

  useEffect(() => {
    let active = true;

    async function load() {
      setLoadState("loading");

      try {
        const [nextItems, nextAccounts, nextDebts, nextRecurring] =
          await Promise.all([
            listPendingItems(),
            listPendingAccounts().catch(() => []),
            listPendingDebts().catch(() => []),
            listPendingRecurring().catch(() => []),
          ]);
        if (!active) return;
        setItems(nextItems);
        setAccounts(nextAccounts);
        setDebts(nextDebts);
        setRecurringRules(nextRecurring);
        setSelectedIds(new Set());
        setLoadState("ready");
      } catch {
        if (!active) return;
        setLoadState("error");
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  async function reloadPending() {
    setFeedback(null);
    setLoadState("loading");

    try {
      const nextItems = await listPendingItems();
      setItems(nextItems);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setFeedback(toActionErrorMessage(error));
    }
  }

  async function resolveItem(
    id: string,
    action: "confirmed" | "discarded" | "already_registered",
    confirmDuplicate = false
  ) {
    setItemProcessing(id, true);
    setFeedback(null);

    try {
      if (action === "confirmed") {
        await confirmPendingItem(id, { confirmDuplicate });
      } else {
        await discardPendingItem(
          id,
          action === "already_registered"
            ? "already_registered_elsewhere"
            : "dashboard_pending_discard",
        );
      }

      setItems((current) => current.filter((item) => item.id !== id));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      clearDuplicateWarning(id);
      setFeedback(
        action === "confirmed"
          ? "Pendiente confirmado. Ahora ya vive como movimiento registrado."
          : action === "already_registered"
            ? "Marcado como ya registrado. No se creó un movimiento duplicado."
            : "Pendiente descartado. Conservamos la trazabilidad minima sin afectar tus saldos."
      );
    } catch (error) {
      if (isDuplicateConfirmationError(error)) {
        setDuplicateWarnings((current) => new Set(current).add(id));
        setFeedback(
          "Encontré un movimiento parecido. Revísalo y confirma de nuevo solo si realmente son dos movimientos distintos."
        );
      } else {
        setFeedback(toActionErrorMessage(error));
      }
    } finally {
      setItemProcessing(id, false);
    }
  }

  async function resolveBatch() {
    const readyIds = selectedReadyItems.map((item) => item.id);
    if (readyIds.length === 0) return;

    setBatchSaving(true);
    setFeedback(null);

    let result;
    try {
      result = await batchConfirmPendingItems(readyIds);
    } catch (error) {
      setFeedback(toActionErrorMessage(error));
      setBatchSaving(false);
      return;
    }
    const confirmedIds = result.results
      .filter((item) => item.status === "confirmed")
      .map((item) => item.pending_item_id);
    const duplicateIds = result.results
      .filter((item) => item.requires_duplicate_confirmation)
      .map((item) => item.pending_item_id);
    if (duplicateIds.length > 0) {
      setDuplicateWarnings((current) => {
        const next = new Set(current);
        for (const id of duplicateIds) next.add(id);
        return next;
      });
    }

    if (confirmedIds.length > 0) {
      const confirmed = new Set(confirmedIds);
      setItems((current) => current.filter((item) => !confirmed.has(item.id)));
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of confirmed) next.delete(id);
        return next;
      });
    }

    setFeedback(
      confirmedIds.length === readyIds.length
        ? `${confirmedIds.length} pendientes confirmados. Los incompletos quedan separados para revisar.`
        : `${confirmedIds.length} de ${readyIds.length} pendientes se confirmaron. Los demás siguen por revisar.`
    );
    setBatchSaving(false);
  }

  async function discardSelectedBatch() {
    const ids = selectedItems.map((item) => item.id);
    if (ids.length === 0) return;
    setBatchSaving(true);
    setFeedback(null);
    try {
      const result = await batchDiscardPendingItems(ids);
      const discardedIds = result.results
        .filter((item) => item.status === "discarded")
        .map((item) => item.pending_item_id);
      const discarded = new Set(discardedIds);
      setItems((current) => current.filter((item) => !discarded.has(item.id)));
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of discarded) next.delete(id);
        return next;
      });
      setFeedback(
        result.failed === 0
          ? `${result.discarded} pendientes rechazados sin afectar tus saldos.`
          : `${result.discarded} de ${result.requested} pendientes se rechazaron; los demás siguen por revisar.`,
      );
    } catch (error) {
      setFeedback(toActionErrorMessage(error));
    } finally {
      setBatchSaving(false);
    }
  }

  async function updatePending(
    nextItem: PendingItem,
    actionPatch?: PendingActionPatch,
  ) {
    setEditingSaving(true);

    try {
      const updatedItem = await updatePendingItem(
        nextItem.id,
        nextItem.normalized_summary,
        actionPatch,
      );
      setItems((current) =>
        current.map((item) => (item.id === updatedItem.id ? updatedItem : item))
      );
      clearDuplicateWarning(updatedItem.id);
      setEditingItem(null);
      setFeedback("Pendiente actualizado. Ahora puedes confirmarlo con más seguridad.");
    } finally {
      setEditingSaving(false);
    }
  }

  function setItemProcessing(id: string, processing: boolean) {
    setProcessingIds((current) => {
      const next = new Set(current);
      if (processing) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function clearDuplicateWarning(id: string) {
    setDuplicateWarnings((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  return (
    <AppShell
      title="Pendientes"
      subtitle="Cosas detectadas que esperan tu aprobación."
      onSignOut={onSignOut}
      activeView="pending"
      onNavigate={onNavigate}
      hideDesktopHeader
    >
      <div id="pendientes" className="mx-auto min-h-screen max-w-[860px] pb-10 pt-8 lg:pt-14">
        <div className="mb-10 flex items-start justify-end gap-5 text-text-secondary lg:absolute lg:right-12 lg:top-6">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-bg-surface hover:text-text active:scale-[0.98]"
            aria-label="Buscar pendientes"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-bg-surface hover:text-text active:scale-[0.98]"
            aria-label={discreet ? "Desactivar modo discreto" : "Activar modo discreto"}
            onClick={() => void setDiscreet(!discreet)}
          >
            {discreet ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </button>
        </div>

        <header className="hidden gap-3 lg:flex lg:flex-col">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-semibold tracking-normal text-text">
              Pendientes
            </h1>
            {viewItems.length > 0 ? (
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-warning-subtle bg-warning-subtle px-3 text-sm font-medium text-text">
                <span className="h-2 w-2 rounded-full bg-warning" />
                {viewItems.length} por revisar
              </span>
            ) : null}
          </div>
          <p className="text-base text-text-secondary">
            Cosas que Manzana detectó, separadas hasta que tú las confirmes.
          </p>
        </header>

        <ProtectionBanner className="mt-8 lg:mt-10" />

        {feedback ? (
          <div className="mt-5 flex items-start gap-2 rounded-md border border-success-subtle bg-success-subtle/55 px-3 py-2 text-sm text-text-secondary">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>{feedback}</span>
            <button
              type="button"
              className="ml-auto text-text-muted hover:text-text"
              aria-label="Cerrar mensaje"
              onClick={() => setFeedback(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {loadState === "loading" ? (
          <LoadingBlock className="mt-8" label="Cargando pendientes" />
        ) : loadState === "error" ? (
          <ErrorState
            className="mt-8"
            title="No pude cargar tus pendientes"
            description="Tus saldos no cambian. Intenta recargar la bandeja en un momento."
            onRetry={reloadPending}
          />
        ) : viewItems.length > 0 ? (
          <div className="mt-8 space-y-6">
            {viewItems.length > 1 ? (
              <BatchReviewCard
                total={viewItems.length}
                ready={readyItems.length}
                selected={selectedItems.length}
                selectedReady={selectedReadyItems.length}
                loading={batchSaving}
                onConfirmReady={resolveBatch}
                onDiscardSelected={discardSelectedBatch}
                onSelectReady={() =>
                  setSelectedIds((current) => {
                    const allSelected = readyItems.every((item) =>
                      current.has(item.id),
                    );
                    const next = new Set(current);
                    for (const item of readyItems) {
                      if (allSelected) next.delete(item.id);
                      else next.add(item.id);
                    }
                    return next;
                  })
                }
              />
            ) : null}

            <section className="space-y-4">
              {viewItems.map((item) => (
                <PendingCard
                  key={item.id}
                  item={item}
                  discreet={discreet}
                  duplicateWarning={duplicateWarnings.has(item.id)}
                  selected={selectedIds.has(item.id)}
                  onToggleSelection={() =>
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })
                  }
                  onConfirm={() =>
                    resolveItem(
                      item.id,
                      "confirmed",
                      duplicateWarnings.has(item.id)
                    )
                  }
                  onEdit={() => {
                    const original = items.find((pending) => pending.id === item.id);
                    if (original) setEditingItem(original);
                  }}
                  onDiscard={() => resolveItem(item.id, "discarded")}
                  onAlreadyRegistered={() =>
                    resolveItem(item.id, "already_registered")
                  }
                  processing={processingIds.has(item.id)}
                />
              ))}
            </section>

            <p className="flex items-center justify-center gap-2 pt-4 text-xs text-text-muted">
              <Sparkles className="h-3.5 w-3.5" />
              Detección asistida por IA, confirmación controlada por ti.
            </p>
          </div>
        ) : (
          <EmptyState
            className="mt-8 border-dashed bg-bg-surface-raised/85"
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No tienes nada por revisar"
            description="Cuando Manzana detecte algo que necesite tu confirmación, aparecerá aquí antes de tocar saldos."
            action={
              <Button variant="secondary" onClick={() => onNavigate?.("movements")}>
                Ver movimientos
              </Button>
            }
          />
        )}
      </div>

      {editingItem ? (
        <PendingEditModal
          item={editingItem}
          accounts={accounts}
          debts={debts}
          recurringRules={recurringRules}
          onClose={() => setEditingItem(null)}
          onSave={updatePending}
          saving={editingSaving}
        />
      ) : null}
    </AppShell>
  );
}

function ProtectionBanner({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "rounded-xl border border-brand/15 bg-bg-surface-raised px-4 py-4 shadow-xs",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold tracking-normal text-text">
            Tranquilidad asegurada
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Nada pendiente afecta tu saldo, cajas, deudas o reportes hasta que
            confirmes, edites o descartes.
          </p>
        </div>
      </div>
    </section>
  );
}

function BatchReviewCard({
  total,
  ready,
  selected,
  selectedReady,
  loading,
  onConfirmReady,
  onDiscardSelected,
  onSelectReady,
}: {
  total: number;
  ready: number;
  selected: number;
  selectedReady: number;
  loading: boolean;
  onConfirmReady: () => void;
  onDiscardSelected: () => void;
  onSelectReady: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-surface p-5 shadow-xs">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-subtle px-3 py-1 text-xs font-medium text-text-brand">
            <CheckCheck className="h-3.5 w-3.5" />
            Revisión en grupo
          </p>
          <h2 className="mt-3 font-heading text-xl font-semibold tracking-normal text-text">
            Tienes {total} pendientes por revisar
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {ready} están completos para confirmar. Los demás quedan aparte para
            corregirlos sin prisa.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <span className="text-xs text-text-muted">
            {selected} seleccionados
          </span>
          <Button
            variant="secondary"
            disabled={ready === 0 || loading}
            onClick={onSelectReady}
          >
            {selected === ready && ready > 0
              ? "Quitar selección"
              : "Seleccionar completos"}
          </Button>
          <Button
            variant="quiet"
            icon={<CheckCheck className="h-4 w-4" />}
            disabled={selectedReady === 0}
            loading={loading}
            onClick={onConfirmReady}
          >
            Confirmar seleccionados ({selectedReady})
          </Button>
          <Button
            variant="ghost"
            icon={<Trash2 className="h-4 w-4" />}
            disabled={selected === 0}
            loading={loading}
            onClick={onDiscardSelected}
          >
            Rechazar seleccionados
          </Button>
        </div>
      </div>
    </section>
  );
}

function PendingCard({
  item,
  discreet,
  processing,
  duplicateWarning,
  selected,
  onToggleSelection,
  onConfirm,
  onEdit,
  onDiscard,
  onAlreadyRegistered,
}: {
  item: PendingViewItem;
  discreet: boolean;
  processing: boolean;
  duplicateWarning: boolean;
  selected: boolean;
  onToggleSelection: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  onAlreadyRegistered: () => void;
}) {
  const visual = getSourceVisual(item.source);

  return (
    <article
      className={cn(
        "rounded-xl border bg-bg-surface-raised p-5 shadow-xs transition hover:shadow-sm",
        item.needsCompletion ? "border-warning-subtle" : "border-border hover:border-border-strong"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelection}
            aria-label={`Seleccionar ${item.title}`}
            className="h-4 w-4 rounded border-border accent-brand"
          />
          <div className={cn("inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium", visual.badge)}>
            {visual.icon}
            {item.sourceLabel}
          </div>
        </div>
        <span className="text-xs text-text-muted">{item.ageLabel}</span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-5">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-lg font-semibold tracking-normal text-text">
            {item.title}
          </h3>
          <p className="mt-1 truncate text-sm text-text-secondary">{item.subtitle}</p>
        </div>
        <div className="shrink-0 text-right">
          {item.amount !== null ? (
            <MoneyText
              value={item.amount}
              sign={item.moneySign}
              discrete={discreet}
              className="font-heading text-xl font-semibold text-text"
            />
          ) : (
            <span className="text-sm font-medium text-warning">Monto por revisar</span>
          )}
          <p className="mt-1 text-xs text-text-muted">{item.confidenceLabel}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-bg-surface px-2.5 py-1 text-text-secondary">
          {item.typeLabel}
        </span>
        <span className={cn("rounded-full px-2.5 py-1", item.needsCompletion ? "bg-warning-subtle text-text" : "bg-success-subtle text-success")}>
          {item.reasonLabel}
        </span>
        <span className="rounded-full bg-bg-surface px-2.5 py-1 text-text-secondary">
          {item.riskLabel}
        </span>
      </div>

      {duplicateWarning ? (
        <div className="mt-5 flex items-start gap-3 rounded-md border border-warning/35 bg-warning-subtle px-3 py-3 text-sm text-text-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            Ya existe un movimiento muy parecido. Confirma otra vez solo si son
            dos operaciones distintas.
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
        <Button
          variant={item.needsCompletion ? "secondary" : "primary"}
          icon={item.needsCompletion ? <Edit3 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          loading={processing && !item.needsCompletion}
          disabled={processing}
          onClick={item.needsCompletion ? onEdit : onConfirm}
        >
          {item.needsCompletion
            ? "Completar"
            : duplicateWarning
              ? "Confirmar de todos modos"
              : "Confirmar"}
        </Button>
        <Button
          variant="secondary"
          icon={<Edit3 className="h-4 w-4" />}
          disabled={processing}
          onClick={onEdit}
        >
          Editar
        </Button>
        <Button
          className="sm:ml-auto"
          variant="ghost"
          icon={<Trash2 className="h-4 w-4" />}
          loading={processing && item.needsCompletion}
          disabled={processing}
          onClick={onDiscard}
        >
          Rechazar
        </Button>
        {item.source === "email_pending" ||
        item.source === "backfill_pending" ? (
          <Button
            variant="ghost"
            disabled={processing}
            onClick={onAlreadyRegistered}
          >
            Ya lo registré
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function PendingEditModal({
  item,
  accounts,
  debts,
  recurringRules,
  onClose,
  onSave,
  saving,
}: {
  item: PendingItem;
  accounts: Account[];
  debts: Debt[];
  recurringRules: PendingRecurringOption[];
  onClose: () => void;
  onSave: (
    item: PendingItem,
    actionPatch?: PendingActionPatch,
  ) => Promise<void>;
  saving: boolean;
}) {
  const reviewMode = getPendingReviewMode(item);
  const movementInput = getProposedMovementInput(item);
  const [title, setTitle] = useState(item.normalized_summary.title ?? "");
  const [amount, setAmount] = useState(
    typeof item.normalized_summary.amount === "number"
      ? String(item.normalized_summary.amount)
      : ""
  );
  const [currency, setCurrency] = useState<"PEN" | "USD">(
    item.normalized_summary.currency ?? "PEN",
  );
  const [occurredAt, setOccurredAt] = useState(
    toDatetimeLocalValue(item.normalized_summary.occurred_at),
  );
  const [categoryId, setCategoryId] = useState<CategoryId>(
    item.normalized_summary.category_id ?? "otros"
  );
  const [accountId, setAccountId] = useState(
    readOptionalString(item.proposed_action.account_id) ??
      readOptionalString(movementInput.account_origin_id) ??
      "",
  );
  const [originAccountId, setOriginAccountId] = useState(
    readOptionalString(item.proposed_action.account_origin_id) ??
      readOptionalString(movementInput.account_origin_id) ??
      "",
  );
  const [destinationAccountId, setDestinationAccountId] = useState(
    readOptionalString(item.proposed_action.account_destination_id) ??
      readOptionalString(movementInput.account_destination_id) ??
      "",
  );
  const [debtId, setDebtId] = useState(
    readOptionalString(item.proposed_action.debt_id) ?? "",
  );
  const [recurringTarget, setRecurringTarget] = useState(() => {
    const ruleId = readOptionalString(item.proposed_action.recurring_rule_id);
    const occurrenceId = readOptionalString(
      item.proposed_action.recurring_occurrence_id,
    );
    return ruleId && occurrenceId ? `${ruleId}:${occurrenceId}` : "";
  });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsedAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("El monto debe ser mayor a cero.");
      return;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Agrega un nombre para reconocer este pendiente.");
      return;
    }
    const parsedOccurredAt = new Date(occurredAt);
    if (!occurredAt || Number.isNaN(parsedOccurredAt.getTime())) {
      setError("Selecciona una fecha y hora válidas.");
      return;
    }

    let actionPatch: PendingActionPatch | undefined;
    if (reviewMode === "transfer") {
      if (
        !originAccountId ||
        !destinationAccountId ||
        originAccountId === destinationAccountId
      ) {
        setError("Selecciona dos cuentas distintas para la transferencia.");
        return;
      }
      actionPatch = {
        action: "record_transfer",
        account_origin_id: originAccountId,
        account_destination_id: destinationAccountId,
      };
    } else if (reviewMode === "debt") {
      if (!debtId) {
        setError("Selecciona la deuda que corresponde a este pago.");
        return;
      }
      actionPatch = {
        action: "record_debt_payment",
        debt_id: debtId,
        account_id: accountId || null,
      };
    } else if (reviewMode === "recurring") {
      const [ruleId, occurrenceId] = recurringTarget.split(":");
      if (!ruleId || !occurrenceId) {
        setError("Selecciona el pago recurrente y su ocurrencia.");
        return;
      }
      actionPatch = {
        action: "record_recurring_payment",
        recurring_rule_id: ruleId,
        recurring_occurrence_id: occurrenceId,
        account_id: accountId || null,
      };
    } else if (reviewMode === "unsupported") {
      setError(
        "Esta sugerencia especializada todavía no tiene datos suficientes. Puedes rechazarla o marcarla como ya registrada.",
      );
      return;
    }

    try {
      await onSave(
        {
          ...item,
          normalized_summary: {
            ...item.normalized_summary,
            title: cleanTitle,
            amount: Math.round(parsedAmount * 100) / 100,
            currency,
            occurred_at: parsedOccurredAt.toISOString(),
            category_id:
              reviewMode === "movement" ? categoryId : null,
          },
          status: "user_edited",
          updated_at: new Date().toISOString(),
        },
        actionPatch,
      );
    } catch (saveError) {
      setError(toActionErrorMessage(saveError));
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-bg-inverse/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-edit-title"
        className="w-full max-w-lg rounded-2xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
          <div>
            <p className="text-xs font-medium text-text-muted">Revisión pendiente</p>
            <h2
              id="pending-edit-title"
              className="font-heading text-lg font-semibold tracking-normal text-text"
            >
              Completar antes de confirmar
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            icon={<X className="h-4 w-4" />}
            onClick={onClose}
          >
            Cerrar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
          <FieldShell label="Nombre" htmlFor="pending-title">
            <Input
              id="pending-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Netflix"
            />
          </FieldShell>
          <FieldShell label="Monto" htmlFor="pending-amount">
            <Input
              id="pending-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="45.00"
            />
          </FieldShell>
          <FieldShell label="Moneda" htmlFor="pending-currency">
            <Select
              id="pending-currency"
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value as "PEN" | "USD")
              }
            >
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </Select>
          </FieldShell>
          <FieldShell label="Fecha y hora" htmlFor="pending-occurred-at">
            <Input
              id="pending-occurred-at"
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          </FieldShell>
          {reviewMode === "movement" ? (
            <FieldShell label="Categoria" htmlFor="pending-category">
              <Select
                id="pending-category"
                value={categoryId}
                onChange={(event) =>
                  setCategoryId(event.target.value as CategoryId)
                }
              >
                {categoryOptions.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </FieldShell>
          ) : null}

          {reviewMode === "transfer" ? (
            <>
              <AccountSelect
                id="pending-origin-account"
                label="Cuenta de origen"
                value={originAccountId}
                accounts={accounts}
                onChange={setOriginAccountId}
              />
              <AccountSelect
                id="pending-destination-account"
                label="Cuenta de destino"
                value={destinationAccountId}
                accounts={accounts}
                onChange={setDestinationAccountId}
              />
            </>
          ) : null}

          {reviewMode === "debt" ? (
            <>
              <FieldShell label="Deuda" htmlFor="pending-debt">
                <Select
                  id="pending-debt"
                  value={debtId}
                  onChange={(event) => setDebtId(event.target.value)}
                >
                  <option value="">Selecciona una deuda</option>
                  {debts.map((debt) => (
                    <option key={debt.id} value={debt.id}>
                      {debt.name} · {debt.currency} {debt.current_balance}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <AccountSelect
                id="pending-debt-account"
                label="Cuenta (opcional)"
                value={accountId}
                accounts={accounts}
                onChange={setAccountId}
                optional
              />
            </>
          ) : null}

          {reviewMode === "recurring" ? (
            <>
              <FieldShell
                label="Pago recurrente"
                htmlFor="pending-recurring"
              >
                <Select
                  id="pending-recurring"
                  value={recurringTarget}
                  onChange={(event) => setRecurringTarget(event.target.value)}
                >
                  <option value="">Selecciona una ocurrencia</option>
                  {recurringRules.flatMap((rule) =>
                    rule.occurrences
                      .filter((occurrence) =>
                        [
                          "expected",
                          "due_soon",
                          "pending_confirmation",
                          "overdue",
                        ].includes(occurrence.status),
                      )
                      .map((occurrence) => (
                        <option
                          key={occurrence.id}
                          value={`${rule.id}:${occurrence.id}`}
                        >
                          {rule.name} · {occurrence.expected_date}
                        </option>
                      )),
                  )}
                </Select>
              </FieldShell>
              <AccountSelect
                id="pending-recurring-account"
                label="Cuenta (opcional)"
                value={accountId}
                accounts={accounts}
                onChange={setAccountId}
                optional
              />
            </>
          ) : null}

          {error ? (
            <p className="rounded-md border border-error-subtle bg-error-subtle px-3 py-2 text-sm text-error">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Guardar revisión
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AccountSelect({
  id,
  label,
  value,
  accounts,
  onChange,
  optional = false,
}: {
  id: string;
  label: string;
  value: string;
  accounts: Account[];
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <FieldShell label={label} htmlFor={id}>
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {optional ? "Sin cuenta" : "Selecciona una cuenta"}
        </option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} · {account.currency}
          </option>
        ))}
      </Select>
    </FieldShell>
  );
}

function getPendingReviewMode(
  item: PendingItem,
): "movement" | "transfer" | "debt" | "recurring" | "unsupported" {
  const action = readOptionalString(item.proposed_action.action);
  if (action === "record_transfer") return "transfer";
  if (action === "record_debt_payment") return "debt";
  if (action === "record_recurring_payment") return "recurring";
  if (action !== "review_specialized") return "movement";

  const suggestedType = readOptionalString(
    item.metadata.suggested_movement_type,
  );
  if (suggestedType === "transferencia") return "transfer";
  if (
    suggestedType === "pago_deuda" ||
    suggestedType === "devolucion_recibida"
  ) {
    return "debt";
  }
  if (suggestedType === "pago_recurrente") return "recurring";
  return "unsupported";
}

function getProposedMovementInput(
  item: PendingItem,
): Record<string, unknown> {
  const value = item.proposed_action.movement_input;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toDatetimeLocalValue(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getSourceVisual(source: PendingSource) {
  if (source === "email_pending") {
    return {
      badge: "bg-info-subtle text-blue-900",
      icon: <Mail className="h-3.5 w-3.5" />,
    };
  }

  if (source === "ambiguous_movement") {
    return {
      badge: "bg-success-subtle text-success",
      icon: <MessageCircle className="h-3.5 w-3.5" />,
    };
  }

  if (source === "recurring_candidate") {
    return {
      badge: "bg-brand-subtle text-text-brand",
      icon: <Sparkles className="h-3.5 w-3.5" />,
    };
  }

  return {
    badge: "bg-warning-subtle text-text",
    icon: <ReceiptText className="h-3.5 w-3.5" />,
  };
}

function toActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "No pude completar la acción. Intenta otra vez en un momento.";
}

function isDuplicateConfirmationError(error: unknown): boolean {
  return Boolean(
    error instanceof ApiClientError &&
      error.status === 409 &&
      error.details.reason === "cross_channel_duplicate" &&
      error.details.requires_confirmation === true
  );
}
