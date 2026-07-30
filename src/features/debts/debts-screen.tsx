"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  HandCoins,
  Landmark,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { ApiClientError } from "@/features/movements/movements-api";
import { Badge } from "@/ui/primitivas/badge";
import { Button } from "@/ui/primitivas/button";
import { DiscreetValue } from "@/ui/primitivas/money";
import { EmptyState, ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { Tab, TabList, TabPanel, Tabs } from "@/ui/primitivas/tabs";
import type { DebtDirection } from "@/shared/types/domain";
import { getDebtDetail, listDebts } from "./debts-api";
import {
  DebtCloseDialog,
  DebtEditorDialog,
  DebtPaymentDialog,
  DebtReopenDialog,
  RescheduleInstallmentDialog,
  SkipInstallmentDialog,
} from "./debts-dialogs";
import { DebtDetailSheet } from "./debts-detail";
import type {
  DebtDetailWithPayments,
  DebtInstallmentViewItem,
  DebtScreenIntent,
  DebtSummary,
  DebtViewItem,
  DebtWithPerson,
} from "./debts-types";
import {
  formatDebtMoney,
  splitDebtsByState,
  summarizeDebts,
  toDebtViewItem,
} from "./debts-view-model";

type DebtsScreenProps = {
  onSignOut?: () => void;
  onNavigate?: (view: AppView) => void;
  debtIntent?: DebtScreenIntent | null;
  onDebtIntentConsumed?: () => void;
  onDebtDetailClose?: () => void;
};

type LoadState = "loading" | "ready" | "error";
type EditorState = { debt: DebtWithPerson | null } | null;
type InstallmentAction =
  | { type: "reschedule"; installment: DebtInstallmentViewItem }
  | { type: "skip"; installment: DebtInstallmentViewItem }
  | null;

export function DebtsScreen({
  onSignOut,
  onNavigate,
  debtIntent = null,
  onDebtIntentConsumed,
  onDebtDetailClose,
}: DebtsScreenProps) {
  const [debts, setDebts] = useState<DebtWithPerson[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [direction, setDirection] = useState<DebtDirection>("i_owe");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [detail, setDetail] = useState<DebtDetailWithPayments | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [paymentDebt, setPaymentDebt] =
    useState<DebtDetailWithPayments | null>(null);
  const [paymentInstallmentId, setPaymentInstallmentId] = useState<
    string | null
  >(null);
  const [closingDebt, setClosingDebt] =
    useState<DebtDetailWithPayments | null>(null);
  const [reopeningDebt, setReopeningDebt] =
    useState<DebtDetailWithPayments | null>(null);
  const [installmentAction, setInstallmentAction] =
    useState<InstallmentAction>(null);
  const consumedIntentRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const result = await listDebts();
      setDebts(result.debts);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setLoadError(toUiError(error));
    }
  }, []);

  useEffect(() => {
    let active = true;
    void listDebts()
      .then((result) => {
        if (!active) return;
        setDebts(result.debts);
        const loadedSummary = summarizeDebts(result.debts);
        if (
          loadedSummary.active_i_owe === 0 &&
          loadedSummary.active_they_owe_me > 0
        ) {
          setDirection("they_owe_me");
        }
        setLoadState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setLoadState("error");
        setLoadError(toUiError(error));
      });
    return () => {
      active = false;
    };
  }, []);

  const loadDetail = useCallback(async (debtId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const result = await getDebtDetail(debtId);
      setDetail(result);
      return result;
    } catch (error) {
      setDetailError(toUiError(error));
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!debtIntent) {
      consumedIntentRef.current = null;
      return;
    }
    const key = `${debtIntent.debtId}:${debtIntent.installmentId ?? ""}:${debtIntent.action}`;
    if (consumedIntentRef.current === key) return;
    consumedIntentRef.current = key;
    let active = true;
    void getDebtDetail(debtIntent.debtId)
      .then((result) => {
        if (!active) return;
        setDetailError(null);
        setDetail(result);
        setDirection(result.direction);
        if (debtIntent.action === "pay") {
          setPaymentInstallmentId(debtIntent.installmentId ?? null);
          setPaymentDebt(result);
        }
      })
      .catch((error) => {
        if (!active) return;
        setDetailError(toUiError(error));
      })
      .finally(() => {
        if (active) onDebtIntentConsumed?.();
      });
    return () => {
      active = false;
    };
  }, [debtIntent, onDebtIntentConsumed]);

  const summary = useMemo(() => summarizeDebts(debts), [debts]);
  const visible = useMemo(
    () => splitDebtsByState(debts, direction),
    [debts, direction]
  );
  const overlayOpen = Boolean(
    editor ||
      paymentDebt ||
      closingDebt ||
      reopeningDebt ||
      installmentAction ||
      detail
  );
  const operationOpen = Boolean(
    editor ||
      paymentDebt ||
      closingDebt ||
      reopeningDebt ||
      installmentAction
  );

  async function openDetail(item: DebtViewItem) {
    const optimistic = debts.find((debt) => debt.id === item.id);
    if (optimistic) {
      setDetail({ ...optimistic, payments: [], installments: [] });
    }
    await loadDetail(item.id);
  }

  async function openPayment(
    item: DebtViewItem,
    installmentId: string | null = null
  ) {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const result =
        detail?.id === item.id ? detail : await getDebtDetail(item.id);
      setPaymentInstallmentId(installmentId);
      setPaymentDebt(result);
    } catch (error) {
      setDetailError(toUiError(error));
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshAfterMutation(message: string) {
    const detailId = detail?.id ?? null;
    setEditor(null);
    setPaymentDebt(null);
    setClosingDebt(null);
    setReopeningDebt(null);
    setInstallmentAction(null);
    setFeedback(message);
    await load();
    if (detailId) await loadDetail(detailId);
  }

  return (
    <AppShell
      title="Deudas"
      subtitle="Lo que debes y lo que te deben, siempre por separado."
      activeView="debts"
      hideMobileNavigation={overlayOpen}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      primaryAction={
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setEditor({ debt: null })}
        >
          Agregar deuda
        </Button>
      }
      mobilePrimaryAction={
        !overlayOpen ? (
          <Button
            size="icon"
            aria-label="Agregar deuda"
            icon={<Plus className="h-5 w-5" />}
            className="h-12 w-12 rounded-full shadow-lg"
            onClick={() => setEditor({ debt: null })}
          >
            Agregar deuda
          </Button>
        ) : undefined
      }
    >
      <main className="mx-auto max-w-[1040px] space-y-6 pb-12 pt-2 lg:pt-4">
        {loadState === "loading" ? (
          <LoadingBlock label="Cargando deudas" />
        ) : loadState === "error" ? (
          <ErrorState
            title="No pude cargar tus deudas"
            description={loadError ?? "Intenta nuevamente."}
            onRetry={() => void load()}
          />
        ) : (
          <>
            {feedback ? (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-success-subtle bg-success-subtle/55 p-3 text-sm text-text-secondary"
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
                {feedback}
              </div>
            ) : null}
            {detailError && !detail ? (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-lg border border-error-subtle bg-error-subtle/50 p-4 text-sm text-error sm:flex-row sm:items-center sm:justify-between"
              >
                <span>{detailError}</span>
                {onDebtDetailClose ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setDetailError(null);
                      onDebtDetailClose();
                    }}
                  >
                    Volver al listado
                  </Button>
                ) : null}
              </div>
            ) : null}
            <DebtSummaryCards summary={summary} />
            <section className="rounded-xl border border-brand-subtle bg-brand-subtle/30 p-4 text-sm leading-6 text-text-secondary">
              Una tarjeta aquí es una deuda simple: no es una cuenta disponible
              ni modela ciclo de facturación. Tampoco compensamos lo que debes
              con lo que te deben.
            </section>
            {debts.length === 0 ? (
              <EmptyState
                icon={<HandCoins className="h-6 w-6" />}
                title="Aún no registras deudas"
                description="Puedes crear un préstamo, una deuda informal, una tarjeta simple o una compra en cuotas."
                action={
                  <Button onClick={() => setEditor({ debt: null })}>
                    Crear primera deuda
                  </Button>
                }
              />
            ) : (
              <Tabs
                value={direction}
                onValueChange={(value) =>
                  setDirection(value as DebtDirection)
                }
              >
                <TabList aria-label="Dirección de las deudas">
                  <Tab value="i_owe">
                    Debo ({summary.active_i_owe})
                  </Tab>
                  <Tab value="they_owe_me">
                    Me deben ({summary.active_they_owe_me})
                  </Tab>
                </TabList>
                <TabPanel value="i_owe">
                  <DebtPanel
                    direction="i_owe"
                    open={visible.open}
                    closed={visible.closed}
                    onDetail={(item) => void openDetail(item)}
                    onPayment={(item) => void openPayment(item)}
                  />
                </TabPanel>
                <TabPanel value="they_owe_me">
                  <DebtPanel
                    direction="they_owe_me"
                    open={visible.open}
                    closed={visible.closed}
                    onDetail={(item) => void openDetail(item)}
                    onPayment={(item) => void openPayment(item)}
                  />
                </TabPanel>
              </Tabs>
            )}
          </>
        )}
      </main>

      {detail && !operationOpen ? (
        <DebtDetailSheet
          debt={detail}
          loading={detailLoading}
          error={detailError}
          onClose={() => {
            setDetail(null);
            setDetailError(null);
            onDebtDetailClose?.();
          }}
          onRetry={() => void loadDetail(detail.id)}
          onEdit={() => setEditor({ debt: detail })}
          onPayment={() => void openPayment(toDebtViewItem(detail))}
          onCloseDebt={() => setClosingDebt(detail)}
          onReopen={() => setReopeningDebt(detail)}
          onReschedule={(installment) =>
            setInstallmentAction({ type: "reschedule", installment })
          }
          onSkip={(installment) =>
            setInstallmentAction({ type: "skip", installment })
          }
        />
      ) : null}
      {editor ? (
        <DebtEditorDialog
          debt={editor.debt}
          onClose={() => setEditor(null)}
          onSaved={() =>
            refreshAfterMutation(
              editor.debt
                ? "Datos de la deuda actualizados sin tocar el saldo."
                : "Deuda creada de forma atómica."
            )
          }
        />
      ) : null}
      {paymentDebt ? (
        <DebtPaymentDialog
          debt={paymentDebt}
          requestedInstallmentId={paymentInstallmentId}
          onClose={() => {
            setPaymentDebt(null);
            setPaymentInstallmentId(null);
          }}
          onSaved={() =>
            refreshAfterMutation(
              paymentDebt.direction === "i_owe"
                ? "Pago conciliado por Core."
                : "Devolución conciliada por Core."
            )
          }
        />
      ) : null}
      {closingDebt ? (
        <DebtCloseDialog
          debt={closingDebt}
          onClose={() => setClosingDebt(null)}
          onSaved={() =>
            refreshAfterMutation(
              closingDebt.current_balance === 0
                ? "Deuda cerrada como pagada."
                : "Deuda condonada; el saldo perdonado quedó registrado."
            )
          }
        />
      ) : null}
      {reopeningDebt ? (
        <DebtReopenDialog
          debt={reopeningDebt}
          onClose={() => setReopeningDebt(null)}
          onSaved={() =>
            refreshAfterMutation("Deuda condonada reabierta con su saldo.")
          }
        />
      ) : null}
      {detail && installmentAction?.type === "reschedule" ? (
        <RescheduleInstallmentDialog
          debtId={detail.id}
          installment={installmentAction.installment}
          onClose={() => setInstallmentAction(null)}
          onSaved={() =>
            refreshAfterMutation("Cuota reprogramada sin cambiar sus montos.")
          }
        />
      ) : null}
      {detail && installmentAction?.type === "skip" ? (
        <SkipInstallmentDialog
          debtId={detail.id}
          installment={installmentAction.installment}
          onClose={() => setInstallmentAction(null)}
          onSaved={() =>
            refreshAfterMutation("Cuota omitida con motivo auditable.")
          }
        />
      ) : null}
    </AppShell>
  );
}

