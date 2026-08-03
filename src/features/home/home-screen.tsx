"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Compass,
  ListChecks,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { toMovementViewItem } from "@/features/movements/movement-view-model";
import { ApiClientError } from "@/features/movements/movements-api";
import type { Movement } from "@/shared/types/domain";
import { Button } from "@/ui/primitivas/button";
import { cn } from "@/ui/primitivas/cn";
import { MoneyText } from "@/ui/primitivas/money";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { getHome, postponeNextAction, setHomeBlockHidden } from "./home-api";
import type {
  HomeBlock,
  HomeBlockKind,
  HomeComposition,
  HomeMonthData,
  HomeNextAction,
  HomePendingData,
  HomeUpcomingData,
  HomeFreeMoneyData,
  HomeInsightData,
  HomeReminderKind,
} from "./home-types";

type LoadState = "loading" | "loaded" | "error";

const NEXT_ACTION_LABEL: Record<HomeReminderKind, string> = {
  correo_desconectado: "Revisar la conexión",
  pago_vencido: "Registrar el pago",
  cuota_vencida: "Registrar el pago",
  pago_proximo: "Ver el pago",
  cuota_proxima: "Ver la cuota",
  pendientes_acumulados: "Revisarlos",
  confirmar_hecho: "Revisar",
  presupuesto_umbral: "Ver presupuesto",
  sin_registrar: "Registrar",
  descarga_lista: "Ver exportación",
};

const BLOCK_TITLES: Record<HomeBlockKind, string> = {
  free_money: "Tienes libres",
  next_action: "Lo siguiente",
  pending: "Pendientes",
  month: "Este mes",
  upcoming: "Te vienen",
  insight: "Algo que noté",
  movements: "Últimos movimientos",
};

