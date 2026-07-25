"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Compass,
  Eye,
  EyeOff,
  FileCheck2,
  Lightbulb,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { useDiscreetMode } from "@/shared/privacy/discreet-mode-context";
import { categoryLabels } from "@/features/movements/movement-view-model";
import { ApiClientError } from "@/features/movements/movements-api";
import type { InsightCandidate, InsightType } from "@/shared/types/domain";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/cn";
import { DiscreetValue } from "@/shared/ui/money";
import { EmptyState, ErrorState, LoadingBlock } from "@/shared/ui/states";
import {
  dismissInsight,
  getInsightDetail,
  getInsightEvidence,
  listInsights,
  markInsightSeen,
  recordInsightAction,
} from "./insights-api";
import type {
  InsightActionType,
  InsightDetail,
  InsightEvidence,
  InsightEvidenceMovement,
} from "./insights-types";
import { parseInsightAction } from "./insights-types";

type LoadState = "loading" | "loaded" | "error";
type InsightFilter = "all" | "patterns" | "money" | "commitments" | "progress";

const filterOptions: Array<{ id: InsightFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "patterns", label: "Patrones" },
  { id: "money", label: "Mi dinero" },
  { id: "commitments", label: "Compromisos" },
  { id: "progress", label: "Progreso" },
];

const filterTypes: Record<Exclude<InsightFilter, "all">, InsightType[]> = {
  patterns: ["comparative", "category_concentration", "temporal_pattern", "anomaly", "contextual"],
  money: ["free_money", "box_saving", "projection"],
  commitments: ["debt", "recurring"],
  progress: ["learning_progress", "progress", "data_quality"],
};