function DebtSummaryCards({ summary }: { summary: DebtSummary }) {
  return (
    <section aria-label="Resumen bruto de deudas" className="grid gap-3 sm:grid-cols-2">
      <SummaryCard
        label="Debes"
        amount={summary.total_i_owe}
        usdAmount={summary.total_i_owe_usd}
        icon={<ArrowUpRight className="h-4 w-4" />}
        tone="debt"
      />
      <SummaryCard
        label="Te deben"
        amount={summary.total_they_owe_me}
        usdAmount={summary.total_they_owe_me_usd}
        icon={<ArrowDownLeft className="h-4 w-4" />}
        tone="success"
      />
    </section>
  );
}

function SummaryCard({
  label,
  amount,
  usdAmount,
  icon,
  tone,
}: {
  label: string;
  amount: number;
  usdAmount: number;
  icon: ReactNode;
  tone: "debt" | "success";
}) {
  return (
    <article className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs">
      <p
        className={
          tone === "debt"
            ? "flex items-center gap-2 text-sm font-medium text-debt"
            : "flex items-center gap-2 text-sm font-medium text-success"
        }
      >
        {icon}
        {label}
      </p>
      <p className="mt-2 font-heading text-3xl font-semibold text-text">
        <DiscreetValue>{formatDebtMoney(amount)}</DiscreetValue>
      </p>
      {usdAmount > 0 ? (
        <p className="mt-2 text-sm font-medium text-text-secondary">
          Además:{" "}
          <DiscreetValue>{formatDebtMoney(usdAmount, "USD")}</DiscreetValue>
        </p>
      ) : null}
      <p className="mt-2 text-xs text-text-muted">
        Total bruto activo. No se compensa con la otra dirección.
      </p>
    </article>
  );
}