export function HomeScreen({
  onSignOut,
  onNavigate,
  onStartMovement,
}: {
  onSignOut?: () => void;
  onNavigate?: (view: AppView) => void;
  onStartMovement?: () => void;
}) {
  const [composition, setComposition] = useState<HomeComposition | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [uiError, setUiError] = useState<string | null>(null);
  const [busyBlock, setBusyBlock] = useState<HomeBlockKind | null>(null);

  const reload = useCallback(() => {
    setLoadState("loading");
    setUiError(null);
    getHome()
      .then((next) => {
        setComposition(next);
        setLoadState("loaded");
      })
      .catch((error: unknown) => {
        setLoadState("error");
        setUiError(toUiMessage(error));
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getHome()
      .then((next) => {
        if (cancelled) return;
        setComposition(next);
        setLoadState("loaded");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadState("error");
        setUiError(toUiMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePostpone = useCallback(
    (id: string) => {
      setBusyBlock("next_action");
      postponeNextAction(id)
        .then(() => reload())
        .catch((error: unknown) => setUiError(toUiMessage(error)))
        .finally(() => setBusyBlock(null));
    },
    [reload],
  );

  const handleHideBlock = useCallback(
    (kind: HomeBlockKind) => {
      setBusyBlock(kind);
      setHomeBlockHidden(kind, true)
        .then(() => {
          setComposition((current) =>
            current ? { ...current, blocks: current.blocks.filter((block) => block.kind !== kind) } : current,
          );
        })
        .catch((error: unknown) => setUiError(toUiMessage(error)))
        .finally(() => setBusyBlock(null));
    },
    [],
  );

  const startMovement = () => (onStartMovement ? onStartMovement() : onNavigate?.("movements"));
  const registerButton = (mobile: boolean) => (
    <Button
      size={mobile ? "icon" : undefined}
      aria-label="Registrar un movimiento"
      icon={<Plus className={mobile ? "h-5 w-5" : "h-4 w-4"} />}
      onClick={startMovement}
      className={mobile ? "h-12 w-12 rounded-full shadow-lg" : undefined}
    >
      {mobile ? "Registrar" : "Registrar"}
    </Button>
  );

  const failedBlocks = composition?.blocks.filter((block) => block.status === "error") ?? [];

  return (
    <AppShell
      title="Inicio"
      activeView="home"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      primaryAction={registerButton(false)}
      mobilePrimaryAction={registerButton(true)}
    >
      <div id="home" className="mx-auto max-w-[880px] space-y-5 pb-8 pt-2 lg:pt-4">
        {loadState === "loading" && !composition ? (
          <LoadingBlock label="Ordenando tu Inicio" />
        ) : loadState === "error" && !composition ? (
          <ErrorState
            title="No pude cargar tu información"
            description={uiError ?? "Vuelve a intentarlo. Registrar sigue disponible."}
            onRetry={reload}
          />
        ) : composition?.state === "vacio" ? (
          <EmptyHome onStartMovement={startMovement} onNavigate={onNavigate} />
        ) : composition ? (
          <>
            {failedBlocks.length > 0 ? (
              <p role="status" aria-live="polite" className="sr-only">
                {failedBlocks.length === 1
                  ? "Una parte del Inicio no pudo cargar."
                  : `${failedBlocks.length} partes del Inicio no pudieron cargar.`}
              </p>
            ) : null}
            {composition.blocks.map((block) => (
              <HomeBlockSection
                key={block.kind}
                block={block}
                busy={busyBlock === block.kind}
                onNavigate={onNavigate}
                onRetry={reload}
                onPostpone={handlePostpone}
                onHide={handleHideBlock}
              />
            ))}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function HomeBlockSection({
  block,
  busy,
  onNavigate,
  onRetry,
  onPostpone,
  onHide,
}: {
  block: HomeBlock;
  busy: boolean;
  onNavigate?: (view: AppView) => void;
  onRetry: () => void;
  onPostpone: (id: string) => void;
  onHide: (kind: HomeBlockKind) => void;
}) {
  if (block.status === "error") {
    return (
      <BlockShell kind={block.kind} onHide={onHide}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">No pude cargar esta parte.</p>
          <Button variant="secondary" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      </BlockShell>
    );
  }

  if (block.kind === "free_money") {
    return <FreeMoneyBlock data={block.data as HomeFreeMoneyData} onNavigate={onNavigate} />;
  }
  if (block.kind === "next_action") {
    return (
      <NextActionBlock
        data={block.data as HomeNextAction}
        busy={busy}
        onNavigate={onNavigate}
        onPostpone={onPostpone}
        onHide={onHide}
      />
    );
  }
  if (block.kind === "pending") {
    return (
      <BlockShell kind="pending" onHide={onHide}>
        <PendingBlockBody data={block.data as HomePendingData} onNavigate={onNavigate} />
      </BlockShell>
    );
  }
  if (block.kind === "month") {
    return (
      <BlockShell kind="month" onHide={onHide}>
        <MonthBlockBody data={block.data as HomeMonthData} />
      </BlockShell>
    );
  }
  if (block.kind === "upcoming") {
    return (
      <BlockShell kind="upcoming" onHide={onHide}>
        <UpcomingBlockBody data={block.data as HomeUpcomingData} onNavigate={onNavigate} />
      </BlockShell>
    );
  }
  if (block.kind === "insight") {
    return (
      <BlockShell kind="insight" onHide={onHide}>
        <InsightBlockBody data={block.data as HomeInsightData} onNavigate={onNavigate} />
      </BlockShell>
    );
  }
  if (block.kind === "movements") {
    return (
      <BlockShell kind="movements" onHide={onHide}>
        <MovementsBlockBody data={(block.data as Movement[]) ?? []} onNavigate={onNavigate} />
      </BlockShell>
    );
  }
  return null;
}

function BlockShell({
  kind,
  onHide,
  children,
}: {
  kind: HomeBlockKind;
  onHide: (kind: HomeBlockKind) => void;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`home-${kind}-title`}
      className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs sm:p-6"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={`home-${kind}-title`} className="font-heading text-lg font-semibold text-text">
          {BLOCK_TITLES[kind]}
        </h2>
        <button
          type="button"
          className="text-xs font-medium text-text-muted transition hover:text-text"
          onClick={() => onHide(kind)}
        >
          Ocultar
        </button>
      </div>
      {children}
    </section>
  );
}

function FreeMoneyBlock({ data, onNavigate }: { data: HomeFreeMoneyData; onNavigate?: (view: AppView) => void }) {
  if (!data.has_accounts) {
    return (
      <section aria-labelledby="home-free-money-title" className="rounded-xl border border-border bg-bg-surface-raised p-6 shadow-xs sm:p-7">
        <h1 id="home-free-money-title" className="font-heading text-2xl font-semibold text-text sm:text-3xl">
          Para decirte cuánto tienes libre necesito el saldo de al menos una cuenta.
        </h1>
        <Button className="mt-5" icon={<ArrowRight className="h-4 w-4" />} onClick={() => onNavigate?.("money")}>
          Agregar cuenta
        </Button>
      </section>
    );
  }

  const composition = `De ${formatMoney(data.total_balance)} en tus cuentas: ${formatMoney(data.separated_balance)} están apartados en cajas.`;

  return (
    <section aria-labelledby="home-free-money-title" className="rounded-xl border border-border bg-bg-surface-raised p-6 shadow-xs sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Tienes libres</p>
          <h1 id="home-free-money-title" className="sr-only">
            {`Tienes libres ${formatMoney(data.free_balance)}. ${composition}`}
          </h1>
          <div aria-hidden="true" className="mt-4">
            <MoneyText value={data.free_balance} sign="none" className="font-heading text-5xl font-semibold leading-none text-text sm:text-6xl" />
          </div>
          <p aria-hidden="true" className="mt-4 max-w-xl text-sm leading-6 text-text-secondary">
            {composition}
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
          <WalletCards className="h-6 w-6" />
        </div>
      </div>
      <button
        type="button"
        className="mt-5 text-sm font-semibold text-brand transition hover:text-brand-hover"
        onClick={() => onNavigate?.("money")}
      >
        Ver el desglose
      </button>
    </section>
  );
}

function NextActionBlock({
  data,
  busy,
  onNavigate,
  onPostpone,
  onHide,
}: {
  data: HomeNextAction;
  busy: boolean;
  onNavigate?: (view: AppView) => void;
  onPostpone: (id: string) => void;
  onHide: (kind: HomeBlockKind) => void;
}) {
  return (
    <section aria-labelledby="home-next_action-title" className="rounded-xl border border-warning-subtle bg-warning-subtle/35 p-5 shadow-xs sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="home-next_action-title" className="font-heading text-lg font-semibold text-text">
          Lo siguiente
        </h2>
        <button type="button" className="text-xs font-medium text-text-muted transition hover:text-text" onClick={() => onHide("next_action")}>
          Ocultar
        </button>
      </div>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-surface-raised text-warning">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-heading text-base font-semibold text-text">{data.title}</h3>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{data.body}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          icon={<ArrowRight className="h-4 w-4" />}
          onClick={() => (data.action_url ? followUrl(data.action_url, onNavigate) : undefined)}
        >
          {NEXT_ACTION_LABEL[data.kind]}
        </Button>
        <Button size="sm" variant="ghost" loading={busy} onClick={() => onPostpone(data.id)}>
          Ahora no
        </Button>
      </div>
    </section>
  );
}

function followUrl(url: string, onNavigate?: (view: AppView) => void) {
  const target = urlToView(url);
  if (target && onNavigate) {
    onNavigate(target);
    return;
  }
  window.location.assign(url);
}

function urlToView(url: string): AppView | null {
  if (url.startsWith("/pagos-que-vienen")) return "upcoming";
  if (url.startsWith("/deudas")) return "debts";
  if (url.startsWith("/pendientes")) return "pending";
  return null;
}

function PendingBlockBody({ data, onNavigate }: { data: HomePendingData; onNavigate?: (view: AppView) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm leading-6 text-text-secondary">
        {data.active_count} movimiento{data.active_count === 1 ? "" : "s"} del banco sin confirmar.
      </p>
      <Button size="sm" variant="secondary" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => onNavigate?.("pending")}>
        Revisarlos
      </Button>
    </div>
  );
}

function MonthBlockBody({ data }: { data: HomeMonthData }) {
  if (data.variant === "period_total") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <MoneyFact label="Gastos del periodo" value={data.period_total.gasto_total} />
        <MoneyFact label="Ingresos del periodo" value={data.period_total.ingreso_total} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.budgets.map((budget) => (
        <div key={budget.id}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-text">{budget.category_name ?? "General"}</span>
            <span className="text-text-secondary">
              <MoneyText value={budget.spent} sign="none" /> de <MoneyText value={budget.amount} sign="none" />
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg-primary">
            <div
              className={cn("h-full rounded-full", budget.percentage > 100 ? "bg-danger" : "bg-brand")}
              style={{ width: `${Math.min(100, budget.percentage)}%` }}
            />
          </div>
        </div>
      ))}
      {data.projection ? (
        <p className="text-sm leading-6 text-text-secondary">
          {data.projection.projected_close !== null
            ? `A este ritmo cerrarías el mes con unos ${formatMoney(data.projection.projected_close)}.`
            : "Todavía no tengo suficiente historial para proyectar el cierre del mes."}
        </p>
      ) : null}
    </div>
  );
}

function UpcomingBlockBody({ data, onNavigate }: { data: HomeUpcomingData; onNavigate?: (view: AppView) => void }) {
  return (
    <div className="space-y-3">
      <div className="divide-y divide-border/70">
        {data.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <CalendarDays className="h-4 w-4 shrink-0" />
              {formatShortDate(item.due_at)} · {item.title}
            </div>
            <MoneyText value={item.amount} sign="none" className="text-sm font-medium text-text" />
          </div>
        ))}
      </div>
      <button type="button" className="text-sm font-medium text-text-brand hover:text-brand-hover" onClick={() => onNavigate?.("upcoming")}>
        Ver todos ({data.count})
      </button>
    </div>
  );
}

function InsightBlockBody({ data, onNavigate }: { data: HomeInsightData; onNavigate?: (view: AppView) => void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
        <Compass className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm leading-6 text-text-secondary">{data.body}</p>
        <p className="mt-2 text-xs font-medium uppercase tracking-[0.1em] text-text-muted">{data.evidence_text}</p>
        <button type="button" className="mt-3 text-sm font-semibold text-brand hover:text-brand-hover" onClick={() => onNavigate?.("insights")}>
          Entender por qué
        </button>
      </div>
    </div>
  );
}

function MovementsBlockBody({ data, onNavigate }: { data: Movement[]; onNavigate?: (view: AppView) => void }) {
  const items = data.map(toMovementViewItem);
  return (
    <div>
      <div className="divide-y divide-border/70">
        {items.map((movement) => (
          <article key={movement.id} className="flex min-w-0 items-center gap-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-surface text-text-secondary">
              <ListChecks className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">{movement.title}</p>
              <p className="truncate text-xs text-text-secondary">{movement.categoryLabel} · {movement.timeLabel}</p>
            </div>
            <MoneyText value={movement.amount} sign="auto" className="shrink-0 text-sm font-semibold text-text" />
          </article>
        ))}
      </div>
      <button type="button" className="mt-3 text-sm font-medium text-text-brand hover:text-brand-hover" onClick={() => onNavigate?.("movements")}>
        Ver todos
      </button>
    </div>
  );
}

function EmptyHome({
  onStartMovement,
  onNavigate,
}: {
  onStartMovement: () => void;
  onNavigate?: (view: AppView) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-surface-raised p-7 shadow-xs sm:p-8">
      <h1 className="font-heading text-2xl font-semibold text-text sm:text-3xl">Empecemos por lo tuyo.</h1>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button icon={<Plus className="h-4 w-4" />} onClick={onStartMovement}>
          Registrar mi primer movimiento
        </Button>
        <Button variant="secondary" icon={<Mail className="h-4 w-4" />} onClick={() => onNavigate?.("settings")}>
          Conectar mi correo
        </Button>
        <Button variant="secondary" icon={<WalletCards className="h-4 w-4" />} onClick={() => onNavigate?.("money")}>
          Agregar una cuenta
        </Button>
      </div>
      <p className="mt-6 max-w-xl text-sm leading-6 text-text-secondary">
        Cuando tenga tus cuentas te diré cuánto tienes libre de verdad: lo que queda después de lo que ya está
        comprometido.
      </p>
    </section>
  );
}

function MoneyFact({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-primary px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <MoneyText value={value} sign="none" className="mt-1 block font-heading text-xl font-semibold text-text" />
    </div>
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 })
    .format(value)
    .replace(/^(\D+)\s+/, "$1");
}

function formatShortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "fecha por revisar";
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" }).format(date);
}

function toUiMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "AUTH_REQUIRED" || error.status === 401) {
      return "Necesitas iniciar sesión para ver tu Inicio.";
    }
    return error.message;
  }
  return "Intenta de nuevo en un momento.";
}
