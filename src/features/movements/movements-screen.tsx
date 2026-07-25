"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronRight,
  Coffee,
  Eye,
  EyeOff,
  FileText,
  HandCoins,
  Info,
  Link2,
  Plus,
  Search,
  SlidersHorizontal,
  ShoppingCart,
  Tag,
  Trash2,
  Utensils,
  WalletCards,
  X,
  CheckCircle2,
  Pencil,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { useDiscreetMode } from "@/shared/privacy/discreet-mode-context";
import { Button } from "@/shared/ui/button";
import { Input, Select } from "@/shared/ui/field";
import { MoneyText } from "@/shared/ui/money";
import { EmptyState, ErrorState, LoadingBlock } from "@/shared/ui/states";
import { cn } from "@/shared/ui/cn";
import type { CategoryId, Movement, MovementType } from "@/shared/types/domain";
import type { ClassificationCatalog } from "@/data/repositories/classification.repository";
import {
  categoryLabels,
  getMovementGroupLabel,
  isIncomeType,
  isTransferType,
  movementMatchesSearchQuery,
  movementTypeLabels,
  toMovementViewItem,
  type MovementViewItem,
} from "./movement-view-model";
import {
  ApiClientError,
  createMovement,
  deleteMovement,
  listMovements,
  restoreMovement,
  updateMovement,
  type CreateMovementPayload,
  type UpdateMovementPayload,
} from "./movements-api";
import {
  createRelatedPerson,
  createSubcategory,
  createTag,
  getClassificationCatalog,
} from "./classification-api";

const primaryMovementTypes: MovementType[] = ["gasto", "ingreso", "pago_deuda"];

const secondaryMovementTypes: MovementType[] = [
  "prestamo_dado",
  "prestamo_recibido",
  "devolucion_recibida",
  "deuda_adquirida",
  "pago_recurrente",
  "transferencia",
  "asignacion_interna",
  "ajuste",
];

const categoryOptions = Object.entries(categoryLabels) as Array<
  [CategoryId, string]
>;

const defaultCategoryByType: Partial<Record<MovementType, CategoryId | null>> = {
  gasto: "otros",
  ingreso: "otros",
  transferencia: null,
  asignacion_interna: null,
  prestamo_dado: "deudas",
  prestamo_recibido: "deudas",
  devolucion_recibida: "deudas",
  deuda_adquirida: "deudas",
  pago_deuda: "deudas",
  pago_recurrente: "servicios_suscripciones",
  ajuste: "otros",
};

type LoadState = "idle" | "loading" | "loaded" | "error";

type UiError = {
  title: string;
  message: string;
};