function DebtPanel({
  direction,
  open,
  closed,
  onDetail,
  onPayment,
}: {
  direction: DebtDirection;
  open: DebtViewItem[];
  closed: DebtViewItem[];
  onDetail: (item: DebtViewItem) => void;
  onPayment: (item: DebtViewItem) => void;
}) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-heading text-lg font-semibold text-text">
          {direction === "i_owe" ? "Lo que debes" : "Lo que te deben"}
        </h2>
        {open.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border p-5 text-sm text-text-secondary">
            No hay saldos activos en esta dirección.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {open.map((item) => (
              <DebtCard
                key={item.id}
                item={item}
                onDetail={() => onDetail(item)}
                onPayment={() => onPayment(item)}
              />
            ))}
          </div>
        )}
      </section>
      {closed.length > 0 ? (
        <details className="rounded-xl border border-border bg-bg-surface-raised p-4">
          <summary className="cursor-pointer font-heading text-base font-semibold text-text">
            Cerradas ({closed.length})
          </summary>
          <div className="mt-4 grid gap-3 opacity-85">
            {closed.map((item) => (
              <DebtCard
                key={item.id}
                item={item}
                onDetail={() => onDetail(item)}
                onPayment={() => onPayment(item)}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function DebtCard({
  item,
  onDetail,
  onPayment,
}: {
  item: DebtViewItem;
  onDetail: () => void;
  onPayment: () => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge tone={item.status_tone}>{item.status_label}</Badge>
            <Badge tone="neutral">{item.kind_label}</Badge>
          </div>
          <h3 className="mt-3 font-heading text-xl font-semibold text-text">
            <DiscreetValue>{item.title}</DiscreetValue>
          </h3>
          {item.person_label ? (
            <p className="mt-1 text-sm text-text-secondary">
              <DiscreetValue>{item.person_label}</DiscreetValue>
            </p>
          ) : null}
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-xs text-text-muted">
            {item.direction === "i_owe" ? "Pendiente" : "Por recibir"}
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-text">
            <DiscreetValue>
              {formatDebtMoney(item.current_balance, item.currency)}
            </DiscreetValue>
          </p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-text-muted">
          <span>{item.progress}% pagado confirmado</span>
          <span>
            de{" "}
            <DiscreetValue>
              {formatDebtMoney(item.principal_amount, item.currency)}
            </DiscreetValue>
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-progress-track">
          <div
            className="h-full rounded-full bg-progress-fill"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          {item.next_date_label ?? "Sin próxima fecha"}
        </span>
        {item.linked_box_name ? (
          <span className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-brand" />
            Cubierto por{" "}
            <DiscreetValue>{item.linked_box_name}</DiscreetValue>
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        {!item.is_closed ? (
          <Button variant="secondary" size="sm" onClick={onPayment}>
            {item.direction === "i_owe"
              ? "Registrar pago"
              : "Registrar devolución"}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          icon={<ChevronRight className="h-4 w-4" />}
          onClick={onDetail}
        >
          Ver detalle
        </Button>
      </div>
    </article>
  );
}

function toUiError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}