export function InsightsScreen({
  onSignOut,
  onNavigate,
}: {
  onSignOut?: () => void;
  onNavigate?: (view: AppView) => void;
}) {
  const [insights, setInsights] = useState<InsightCandidate[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<InsightFilter>("all");
  const { discreet, setDiscreet } = useDiscreetMode();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InsightDetail | null>(null);
  const [evidence, setEvidence] = useState<InsightEvidence | null>(null);
  const [detailState, setDetailState] = useState<LoadState>("loaded");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [activeMutation, setActiveMutation] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);
    try {
      setInsights(await listInsights());
      setLoadState("loaded");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(toUiError(error));
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitialInsights() {
      try {
        const nextInsights = await listInsights();
        if (!active) return;
        setInsights(nextInsights);
        setLoadState("loaded");
      } catch (error) {
        if (!active) return;
        setLoadState("error");
        setErrorMessage(toUiError(error));
      }
    }

    void loadInitialInsights();
    return () => {
      active = false;
    };
  }, []);

  const activeInsights = useMemo(
    () => insights.filter((insight) => insight.status !== "outdated"),
    [insights],
  );
  const outdatedInsights = useMemo(
    () => insights.filter((insight) => insight.status === "outdated"),
    [insights],
  );
  const filteredInsights = useMemo(() => {
    if (filter === "all") return activeInsights;
    return activeInsights.filter((insight) => filterTypes[filter].includes(insight.type));
  }, [activeInsights, filter]);
  const updatedFingerprints = useMemo(
    () => new Set(outdatedInsights.map((insight) => insight.fingerprint)),
    [outdatedInsights],
  );

  const openInsight = useCallback(async (insightId: string) => {
    setSelectedId(insightId);
    setDetail(null);
    setEvidence(null);
    setFeedbackMessage(null);
    setDetailError(null);
    setDetailState("loading");

    try {
      const [nextDetail, nextEvidence] = await Promise.all([
        getInsightDetail(insightId),
        getInsightEvidence(insightId),
      ]);
      setDetail(nextDetail);
      setEvidence(nextEvidence);
      setDetailState("loaded");

      void markInsightSeen(insightId)
        .then((seen) => {
          setInsights((current) =>
            current.map((insight) => (insight.id === seen.id ? seen : insight)),
          );
          setDetail((current) =>
            current?.insight.id === seen.id ? { ...current, insight: seen } : current,
          );
        })
        .catch(() => undefined);
    } catch (error) {
      setDetailState("error");
      setDetailError(toUiError(error));
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setEvidence(null);
    setDetailError(null);
    setFeedbackMessage(null);
    setDetailState("loaded");
  }, []);

  const handleDismiss = useCallback(async () => {
    if (!selectedId) return;
    setActiveMutation("dismiss");
    setFeedbackMessage(null);
    try {
      await dismissInsight(selectedId, "no_me_aporta");
      setInsights((current) => current.filter((insight) => insight.id !== selectedId));
      closeDetail();
    } catch (error) {
      setFeedbackMessage(toUiError(error));
    } finally {
      setActiveMutation(null);
    }
  }, [closeDetail, selectedId]);

  const handleUseful = useCallback(async () => {
    if (!selectedId) return;
    setActiveMutation("useful");
    setFeedbackMessage(null);
    try {
      const saved = await recordInsightAction(selectedId, "feedback_useful", {
        surface: "insight_detail",
      });
      setDetail((current) =>
        current?.insight.id === saved.id ? { ...current, insight: saved } : current,
      );
      setInsights((current) => current.filter((insight) => insight.id !== saved.id));
      setFeedbackMessage("Gracias. Esto ayuda a Manzana a elegir mejor qué mostrarte.");
    } catch (error) {
      setFeedbackMessage(toUiError(error));
    } finally {
      setActiveMutation(null);
    }
  }, [selectedId]);

  const handlePrimaryAction = useCallback(async () => {
    if (!detail) return;
    const action = parseInsightAction(detail.insight.action);
    if (!action) return;
    setActiveMutation("action");
    setFeedbackMessage(null);
    try {
      await recordInsightAction(detail.insight.id, action.type, {
        target_view: action.target_view,
        filters: action.filters ?? {},
        surface: "insight_detail",
      });
      if (action.target_view !== "insights") onNavigate?.(action.target_view);
      else setFeedbackMessage("Listo. Quedó registrado como una acción útil.");
    } catch (error) {
      setFeedbackMessage(toUiError(error));
    } finally {
      setActiveMutation(null);
    }
  }, [detail, onNavigate]);

  return (
    <AppShell
      title="Descubrimientos"
      subtitle="Señales útiles de tu propio dinero, con evidencia y sin juicio."
      activeView="insights"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      primaryAction={
        <Button
          variant="ghost"
          size="icon"
          icon={discreet ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          onClick={() => void setDiscreet(!discreet)}
        >
          {discreet ? "Mostrar información" : "Activar modo discreto"}
        </Button>
      }
    >
      <div className="mx-auto max-w-[1040px] pb-8 pt-2 lg:pt-4">
        {selectedId ? (
          <InsightDetailView
            detail={detail}
            evidence={evidence}
            loadState={detailState}
            errorMessage={detailError}
            discreet={discreet}
            isUpdated={Boolean(
              detail && updatedFingerprints.has(detail.insight.fingerprint),
            )}
            activeMutation={activeMutation}
            feedbackMessage={feedbackMessage}
            onBack={closeDetail}
            onRetry={() => void openInsight(selectedId)}
            onDismiss={() => void handleDismiss()}
            onUseful={() => void handleUseful()}
            onPrimaryAction={() => void handlePrimaryAction()}
          />
        ) : loadState === "loading" ? (
          <LoadingBlock label="Buscando algo que realmente te sirva" />
        ) : loadState === "error" ? (
          <ErrorState description={errorMessage ?? undefined} onRetry={() => void load()} />
        ) : activeInsights.length === 0 ? (
          <EmptyState
            icon={<Compass className="h-6 w-6" />}
            title="Todavía estamos conociendo tu ritmo"
            description="Cuando haya evidencia suficiente, aquí aparecerán descubrimientos claros y personales. No llenaremos este espacio con consejos genéricos."
            action={
              <Button variant="secondary" onClick={() => onNavigate?.("movements")}>
                Ver movimientos
              </Button>
            }
          />
        ) : (
          <InsightsOverview
            insights={filteredInsights}
            totalActive={activeInsights.length}
            filter={filter}
            discreet={discreet}
            updatedFingerprints={updatedFingerprints}
            onFilter={setFilter}
            onOpen={(id) => void openInsight(id)}
          />
        )}
      </div>
    </AppShell>
  );
}

function InsightsOverview({
  insights,
  totalActive,
  filter,
  discreet,
  updatedFingerprints,
  onFilter,
  onOpen,
}: {
  insights: InsightCandidate[];
  totalActive: number;
  filter: InsightFilter;
  discreet: boolean;
  updatedFingerprints: Set<string>;
  onFilter: (filter: InsightFilter) => void;
  onOpen: (id: string) => void;
}) {
  const featured = insights[0] ?? null;
  const rest = insights.slice(1);

  return (
    <div className="space-y-6">
      <section className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1" aria-label="Filtrar descubrimientos">
        {filterOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={cn(
              "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
              filter === option.id
                ? "border-brand bg-brand text-text-inverse"
                : "border-border bg-bg-surface-raised text-text-secondary hover:border-border-strong hover:text-text",
            )}
            onClick={() => onFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </section>

      {featured ? (
        <FeaturedInsight
          insight={featured}
          discreet={discreet}
          updated={updatedFingerprints.has(featured.fingerprint)}
          onOpen={onOpen}
        />
      ) : (
        <EmptyState
          className="min-h-64"
          icon={<Compass className="h-6 w-6" />}
          title="No hay descubrimientos en este filtro"
          description={`Tienes ${totalActive} descubrimiento${totalActive === 1 ? "" : "s"} activo${totalActive === 1 ? "" : "s"} en otras secciones.`}
          action={
            <Button variant="secondary" onClick={() => onFilter("all")}>
              Ver todos
            </Button>
          }
        />
      )}

      {rest.length > 0 ? (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-lg font-semibold text-text">Más para entender</h2>
              <p className="mt-1 text-sm text-text-secondary">Cada señal tiene una explicación que puedes revisar.</p>
            </div>
            <span className="text-xs text-text-muted">{rest.length} reciente{rest.length === 1 ? "" : "s"}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {rest.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                discreet={discreet}
                updated={updatedFingerprints.has(insight.fingerprint)}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FeaturedInsight({
  insight,
  discreet,
  updated,
  onOpen,
}: {
  insight: InsightCandidate;
  discreet: boolean;
  updated: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-brand/20 bg-bg-surface-raised shadow-xs">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-subtle px-3 py-1 text-xs font-semibold text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              Descubrimiento destacado
            </span>
            {updated ? <StatusBadge>Actualizado</StatusBadge> : null}
          </div>
          <h2 className="mt-5 max-w-2xl font-heading text-2xl font-semibold leading-tight text-text sm:text-3xl">
            <DiscreetValue discrete={discreet}>{insight.title}</DiscreetValue>
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
            <DiscreetValue discrete={discreet}>{insight.body}</DiscreetValue>
          </p>
          <Button
            className="mt-6"
            icon={<ArrowRight className="h-4 w-4" />}
            onClick={() => onOpen(insight.id)}
          >
            Entender por qué
          </Button>
        </div>
        <div className="flex min-h-48 items-center justify-center border-t border-brand/15 bg-brand-subtle/55 p-8 lg:border-l lg:border-t-0">
          <InsightIllustration type={insight.type} large />
        </div>
      </div>
    </section>
  );
}

function InsightCard({
  insight,
  discreet,
  updated,
  onOpen,
}: {
  insight: InsightCandidate;
  discreet: boolean;
  updated: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className="group min-h-56 w-full rounded-xl border border-border bg-bg-surface-raised p-5 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      onClick={() => onOpen(insight.id)}
    >
      <div className="flex items-start justify-between gap-4">
        <InsightIllustration type={insight.type} />
        <div className="flex items-center gap-2">
          {updated ? <StatusBadge>Actualizado</StatusBadge> : null}
          <ChevronRight className="h-4 w-4 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
        </div>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
        {insightTypeLabel(insight.type)}
      </p>
      <h3 className="mt-2 font-heading text-lg font-semibold leading-snug text-text">
        <DiscreetValue discrete={discreet}>{insight.title}</DiscreetValue>
      </h3>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-secondary">
        <DiscreetValue discrete={discreet}>{insight.body}</DiscreetValue>
      </p>
    </button>
  );
}

function InsightDetailView({
  detail,
  evidence,
  loadState,
  errorMessage,
  discreet,
  isUpdated,
  activeMutation,
  feedbackMessage,
  onBack,
  onRetry,
  onDismiss,
  onUseful,
  onPrimaryAction,
}: {
  detail: InsightDetail | null;
  evidence: InsightEvidence | null;
  loadState: LoadState;
  errorMessage: string | null;
  discreet: boolean;
  isUpdated: boolean;
  activeMutation: string | null;
  feedbackMessage: string | null;
  onBack: () => void;
  onRetry: () => void;
  onDismiss: () => void;
  onUseful: () => void;
  onPrimaryAction: () => void;
}) {
  if (loadState === "loading") return <LoadingBlock label="Reuniendo la evidencia" />;
  if (loadState === "error" || !detail || !evidence) {
    return <ErrorState description={errorMessage ?? undefined} onRetry={onRetry} />;
  }

  const insight = detail.insight;
  const action = parseInsightAction(insight.action);
  const actionLabel = readString(insight.metadata, "action_label") ?? actionLabelFor(action?.type);
  const updated = isUpdated || insight.status === "outdated";

  return (
    <article className="space-y-5">
      <button
        type="button"
        className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Descubrimientos
      </button>

      {updated ? (
        <section className="flex items-start gap-3 rounded-lg border border-info/25 bg-info-subtle/45 p-4">
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-info" />
          <div>
            <p className="text-sm font-semibold text-text">Este descubrimiento fue actualizado</p>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Cambiaron datos de origen. Conservamos la trazabilidad y te mostramos la versión vigente.
            </p>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-bg-surface-raised p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-brand">
                {insightTypeLabel(insight.type)}
              </span>
              <StatusBadge>{formatPeriod(insight.period_start, insight.period_end)}</StatusBadge>
            </div>
            <h2 className="mt-4 font-heading text-2xl font-semibold leading-tight text-text sm:text-3xl">
              <DiscreetValue discrete={discreet}>{insight.title}</DiscreetValue>
            </h2>
            <p className="mt-4 text-base leading-7 text-text-secondary">
              <DiscreetValue discrete={discreet}>{insight.body}</DiscreetValue>
            </p>
          </div>
          <InsightIllustration type={insight.type} large />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-semibold text-text">De dónde sale</h3>
                <p className="text-sm text-text-secondary">Datos confirmados usados para esta señal.</p>
              </div>
            </div>
            <p className="mt-5 rounded-lg bg-bg-surface px-4 py-3 text-sm leading-6 text-text-secondary">
              <DiscreetValue discrete={discreet}>{evidence.evidence_text}</DiscreetValue>
            </p>
            <FactsGrid facts={evidence.source_facts} discreet={discreet} />
          </section>

          {evidence.related_movements.length > 0 ? (
            <section className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-heading text-lg font-semibold text-text">Movimientos relacionados</h3>
                  <p className="mt-1 text-sm text-text-secondary">Solo registros confirmados que sostienen este descubrimiento.</p>
                </div>
                <ListChecks className="h-5 w-5 text-brand" />
              </div>
              <div className="mt-4 divide-y divide-border/70">
                {evidence.related_movements.slice(0, 8).map((movement) => (
                  <EvidenceMovementRow key={movement.id} movement={movement} discreet={discreet} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-brand/20 bg-brand-subtle/45 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-surface-raised text-brand shadow-xs">
              <Lightbulb className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-heading text-lg font-semibold text-text">Un siguiente paso pequeño</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Tú decides si actuar. Ver este descubrimiento nunca modifica saldos ni movimientos.
            </p>
            {action ? (
              <Button
                className="mt-5 w-full"
                loading={activeMutation === "action"}
                icon={<ArrowRight className="h-4 w-4" />}
                onClick={onPrimaryAction}
              >
                {actionLabel}
              </Button>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs">
            <h3 className="font-heading text-base font-semibold text-text">¿Te sirvió?</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Tu respuesta ajusta qué señales priorizamos, sin cambiar tus datos financieros.
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                variant="secondary"
                loading={activeMutation === "useful"}
                icon={<Check className="h-4 w-4" />}
                onClick={onUseful}
              >
                Sí, me sirvió
              </Button>
              <Button
                variant="ghost"
                loading={activeMutation === "dismiss"}
                icon={<X className="h-4 w-4" />}
                onClick={onDismiss}
              >
                No mostrar algo así
              </Button>
            </div>
            {feedbackMessage ? (
              <p className="mt-4 rounded-lg bg-bg-surface px-3 py-2 text-sm leading-5 text-text-secondary" role="status">
                {feedbackMessage}
              </p>
            ) : null}
          </section>

          <section className="flex items-start gap-3 rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <div>
              <h3 className="text-sm font-semibold text-text">Trazable y corregible</h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Si corriges un movimiento, Manzana recalcula la señal y marca la versión anterior como actualizada.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </article>
  );
}

function FactsGrid({ facts, discreet }: { facts: Record<string, unknown>; discreet: boolean }) {
  const entries = Object.entries(facts)
    .filter(([, value]) => isCompactFact(value))
    .slice(0, 6);
  if (entries.length === 0) return null;

  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-border/80 px-4 py-3">
          <dt className="text-xs font-medium text-text-muted">{factLabel(key)}</dt>
          <dd className="mt-1 text-sm font-semibold text-text">
            <DiscreetValue discrete={discreet}>{formatFactValue(key, value)}</DiscreetValue>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EvidenceMovementRow({
  movement,
  discreet,
}: {
  movement: InsightEvidenceMovement;
  discreet: boolean;
}) {
  const title = movement.merchant || movement.description || movementTypeLabel(movement.type);
  const negative = ["gasto", "pago_deuda", "prestamo_dado", "pago_recurrente"].includes(movement.type);
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text">
          <DiscreetValue discrete={discreet}>{title}</DiscreetValue>
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {formatMovementDate(movement.occurred_at)}
          {movement.category_id ? ` · ${categoryLabels[movement.category_id]}` : ""}
        </p>
      </div>
      <span className={cn("shrink-0 text-sm font-semibold tabular-nums", negative ? "text-text" : "text-success")}>
        <DiscreetValue discrete={discreet}>
          {`${negative ? "- " : "+ "}${formatMoney(movement.amount, movement.currency)}`}
        </DiscreetValue>
      </span>
    </div>
  );
}

function InsightIllustration({ type, large = false }: { type: InsightType; large?: boolean }) {
  const iconClass = large ? "h-9 w-9" : "h-5 w-5";
  const shellClass = large ? "h-20 w-20 rounded-2xl" : "h-11 w-11 rounded-xl";
  return (
    <div className={cn("flex shrink-0 items-center justify-center bg-brand-subtle text-brand", shellClass)}>
      <InsightIconGlyph type={type} className={iconClass} />
    </div>
  );
}

function StatusBadge({ children }: { children: string }) {
  return <span className="rounded-full bg-info-subtle px-2.5 py-1 text-xs font-semibold text-info">{children}</span>;
}

function InsightIconGlyph({ type, className }: { type: InsightType; className: string }) {
  if (["debt", "recurring"].includes(type)) return <CalendarDays className={className} />;
  if (["free_money", "box_saving", "projection"].includes(type)) return <WalletCards className={className} />;
  if (["progress", "learning_progress"].includes(type)) return <TrendingUp className={className} />;
  if (type === "data_quality") return <FileCheck2 className={className} />;
  if (type === "anomaly") return <CircleDollarSign className={className} />;
  return <Compass className={className} />;
}

function insightTypeLabel(type: InsightType): string {
  const labels: Record<InsightType, string> = {
    learning_progress: "Aprendiendo contigo",
    comparative: "Comparación",
    category_concentration: "Categorías",
    temporal_pattern: "Patrón de tiempo",
    anomaly: "Algo distinto",
    projection: "Proyección",
    free_money: "Dinero libre",
    recurring: "Pago que viene",
    debt: "Deuda",
    box_saving: "Dinero separado",
    contextual: "Contexto",
    progress: "Progreso",
    data_quality: "Calidad de datos",
  };
  return labels[type];
}

function movementTypeLabel(type: InsightEvidenceMovement["type"]): string {
  return type.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function actionLabelFor(type: InsightActionType | undefined): string {
  const labels: Record<string, string> = {
    view_movements: "Ver movimientos relacionados",
    assign_account: "Completar cuenta",
    watch_category: "Ver la categoría",
    review_debt: "Revisar deuda",
    confirm_recurring: "Revisar pago",
    view_money: "Entender mi dinero",
    dismiss: "No mostrar esto",
  };
  return type ? labels[String(type)] ?? "Revisar" : "Revisar";
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatPeriod(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return "Periodo analizado";
  const formatter = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" });
  if (startDate.toDateString() === endDate.toDateString()) return formatter.format(startDate);
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

function formatMovementDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(amount: number, currency: "PEN" | "USD"): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  })
    .format(Math.abs(Number(amount)))
    .replace("PEN", "S/");
}

function isCompactFact(value: unknown): boolean {
  return ["string", "number", "boolean"].includes(typeof value);
}

function factLabel(key: string): string {
  const labels: Record<string, string> = {
    total_amount: "Monto total",
    current_amount: "Monto actual",
    previous_amount: "Periodo anterior",
    change_percent: "Cambio",
    movement_count: "Movimientos",
    current_count: "Movimientos actuales",
    previous_count: "Movimientos anteriores",
    category: "Categoría",
    free_money: "Dinero libre",
    reserved_amount: "Dinero separado",
    commitment_amount: "Compromisos",
    days_until_due: "Días para el pago",
  };
  return labels[key] ?? key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatFactValue(key: string, value: unknown): string {
  if (typeof value === "number") {
    if (key.includes("percent") || key.includes("ratio")) return `${formatNumber(value)}%`;
    if (key.includes("amount") || key.includes("money") || key.includes("balance")) return `S/ ${formatNumber(value)}`;
    return formatNumber(value);
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(value);
}

function toUiError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return "No pude cargar los descubrimientos. Intenta de nuevo en un momento.";
}