export function MovementsScreen({
  initialQuery = "",
  openNewOnMount = false,
  onNewIntentConsumed,
  onSignOut,
  onNavigate,
}: {
  initialQuery?: string;
  openNewOnMount?: boolean;
  onNewIntentConsumed?: () => void;
  onSignOut?: () => void;
  onNavigate?: (view: AppView) => void;
}) {
  const [isNewOpen, setIsNewOpen] = useState(openNewOnMount);
  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState<MovementType | "todos">("todos");
  const { discreet, setDiscreet } = useDiscreetMode();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [uiError, setUiError] = useState<UiError | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [deletedMovement, setDeletedMovement] = useState<Movement | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const movementItems = useMemo(
    () => movements.map(toMovementViewItem),
    [movements]
  );

  const reloadMovements = useCallback(async () => {
    setLoadState("loading");
    setUiError(null);

    try {
      const nextMovements = await listMovements();
      setMovements(nextMovements);
      setLoadState("loaded");
    } catch (error) {
      setLoadState("error");
      setUiError(toUiError(error));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialMovements() {
      try {
        const nextMovements = await listMovements();
        if (cancelled) return;
        setMovements(nextMovements);
        setLoadState("loaded");
      } catch (error) {
        if (cancelled) return;
        setLoadState("error");
        setUiError(toUiError(error));
      }
    }

    void loadInitialMovements();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return movementItems.filter((movement) => {
      const matchesType = typeFilter === "todos" || movement.type === typeFilter;
      const matchesQuery = movementMatchesSearchQuery(movement, query);
      return matchesType && matchesQuery;
    });
  }, [movementItems, query, typeFilter]);

  const groupedMovements = useMemo(() => groupMovements(filtered), [filtered]);

  async function handleCreateMovement(
    payload: CreateMovementPayload,
    options: { confirmDuplicate?: boolean } = {},
  ) {
    await createMovement(payload, options);
    await reloadMovements();
  }

  function closeNewMovement() {
    setIsNewOpen(false);
    onNewIntentConsumed?.();
  }

  async function handleUpdateMovement(
    movementId: string,
    patch: UpdateMovementPayload,
  ) {
    const saved = await updateMovement(
      movementId,
      patch,
      "Corrección confirmada desde el detalle del Dashboard",
    );
    setMovements((current) =>
      current.map((movement) => (movement.id === saved.id ? saved : movement)),
    );
    setSelectedMovement(saved);
    setActionMessage("Movimiento corregido por Core. El historial quedó auditado.");
  }

  async function handleDeleteMovement(movement: Movement) {
    const deleted = await deleteMovement(
      movement.id,
      "Eliminación confirmada desde el detalle del Dashboard",
    );
    setMovements((current) =>
      current.filter((candidate) => candidate.id !== movement.id),
    );
    setSelectedMovement(null);
    setDeletedMovement(deleted);
    setActionMessage(
      "Movimiento eliminado. Su efecto financiero fue revertido y puedes deshacer esta acción.",
    );
  }

  async function handleRestoreMovement() {
    if (!deletedMovement || restoring) return;
    setRestoring(true);
    try {
      const restored = await restoreMovement(
        deletedMovement.id,
        "Deshacer eliminación desde el Dashboard",
      );
      setMovements((current) =>
        [...current.filter((item) => item.id !== restored.id), restored].sort(
          (left, right) => right.occurred_at.localeCompare(left.occurred_at),
        ),
      );
      setDeletedMovement(null);
      setActionMessage(
        "Movimiento restaurado por Core. El saldo y la auditoría fueron recompuestos.",
      );
    } catch (error) {
      setUiError(toUiError(error));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <AppShell
      title="Movimientos"
      subtitle="Tus registros recientes de ingresos y gastos."
      onSignOut={onSignOut}
      activeView="movements"
      onNavigate={onNavigate}
      hideDesktopHeader
      primaryAction={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setIsNewOpen(true)}>
          Nuevo movimiento
        </Button>
      }
      mobilePrimaryAction={
        <Button
          size="icon"
          aria-label="Nuevo movimiento"
          icon={<Plus className="h-5 w-5" />}
          onClick={() => setIsNewOpen(true)}
          className="h-12 w-12 rounded-full shadow-lg"
        >
          Nuevo movimiento
        </Button>
      }
    >
      <div id="movimientos" className="mx-auto min-h-screen max-w-[920px] pb-10 pt-8 lg:pt-14">
        <div className="mb-10 flex items-start justify-end gap-5 text-text-secondary lg:absolute lg:right-12 lg:top-6">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-bg-surface hover:text-text active:scale-[0.98]"
            aria-label="Buscar movimientos"
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

        <header className="hidden w-full flex-col gap-5 lg:flex lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-normal text-text">
              Movimientos
            </h1>
            <p className="mt-2 text-base text-text-secondary">
              Tus registros recientes de ingresos y gastos.
            </p>
          </div>
          <div>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setIsNewOpen(true)}
            >
              Nuevo movimiento
            </Button>
          </div>
        </header>

        <div className="no-scrollbar mt-8 flex gap-3 overflow-x-auto pb-1">
          <FilterChip active label="Esta semana" onClear={() => {}} />
          <FilterChip
            active={typeFilter === "gasto"}
            label={typeFilter === "todos" ? "Gastos" : currentFilterLabel(typeFilter)}
            onClick={() => setTypeFilter((value) => (value === "gasto" ? "todos" : "gasto"))}
            onClear={() => setTypeFilter("todos")}
          />
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border-strong bg-bg-surface-raised px-4 text-sm font-medium text-text transition hover:bg-bg-surface active:scale-[0.98]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Más filtros
          </button>
        </div>

        {query ? (
          <div className="mt-5 max-w-md">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por comercio o categoría"
            />
          </div>
        ) : null}

        {discreet ? (
          <div className="mt-6 flex items-start gap-2 rounded-md border border-brand-subtle bg-brand-subtle/55 px-3 py-2 text-sm text-text-secondary">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-text-brand" />
            <span>Modo discreto activo. Ocultamos montos visibles sin cambiar el historial.</span>
          </div>
        ) : null}

        {actionMessage ? (
          <div
            role="status"
            className="mt-5 flex flex-col gap-3 rounded-lg border border-brand-subtle bg-brand-subtle/45 px-4 py-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{actionMessage}</span>
            <div className="flex items-center gap-2">
              {deletedMovement ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={restoring}
                  icon={<RotateCcw className="h-4 w-4" />}
                  onClick={() => void handleRestoreMovement()}
                >
                  Deshacer eliminación
                </Button>
              ) : null}
              <button
                type="button"
                className="rounded p-1 text-text-muted hover:text-text"
                aria-label="Cerrar mensaje"
                onClick={() => setActionMessage(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-9">
          {loadState === "loading" || loadState === "idle" ? (
            <LoadingBlock label="Cargando movimientos" />
          ) : uiError ? (
            <ErrorState
              title={uiError.title}
              description={uiError.message}
              onRetry={() => void reloadMovements()}
            />
          ) : groupedMovements.length > 0 ? (
            <div className="space-y-12">
              {groupedMovements.map((group) => (
                <section key={group.label}>
                  <h2 className="mb-7 font-heading text-lg font-medium tracking-normal text-text">
                    {group.label}
                  </h2>
                  <div className="space-y-4">
                    {group.items.map((movement) => (
                      <MovementRow
                        key={movement.id}
                        movement={movement}
                        discreet={discreet}
                        onOpen={() => {
                          const raw = movements.find(
                            (candidate) => candidate.id === movement.id,
                          );
                          if (raw) setSelectedMovement(raw);
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}
              <div className="flex justify-center pt-2">
                <button className="text-sm font-medium text-text-brand hover:text-brand-hover">
                  Ver más movimientos
                </button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="Aún no hay movimientos"
              description="Registra uno desde el dashboard o escribe por WhatsApp. Cuando exista, aparecerá aquí con fuente y posibilidad de corrección."
            />
          )}
        </div>
      </div>

      {isNewOpen ? (
        <NewMovementModal
          onClose={closeNewMovement}
          onCreate={handleCreateMovement}
          onOpenSpecialized={(view) => {
            closeNewMovement();
            onNavigate?.(view);
          }}
        />
      ) : null}

      {selectedMovement ? (
        <MovementDetailModal
          movement={selectedMovement}
          onClose={() => setSelectedMovement(null)}
          onUpdate={handleUpdateMovement}
          onDelete={handleDeleteMovement}
        />
      ) : null}
    </AppShell>
  );
}

function MovementRow({
  movement,
  discreet,
  onOpen,
}: {
  movement: MovementViewItem;
  discreet: boolean;
  onOpen: () => void;
}) {
  const isIncome = isIncomeType(movement.type);
  const isTransfer = isTransferType(movement.type);
  const visual = getMovementVisual(movement);

  return (
    <article className="flex min-w-0 items-center gap-4 rounded-xl border border-border bg-bg-surface-raised px-4 py-4 shadow-xs transition hover:border-border-strong hover:shadow-sm sm:gap-5 sm:px-5">
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:h-14 sm:w-14", visual.bg, visual.fg)}>
        {visual.icon}
      </div>

      <div className="min-w-0">
        <h3 className="truncate font-heading text-base font-semibold tracking-normal text-text">
          {movement.title}
        </h3>
        <p className="mt-1 truncate text-sm text-text-secondary">
          {movement.categoryLabel}
        </p>
      </div>

      <div className="ml-auto shrink-0 text-right">
        <MoneyText
          value={movement.amount}
          sign={isIncome ? "positive" : isTransfer ? "none" : "negative"}
          discrete={discreet}
          className={cn(
            "font-heading text-base font-semibold",
            isIncome ? "text-success" : "text-text"
          )}
        />
        <p className="mt-2 text-xs text-text-secondary">{movement.timeLabel}</p>
      </div>
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-bg-surface hover:text-text"
        aria-label={`Ver detalle de ${movement.title}`}
        onClick={onOpen}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </article>
  );
}

function FilterChip({
  active,
  label,
  onClick,
  onClear,
}: {
  active?: boolean;
  label: string;
  onClick?: () => void;
  onClear?: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition active:scale-[0.98]",
        active
          ? "border-brand bg-brand text-text-inverse"
          : "border-border bg-bg-surface-raised text-text-secondary hover:bg-bg-surface"
      )}
      onClick={onClick}
    >
      {label}
      {onClear ? <X className="h-4 w-4" /> : null}
    </button>
  );
}

function groupMovements(items: MovementViewItem[]) {
  const groups = new Map<string, MovementViewItem[]>();

  for (const item of items) {
    const label = getMovementGroupLabel(item.occurredAt);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }

  return Array.from(groups, ([label, groupItems]) => ({
    label,
    items: groupItems,
  }));
}

function currentFilterLabel(type: MovementType | "todos") {
  if (type === "todos") return "Todos";
  return movementTypeLabels[type];
}

function getMovementVisual(movement: MovementViewItem) {
  if (isIncomeType(movement.type)) {
    return {
      bg: "bg-success-subtle",
      fg: "text-success",
      icon: <HandCoins className="h-5 w-5" />,
    };
  }

  if (isTransferType(movement.type)) {
    return {
      bg: "bg-info-subtle",
      fg: "text-blue-800",
      icon: <ArrowUpRight className="h-5 w-5" />,
    };
  }

  if (movement.categoryLabel === "Transporte") {
    return {
      bg: "bg-warning-subtle",
      fg: "text-warning",
      icon: <Car className="h-5 w-5" />,
    };
  }

  if (movement.categoryLabel === "Vivienda / Hogar" || movement.categoryLabel === "Compras personales") {
    return {
      bg: "bg-info-subtle",
      fg: "text-info",
      icon: <ShoppingCart className="h-5 w-5" />,
    };
  }

  if (movement.categoryLabel === "Alimentación") {
    return {
      bg: "bg-error-subtle",
      fg: "text-error",
      icon: movement.title.toLowerCase().includes("cafe") ? (
        <Coffee className="h-5 w-5" />
      ) : (
        <Utensils className="h-5 w-5" />
      ),
    };
  }

  return {
    bg: "bg-brand-subtle",
    fg: "text-brand",
    icon: <ArrowDownLeft className="h-5 w-5" />,
  };
}

function toUiError(error: unknown): UiError {
  if (error instanceof ApiClientError) {
    if (error.code === "AUTH_REQUIRED" || error.status === 401) {
      return {
        title: "Sesión requerida",
        message:
          "Necesitas iniciar sesión para ver tus movimientos reales. Vuelve a entrar y Manzana recargará tu historial.",
      };
    }

    return {
      title: "No pude cargar movimientos",
      message: error.message,
    };
  }

  return {
    title: "No pude cargar movimientos",
    message: "Intenta de nuevo en un momento.",
  };
}

function todayInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInputToIso(value: string): string {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date().toISOString();
  }

  return new Date(year, month - 1, day, 12, 0, 0).toISOString();
}

function MovementDetailModal({
  movement,
  onClose,
  onUpdate,
  onDelete,
}: {
  movement: Movement;
  onClose: () => void;
  onUpdate: (
    movementId: string,
    patch: UpdateMovementPayload,
  ) => Promise<void>;
  onDelete: (movement: Movement) => Promise<void>;
}) {
  const view = toMovementViewItem(movement);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [amount, setAmount] = useState(String(movement.amount));
  const [occurredAt, setOccurredAt] = useState(
    toLocalDateTimeInput(movement.occurred_at),
  );
  const [merchant, setMerchant] = useState(movement.merchant ?? "");
  const [description, setDescription] = useState(movement.description ?? "");
  const [categoryId, setCategoryId] = useState<CategoryId | "">(
    movement.category_id ?? "",
  );
  const [working, setWorking] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const usesSpecializedLedger = Boolean(
    movement.debt_id || movement.recurring_occurrence_id,
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !working) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, working]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Ingresa un monto mayor a cero.");
      return;
    }
    setWorking("save");
    setError(null);
    try {
      await onUpdate(movement.id, {
        amount: numericAmount,
        occurred_at: new Date(occurredAt).toISOString(),
        merchant: merchant.trim() || null,
        description: description.trim() || null,
        category_id: categoryId || null,
      });
      setEditing(false);
    } catch (nextError) {
      setError(toUiError(nextError).message);
    } finally {
      setWorking(null);
    }
  }

  async function handleDelete() {
    setWorking("delete");
    setError(null);
    try {
      await onDelete(movement);
    } catch (nextError) {
      setError(toUiError(nextError).message);
      setWorking(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="movement-detail-title"
    >
      <section className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-bg-surface-raised shadow-xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-muted">
              {view.typeLabel} · {view.sourceLabel}
            </p>
            <h2
              id="movement-detail-title"
              className="mt-1 truncate font-heading text-xl font-semibold text-text"
            >
              {view.title}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-md p-2 text-text-muted hover:bg-bg-surface hover:text-text"
            aria-label="Cerrar detalle"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {editing ? (
          <form className="space-y-4 px-5 py-5" onSubmit={handleSave}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-text">
                Monto
                <Input
                  className="mt-2"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-text">
                Fecha y hora
                <Input
                  className="mt-2"
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(event) => setOccurredAt(event.target.value)}
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-text">
              Comercio
              <Input
                className="mt-2"
                value={merchant}
                onChange={(event) => setMerchant(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-text">
              Descripción
              <Input
                className="mt-2"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-text">
              Categoría
              <Select
                className="mt-2"
                value={categoryId}
                onChange={(event) =>
                  setCategoryId(event.target.value as CategoryId | "")
                }
              >
                <option value="">Sin categoría</option>
                {categoryOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={working === "save"}
                icon={<CheckCircle2 className="h-4 w-4" />}
              >
                Guardar corrección
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5 px-5 py-5">
            <div className="rounded-xl border border-border bg-bg-primary p-4">
              <p className="text-xs text-text-muted">Monto confirmado</p>
              <MoneyText
                value={Number(movement.amount)}
                sign={
                  isIncomeType(movement.type)
                    ? "positive"
                    : isTransferType(movement.type)
                      ? "none"
                      : "negative"
                }
                className="mt-2 text-2xl font-semibold"
              />
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <DetailTerm label="Fecha" value={view.description} />
                <DetailTerm label="Categoría" value={view.categoryLabel} />
                <DetailTerm label="Cuenta" value={view.accountLabel} />
                <DetailTerm label="Estado" value={movementStatusLabel(movement.status)} />
                <DetailTerm label="Fuente" value={view.sourceLabel} />
                <DetailTerm
                  label="Referencia"
                  value={movement.source_ref ?? `M-${movement.id.slice(0, 8).toUpperCase()}`}
                />
              </dl>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-brand-subtle bg-brand-subtle/35 px-4 py-3 text-sm leading-6 text-text-secondary">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <p>
                Las correcciones recalculan saldos dentro del Core y conservan
                la versión anterior en auditoría. El modelo no escribe dinero.
              </p>
            </div>

            {usesSpecializedLedger ? (
              <div className="rounded-lg border border-warning-subtle bg-warning-subtle/45 px-4 py-3 text-sm leading-6 text-text-secondary">
                Este movimiento está vinculado a una deuda o pago recurrente.
                Corrígelo desde Deudas o Pagos que vienen para mantener ambos
                historiales consistentes.
              </div>
            ) : null}

            {confirmingDelete ? (
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
                <p className="text-sm font-semibold text-text">
                  ¿Eliminar este movimiento confirmado?
                </p>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  Core revertirá su efecto financiero. Después podrás deshacer
                  la eliminación sin perder la auditoría.
                </p>
                {error ? (
                  <p role="alert" className="mt-2 text-sm text-danger">
                    {error}
                  </p>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Conservar
                  </Button>
                  <Button
                    variant="danger"
                    loading={working === "delete"}
                    onClick={() => void handleDelete()}
                  >
                    Sí, eliminar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <Button
                  variant="secondary"
                  icon={<Pencil className="h-4 w-4" />}
                  disabled={usesSpecializedLedger}
                  onClick={() => setEditing(true)}
                >
                  Corregir
                </Button>
                <Button
                  variant="ghost"
                  icon={<Trash2 className="h-4 w-4" />}
                  disabled={usesSpecializedLedger}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Eliminar
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="mt-1 break-words font-medium text-text">{value}</dd>
    </div>
  );
}

function movementStatusLabel(status: Movement["status"]): string {
  return {
    confirmed: "Confirmado",
    needs_review: "Por revisar",
    corrected: "Corregido",
    deleted: "Eliminado",
    reversed: "Revertido",
  }[status];
}

function toLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function NewMovementModal({
  onClose,
  onCreate,
  onOpenSpecialized,
}: {
  onClose: () => void;
  onCreate: (
    payload: CreateMovementPayload,
    options?: { confirmDuplicate?: boolean },
  ) => Promise<void>;
  onOpenSpecialized: (view: AppView) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [movementType, setMovementType] = useState<MovementType>("gasto");
  const [amount, setAmount] = useState("");
  const [occurredDate, setOccurredDate] = useState(todayInputValue());
  const [categoryId, setCategoryId] = useState<CategoryId | "none">("otros");
  const [subcategoryId, setSubcategoryId] = useState<string>("none");
  const [relatedPersonId, setRelatedPersonId] = useState<string>("none");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<ClassificationCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [newSubcategory, setNewSubcategory] = useState("");
  const [newPerson, setNewPerson] = useState("");
  const [newTag, setNewTag] = useState("");
  const [creatingClassification, setCreatingClassification] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const config = movementFormConfig[movementType];
  const selectedPrimary = primaryMovementTypes.includes(movementType);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void getClassificationCatalog()
      .then((nextCatalog) => {
        if (active) setCatalog(nextCatalog);
      })
      .catch(() => {
        if (active) setFormError("No pude cargar tus clasificaciones. Puedes guardar sin ellas.");
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => { active = false; };
  }, []);

  const availableSubcategories = useMemo(
    () => catalog?.subcategories.filter((item) => item.category_id === categoryId) ?? [],
    [catalog, categoryId],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveMovement(false);
  }

  async function saveMovement(confirmDuplicate: boolean) {
    setFormError(null);
    if (!confirmDuplicate) setDuplicateWarning(null);

    if (!config.canSaveNow) {
      setFormError(config.blockedMessage ?? "Este tipo necesita datos adicionales antes de guardarse.");
      return;
    }

    const parsedAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError("El monto debe ser mayor a cero.");
      return;
    }

    const cleanDescription = description.trim();
    const safeDescription = cleanDescription || config.fallbackDescription;
    setSaving(true);

    try {
      await onCreate(
        {
          type: movementType,
          amount: Math.round(parsedAmount * 100) / 100,
          occurred_at: dateInputToIso(occurredDate),
          description: safeDescription,
          merchant: cleanDescription || null,
          category_id: categoryId === "none" ? null : categoryId,
          subcategory_id: subcategoryId === "none" ? null : subcategoryId,
          related_person_id: relatedPersonId === "none" ? null : relatedPersonId,
          tag_ids: selectedTagIds,
          requires_review: false,
        },
        { confirmDuplicate },
      );
      setSaved(true);
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.code === "CONFLICT" &&
        error.details.requires_confirmation === true
      ) {
        setDuplicateWarning(error.message);
        return;
      }
      setFormError(
        error instanceof ApiClientError
          ? error.message
          : "No pude guardar el movimiento. Inténtalo otra vez."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleTypeChange(type: MovementType) {
    setMovementType(type);
    const nextCategory = defaultCategoryByType[type];
    setCategoryId(nextCategory === null ? "none" : nextCategory ?? "otros");
    setSubcategoryId("none");
  }

  async function handleCreateSubcategory() {
    if (categoryId === "none" || newSubcategory.trim().length < 2) return;
    setCreatingClassification("subcategory");
    try {
      const created = await createSubcategory(categoryId, newSubcategory.trim());
      setCatalog((current) => current ? { ...current, subcategories: [...current.subcategories, created] } : current);
      setSubcategoryId(created.id);
      setNewSubcategory("");
    } catch (error) {
      setFormError(error instanceof ApiClientError ? error.message : "No pude crear la subcategoria.");
    } finally { setCreatingClassification(null); }
  }

  async function handleCreatePerson() {
    if (newPerson.trim().length < 2) return;
    setCreatingClassification("person");
    try {
      const created = await createRelatedPerson(newPerson.trim());
      setCatalog((current) => current ? { ...current, related_people: [created, ...current.related_people] } : current);
      setRelatedPersonId(created.id);
      setNewPerson("");
    } catch (error) {
      setFormError(error instanceof ApiClientError ? error.message : "No pude crear la persona.");
    } finally { setCreatingClassification(null); }
  }

  async function handleCreateTag() {
    if (newTag.trim().length < 2) return;
    setCreatingClassification("tag");
    try {
      const created = await createTag(newTag.trim());
      setCatalog((current) => current ? { ...current, tags: [...current.tags, created] } : current);
      setSelectedTagIds((current) => [...new Set([...current, created.id])]);
      setNewTag("");
    } catch (error) {
      setFormError(error instanceof ApiClientError ? error.message : "No pude crear la etiqueta.");
    } finally { setCreatingClassification(null); }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-bg-inverse/40 px-0 pt-14 backdrop-blur-[2px] sm:items-center sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-movement-title"
        aria-describedby="new-movement-description"
        className="flex max-h-[calc(100vh-1rem)] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-bg-surface-raised shadow-2xl sm:max-h-[calc(100vh-4rem)] sm:max-w-[560px] sm:rounded-xl"
        style={{ maxHeight: "calc(100vh - 1rem)" }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border/70 bg-bg-surface-raised/95 p-4 backdrop-blur sm:px-6 sm:py-4">
          <div>
            <p
              id="new-movement-description"
              className="text-xs font-medium text-text-muted"
            >
              Fuente: Dashboard
            </p>
            <h2
              id="new-movement-title"
              className="font-heading text-xl font-semibold tracking-normal text-text"
            >
              Nuevo movimiento
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

        {saved ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-success-subtle text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="mt-5 font-heading text-xl font-semibold tracking-normal text-text">
              Movimiento guardado
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">
              Quedó registrado por Dashboard con auditoría y origen claro.
            </p>
            <Button className="mt-6" onClick={onClose}>
              Volver a movimientos
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              <section aria-label="Tipo de movimiento">
                <div className="rounded-lg bg-bg-surface p-1">
                  <div className="grid grid-cols-3 gap-1">
                    {primaryMovementTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={cn(
                          "h-10 rounded-md px-2 text-center font-heading text-sm font-medium transition active:scale-[0.98]",
                          movementType === type
                            ? "bg-bg-surface-raised text-text shadow-xs"
                            : "text-text-secondary hover:text-text"
                        )}
                        onClick={() => handleTypeChange(type)}
                      >
                        {movementTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative mt-3">
                  <Select
                    aria-label="Otros tipos de movimiento"
                    value={selectedPrimary ? "" : movementType}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value) handleTypeChange(value as MovementType);
                    }}
                    className="h-11 appearance-none rounded-lg bg-bg-surface-raised pr-10 shadow-none"
                  >
                    <option value="">Otros tipos</option>
                    {secondaryMovementTypes.map((type) => (
                      <option key={type} value={type}>
                        {movementTypeLabels[type]}
                      </option>
                    ))}
                  </Select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                </div>
              </section>

              <section className="flex flex-col items-center rounded-xl bg-bg-primary px-4 py-4 text-center">
                <label
                  htmlFor="movement-amount"
                  className="text-sm text-text-secondary"
                >
                  {config.amountLabel}
                </label>
                <div className="mt-2 flex items-baseline justify-center gap-2">
                  <span className="font-heading text-3xl font-semibold text-text">
                    S/
                  </span>
                  <input
                    id="movement-amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-40 border-0 border-b-2 border-border bg-transparent p-0 text-center font-heading text-4xl font-semibold tracking-normal text-text shadow-none outline-none transition placeholder:text-border-strong focus:border-brand focus:ring-0"
                    required
                  />
                </div>

                <label className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-bg-surface-raised px-3 text-sm font-medium text-text-secondary transition focus-within:border-brand hover:border-border-strong">
                  <CalendarDays className="h-4 w-4 text-text-brand" />
                  <input
                    id="movement-date"
                    type="date"
                    value={occurredDate}
                    onChange={(event) => setOccurredDate(event.target.value)}
                    className="max-w-[136px] border-0 bg-transparent p-0 text-sm text-text outline-none focus:ring-0"
                  />
                </label>
              </section>

              <section
                className={cn(
                  "rounded-xl border p-3",
                  config.canSaveNow
                    ? "border-border bg-bg-surface"
                    : "border-warning-subtle bg-warning-subtle/70"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      config.canSaveNow
                        ? "bg-brand-subtle text-brand"
                        : "bg-bg-surface-raised text-warning"
                    )}
                  >
                    <Info className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-heading text-sm font-semibold tracking-normal text-text">
                      {config.impactTitle}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">
                      {config.impactBody}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <FieldCard
                  label="Cuenta"
                  htmlFor="movement-account"
                  icon={<WalletCards className="h-4 w-4" />}
                  hint="Puede quedar sin cuenta si no estás seguro."
                >
                  <Select
                    id="movement-account"
                    disabled
                    className="h-12 border-0 bg-transparent px-0 shadow-none focus:ring-0 disabled:opacity-100"
                  >
                    <option>Sin cuenta por ahora</option>
                  </Select>
                </FieldCard>

                {config.linkedField ? (
                  <FieldCard
                    label={config.linkedField.label}
                    htmlFor="movement-linked-entity"
                    icon={<Link2 className="h-4 w-4" />}
                    hint={config.linkedField.hint}
                  >
                    <Select
                      id="movement-linked-entity"
                      disabled
                      className="h-12 border-0 bg-transparent px-0 shadow-none focus:ring-0 disabled:opacity-100"
                    >
                      <option>{config.linkedField.value}</option>
                    </Select>
                  </FieldCard>
                ) : null}

                <FieldCard
                  label="Categoría"
                  htmlFor="movement-category"
                  icon={<Tag className="h-4 w-4" />}
                >
                  <Select
                    id="movement-category"
                    value={categoryId}
                    onChange={(event) =>
                      {
                        setCategoryId(event.target.value as CategoryId | "none");
                        setSubcategoryId("none");
                      }
                    }
                    className="h-12 border-0 bg-transparent px-0 shadow-none focus:ring-0"
                  >
                    <option value="none">Sin categoría por ahora</option>
                    {categoryOptions.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </FieldCard>

                <FieldCard
                  label="Subcategoria"
                  htmlFor="movement-subcategory"
                  icon={<Tag className="h-4 w-4" />}
                  hint="Es personal y siempre depende de una categoria base."
                >
                  <Select
                    id="movement-subcategory"
                    value={subcategoryId}
                    disabled={catalogLoading || categoryId === "none"}
                    onChange={(event) => setSubcategoryId(event.target.value)}
                    className="h-12 border-0 bg-transparent px-0 shadow-none focus:ring-0"
                  >
                    <option value="none">Sin subcategoria</option>
                    {availableSubcategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </Select>
                  {categoryId !== "none" ? (
                    <div className="mb-2 flex gap-2">
                      <Input aria-label="Nueva subcategoria" placeholder="Nueva subcategoria" value={newSubcategory} onChange={(event) => setNewSubcategory(event.target.value)} className="h-9" />
                      <Button type="button" size="sm" variant="secondary" loading={creatingClassification === "subcategory"} disabled={newSubcategory.trim().length < 2} onClick={() => void handleCreateSubcategory()}>Crear</Button>
                    </div>
                  ) : null}
                </FieldCard>

                <FieldCard
                  label="Persona relacionada"
                  htmlFor="movement-related-person"
                  icon={<HandCoins className="h-4 w-4" />}
                  hint="Util para prestamos, devoluciones y gastos compartidos."
                >
                  <Select id="movement-related-person" value={relatedPersonId} disabled={catalogLoading} onChange={(event) => setRelatedPersonId(event.target.value)} className="h-12 border-0 bg-transparent px-0 shadow-none focus:ring-0">
                    <option value="none">Sin persona relacionada</option>
                    {catalog?.related_people.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}
                  </Select>
                  <div className="mb-2 flex gap-2">
                    <Input aria-label="Nueva persona relacionada" placeholder="Nueva persona" value={newPerson} onChange={(event) => setNewPerson(event.target.value)} className="h-9" />
                    <Button type="button" size="sm" variant="secondary" loading={creatingClassification === "person"} disabled={newPerson.trim().length < 2} onClick={() => void handleCreatePerson()}>Crear</Button>
                  </div>
                </FieldCard>

                <div className="space-y-2">
                  <p className="ml-1 text-sm text-text-secondary">Etiquetas</p>
                  <div className="rounded-lg border border-border bg-bg-surface-raised p-3">
                    <div className="flex flex-wrap gap-2">
                      {catalog?.tags.map((item) => {
                        const selected = selectedTagIds.includes(item.id);
                        return (
                          <button key={item.id} type="button" aria-pressed={selected} onClick={() => setSelectedTagIds((current) => selected ? current.filter((id) => id !== item.id) : [...current, item.id])} className={cn("min-h-9 rounded-full border px-3 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus", selected ? "border-brand bg-brand-subtle text-text-brand" : "border-border bg-bg-surface text-text-secondary hover:border-border-strong")}>{item.label}</button>
                        );
                      })}
                      {!catalogLoading && (catalog?.tags.length ?? 0) === 0 ? <span className="text-sm text-text-muted">Todavia no tienes etiquetas.</span> : null}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Input aria-label="Nueva etiqueta" placeholder="Nueva etiqueta" value={newTag} onChange={(event) => setNewTag(event.target.value)} className="h-9" />
                      <Button type="button" size="sm" variant="secondary" loading={creatingClassification === "tag"} disabled={newTag.trim().length < 2} onClick={() => void handleCreateTag()}>Crear</Button>
                    </div>
                  </div>
                </div>

                <FieldCard
                  label="Descripción"
                  htmlFor="movement-description"
                  icon={<FileText className="h-4 w-4" />}
                  hint="Opcional, pero ayuda a reconocerlo después."
                >
                  <Input
                    id="movement-description"
                    placeholder={config.descriptionPlaceholder}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="h-12 border-0 bg-transparent px-0 shadow-none focus:ring-0"
                  />
                </FieldCard>
              </section>

              {formError ? (
                <p className="rounded-lg border border-error-subtle bg-error-subtle px-3 py-2 text-sm text-error">
                  {formError}
                </p>
              ) : null}

              {duplicateWarning ? (
                <div className="rounded-lg border border-warning bg-warning-subtle p-3">
                  <p className="text-sm font-medium text-text">
                    {duplicateWarning}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    No guardé nada todavía. Confirma solo si realmente es otro movimiento.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3"
                    loading={saving}
                    onClick={() => void saveMovement(true)}
                  >
                    Guardar de todos modos
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/70 bg-bg-surface-raised p-4 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              {config.specializedView ? (
                <Button
                  type="button"
                  icon={<ShieldCheck className="h-4 w-4" />}
                  onClick={() => onOpenSpecialized(config.specializedView!)}
                >
                  {config.specializedCtaLabel ?? config.ctaLabel}
                </Button>
              ) : (
                <Button type="submit" loading={saving}>
                  {config.ctaLabel}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

type MovementFormConfig = {
  amountLabel: string;
  descriptionPlaceholder: string;
  fallbackDescription: string;
  ctaLabel: string;
  impactTitle: string;
  impactBody: string;
  canSaveNow: boolean;
  blockedMessage?: string;
  specializedView?: AppView;
  specializedCtaLabel?: string;
  linkedField?: {
    label: string;
    value: string;
    hint: string;
  };
};

const movementFormConfig: Record<MovementType, MovementFormConfig> = {
  gasto: {
    amountLabel: "Monto del gasto",
    descriptionPlaceholder: "Ej. Almuerzo oficina",
    fallbackDescription: "Gasto registrado desde Dashboard",
    ctaLabel: "Guardar gasto",
    impactTitle: "Impacto del movimiento",
    impactBody:
      "Reduce tu dinero libre. Si no eliges cuenta, queda guardado con auditoría sin mover saldos de cuenta.",
    canSaveNow: true,
  },
  ingreso: {
    amountLabel: "Monto del ingreso",
    descriptionPlaceholder: "Ej. Pago recibido",
    fallbackDescription: "Ingreso registrado desde Dashboard",
    ctaLabel: "Guardar ingreso",
    impactTitle: "Impacto del movimiento",
    impactBody:
      "Aumenta tus ingresos registrados. Sin cuenta asignada, no mueve saldos hasta que lo completes.",
    canSaveNow: true,
  },
  pago_deuda: {
    amountLabel: "Monto pagado",
    descriptionPlaceholder: "Ej. Cuota tarjeta",
    fallbackDescription: "Pago de deuda registrado desde Dashboard",
    ctaLabel: "Registrar pago",
    impactTitle: "Impacto del movimiento",
    impactBody:
      "Registra el pago como movimiento de deuda. Luego podrás vincularlo al detalle de la deuda.",
    canSaveNow: false,
    specializedView: "debts",
    specializedCtaLabel: "Abrir Deudas para registrar el pago",
    linkedField: {
      label: "Deuda vinculada",
      value: "Vincular después",
      hint: "Por ahora queda como movimiento; el vínculo formal se completa en Deudas.",
    },
  },
  prestamo_dado: {
    amountLabel: "Monto prestado",
    descriptionPlaceholder: "Ej. Le presté a Luis",
    fallbackDescription: "Préstamo dado registrado desde Dashboard",
    ctaLabel: "Guardar préstamo",
    impactTitle: "Impacto del movimiento",
    impactBody:
      "Registra dinero que te deben. Si luego eliges cuenta, también podrá reflejar la salida de dinero.",
    canSaveNow: false,
    specializedView: "debts",
    specializedCtaLabel: "Abrir Deudas",
    linkedField: {
      label: "Persona",
      value: "Agregar persona después",
      hint: "Por ahora puedes escribir el nombre en la descripción.",
    },
  },
  prestamo_recibido: {
    amountLabel: "Monto recibido",
    descriptionPlaceholder: "Ej. Préstamo de Ana",
    fallbackDescription: "Préstamo recibido registrado desde Dashboard",
    ctaLabel: "Guardar préstamo",
    impactTitle: "Impacto del movimiento",
    impactBody:
      "Registra dinero que recibiste y podrías deber. Sin cuenta, no mueve saldos de cuenta.",
    canSaveNow: false,
    specializedView: "debts",
    specializedCtaLabel: "Abrir Deudas",
    linkedField: {
      label: "Persona o entidad",
      value: "Agregar después",
      hint: "El vínculo formal se completará desde Deudas.",
    },
  },
  devolucion_recibida: {
    amountLabel: "Monto devuelto",
    descriptionPlaceholder: "Ej. Ana me devolvió",
    fallbackDescription: "Devolución recibida registrada desde Dashboard",
    ctaLabel: "Guardar devolución",
    impactTitle: "Impacto del movimiento",
    impactBody:
      "Registra una devolución recibida. Luego podrá vincularse con una deuda o persona relacionada.",
    canSaveNow: false,
    specializedView: "debts",
    specializedCtaLabel: "Abrir Deudas para registrar la devolución",
    linkedField: {
      label: "Vinculo",
      value: "Vincular después",
      hint: "Puedes reconocerlo ahora por la descripción.",
    },
  },
  deuda_adquirida: {
    amountLabel: "Monto de la deuda",
    descriptionPlaceholder: "Ej. Laptop en cuotas",
    fallbackDescription: "Deuda adquirida registrada desde Dashboard",
    ctaLabel: "Crear registro",
    impactTitle: "Impacto del movimiento",
    impactBody:
      "Crea un registro financiero de deuda. No descuenta saldo hasta que registres un pago o elijas cuenta.",
    canSaveNow: false,
    specializedView: "debts",
    specializedCtaLabel: "Abrir Deudas",
    linkedField: {
      label: "Entidad",
      value: "Agregar entidad después",
      hint: "El detalle completo se completa desde Deudas.",
    },
  },
  pago_recurrente: {
    amountLabel: "Monto del pago",
    descriptionPlaceholder: "Ej. Netflix",
    fallbackDescription: "Pago recurrente registrado desde Dashboard",
    ctaLabel: "Guardar pago",
    impactTitle: "Impacto del movimiento",
    impactBody:
      "Registra el pago realizado. La recurrencia futura se configura desde Pagos que vienen.",
    canSaveNow: false,
    specializedView: "upcoming",
    specializedCtaLabel: "Abrir Pagos que vienen",
    linkedField: {
      label: "Pago que viene",
      value: "Crear vínculo después",
      hint: "No crea recurrencia automática desde este formulario.",
    },
  },
  transferencia: {
    amountLabel: "Monto transferido",
    descriptionPlaceholder: "Ej. De BCP a Yape",
    fallbackDescription: "Transferencia registrada desde Dashboard",
    ctaLabel: "Guardar transferencia",
    impactTitle: "Necesita cuentas origen y destino",
    impactBody:
      "Una transferencia no cambia tu dinero total, pero necesita mover saldos entre dos cuentas para no inventar datos.",
    canSaveNow: false,
    specializedView: "money",
    specializedCtaLabel: "Abrir transferencia en Mi Dinero",
    blockedMessage:
      "Para guardar una transferencia necesito cuenta origen y cuenta destino.",
    linkedField: {
      label: "Cuentas",
      value: "Origen y destino pendientes",
      hint: "Se habilita cuando el formulario tenga selector de cuentas.",
    },
  },
  asignacion_interna: {
    amountLabel: "Monto a separar",
    descriptionPlaceholder: "Ej. Separar para alquiler",
    fallbackDescription: "Asignación interna registrada desde Dashboard",
    ctaLabel: "Guardar asignación",
    impactTitle: "Necesita una caja destino",
    impactBody:
      "Separar dinero baja tu dinero libre sin cambiar tu saldo total. Para hacerlo bien, necesito elegir la caja.",
    canSaveNow: false,
    specializedView: "money",
    specializedCtaLabel: "Abrir cajas en Mi Dinero",
    blockedMessage:
      "Para guardar una asignación interna necesito una caja destino.",
    linkedField: {
      label: "Caja destino",
      value: "Seleccionar caja después",
      hint: "Se habilita cuando el formulario tenga selector de cajas.",
    },
  },
  ajuste: {
    amountLabel: "Monto del ajuste",
    descriptionPlaceholder: "Ej. Corrección de saldo",
    fallbackDescription: "Ajuste registrado desde Dashboard",
    ctaLabel: "Guardar ajuste",
    impactTitle: "Requiere confirmación de riesgo",
    impactBody:
      "Un ajuste cambia datos base. Debe tener cuenta, motivo y confirmación de riesgo antes de guardarse.",
    canSaveNow: false,
    specializedView: "money",
    specializedCtaLabel: "Abrir ajuste en Mi Dinero",
    blockedMessage:
      "Para guardar un ajuste necesito cuenta, motivo y confirmación de riesgo.",
    linkedField: {
      label: "Cuenta afectada",
      value: "Seleccionar cuenta después",
      hint: "Los ajustes se habilitan con el modal de riesgo.",
    },
  },
};

function FieldCard({
  label,
  htmlFor,
  icon,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  icon: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="ml-1 text-sm text-text-secondary">
        {label}
      </label>
      <div className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-bg-surface-raised px-3 transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-subtle hover:border-border-strong">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-surface text-text-brand">
          {icon}
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {hint ? <p className="ml-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}
