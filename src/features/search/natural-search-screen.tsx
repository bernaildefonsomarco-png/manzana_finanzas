"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  FileSearch,
  Info,
  ListChecks,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { ApiClientError } from "@/features/movements/movements-api";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input, Select } from "@/shared/ui/field";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { cn } from "@/shared/ui/cn";
import {
  runNaturalSearch,
  type NaturalSearchResult,
  type NaturalSearchScope,
  type NaturalSearchSource,
} from "./natural-search-api";

const exampleQueries = [
  "Que movimientos hice hoy?",
  "Puedes decirme la hora de cada uno?",
  "Cuanto tengo libre?",
  "Que pagos vienen este mes?",
  "Cuanto le debo a Luis?",
  "Que recuerdas de mis preferencias?",
  "Que sabes de mi forma de gastar?",
  "Que gaste el ultimo viernes de hace 4 meses?",
];

const scopeOptions: Array<{ value: NaturalSearchScope; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "movements", label: "Movimientos" },
  { value: "money", label: "Mi Dinero" },
  { value: "pending", label: "Pendientes" },
  { value: "debts", label: "Deudas" },
  { value: "recurring", label: "Pagos que vienen" },
  { value: "memory", label: "Memoria" },
];

type LoadState = "idle" | "loading" | "loaded" | "error";

export function NaturalSearchScreen({
  initialQuery = "",
  onOpenMovementsFilter,
  onSignOut,
  onNavigate,
}: {
  initialQuery?: string;
  onOpenMovementsFilter?: (query: string) => void;
  onSignOut?: () => void;
  onNavigate?: (view: AppView) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<NaturalSearchScope>("all");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [result, setResult] = useState<NaturalSearchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = query.trim().length >= 2 && loadState !== "loading";
  const interpretedPeriod = result?.query_interpretation?.date_range?.label;
  const primaryCta = useMemo(() => {
    if (result?.mode !== "action_redirect") return null;
    return inferWriteRedirect(result.query);
  }, [result]);
  const movementListCta = useMemo(() => {
    if (!result || result.mode !== "answer") return null;
    const hasMovementSources = result.sources.some(
      (source) => source.type === "movement"
    );
    if (!hasMovementSources) return null;
    return {
      label: "Ver movimientos filtrados",
      query: result.query,
    };
  }, [result]);

  async function executeSearch(nextQuery: string, nextScope: NaturalSearchScope) {
    const trimmed = nextQuery.trim();
    if (trimmed.length < 2 || loadState === "loading") return;
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const nextResult = await runNaturalSearch({
        query: trimmed,
        scope: nextScope,
      });
      setResult(nextResult);
      setLoadState("loaded");
    } catch (error) {
      setResult(null);
      setLoadState("error");
      setErrorMessage(toUiError(error));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    await executeSearch(query, scope);
  }

  useEffect(() => {
    const trimmed = initialQuery.trim();
    if (trimmed.length < 2) return;

    const timeoutId = window.setTimeout(() => {
      void executeSearch(trimmed, scope);
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // executeSearch intentionally reads the current load state; this effect only
    // exists to run a query received from the global topbar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, scope]);

  function runExample(nextQuery: string) {
    setQuery(nextQuery);
  }

  function handleRedirect() {
    if (!primaryCta) return;
    onNavigate?.(primaryCta.view);
  }

  function handleOpenMovementList() {
    if (!movementListCta) return;
    onOpenMovementsFilter?.(movementListCta.query);
  }

  return (
    <AppShell
      title="Busqueda natural"
      subtitle="Pregunta algo concreto sobre tu dinero. Solo lectura, con fuentes."
      onSignOut={onSignOut}
      activeView="search"
      onNavigate={onNavigate}
      searchDefaultValue={query}
    >
      <div className="mx-auto flex max-w-[980px] flex-col gap-6 pb-10 pt-2">
        <section className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-brand">
                <FileSearch className="h-4 w-4" />
                Lupa inteligente
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Pregunta algo sobre tu dinero..."
                    aria-label="Pregunta algo sobre tu dinero"
                    className="h-12 text-base"
                  />
                  <Select
                    value={scope}
                    onChange={(event) =>
                      setScope(event.target.value as NaturalSearchScope)
                    }
                    aria-label="Alcance de busqueda"
                    className="h-12"
                  >
                    {scopeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="submit"
                    loading={loadState === "loading"}
                    disabled={!canSubmit}
                    icon={<Search className="h-4 w-4" />}
                    className="h-12"
                  >
                    Buscar
                  </Button>
                </div>
              </form>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {exampleQueries.map((example) => (
              <button
                key={example}
                type="button"
                className="rounded-full border border-border bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-bg-surface hover:text-text"
                onClick={() => runExample(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        {loadState === "idle" ? (
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title="Haz una pregunta concreta"
            description="Puedes buscar movimientos, revisar dinero libre, entender pendientes o pedir una explicacion corta con fuentes."
            className="min-h-72"
          />
        ) : null}

        {loadState === "error" ? (
          <ErrorState
            title="No pude responder esa busqueda"
            description={errorMessage ?? "Intenta de nuevo en un momento."}
            onRetry={() => {
              if (query.trim()) {
                void runNaturalSearch({ query: query.trim(), scope })
                  .then((nextResult) => {
                    setResult(nextResult);
                    setLoadState("loaded");
                  })
                  .catch((error) => setErrorMessage(toUiError(error)));
              }
            }}
          />
        ) : null}

        {loadState === "loaded" && result ? (
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-normal text-text-muted">
                    Respuesta
                  </p>
                  <h2 className="mt-1 font-heading text-xl font-semibold text-text">
                    {answerTitle(result)}
                  </h2>
                </div>
                <StatusPill mode={result.mode} />
              </div>

              <p className="mt-5 whitespace-pre-line text-base leading-7 text-text">
                {result.answer.response_text}
              </p>

              {result.answer.follow_up_question ? (
                <p className="mt-4 rounded-lg bg-brand-subtle px-4 py-3 text-sm text-text-secondary">
                  {result.answer.follow_up_question}
                </p>
              ) : null}

              {primaryCta ? (
                <div className="mt-5">
                  <Button
                    type="button"
                    variant="primary"
                    icon={<ArrowRight className="h-4 w-4" />}
                    onClick={handleRedirect}
                  >
                    {primaryCta.label}
                  </Button>
                </div>
              ) : null}

              {movementListCta ? (
                <div className="mt-5">
                  <Button
                    type="button"
                    variant="secondary"
                    icon={<ArrowRight className="h-4 w-4" />}
                    onClick={handleOpenMovementList}
                  >
                    {movementListCta.label}
                  </Button>
                </div>
              ) : null}
            </Card>

            <aside className="space-y-4">
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-brand" />
                  <h3 className="font-heading text-sm font-semibold text-text">
                    Interpretacion
                  </h3>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <InfoRow label="Tipo" value={formatKind(result)} />
                  <InfoRow
                    label="Periodo"
                    value={interpretedPeriod ?? "No especificado"}
                  />
                  <InfoRow
                    label="Certeza"
                    value={humanCertainty(
                      result.query_interpretation?.confidence ??
                        result.answer.confidence,
                    )}
                  />
                </dl>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand" />
                  <h3 className="font-heading text-sm font-semibold text-text">
                    Limites seguros
                  </h3>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                  {result.data_limits.map((limit) => (
                    <li key={limit} className="leading-5">
                      {limit}
                    </li>
                  ))}
                </ul>
              </Card>
            </aside>

            <Card className="p-5 lg:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-brand" />
                  <h3 className="font-heading text-sm font-semibold text-text">
                    Fuentes usadas
                  </h3>
                </div>
                <span className="text-xs text-text-muted">
                  {result.sources.length} fuentes
                </span>
              </div>
              {result.sources.length > 0 ? (
                <div className="mt-4 divide-y divide-border">
                  {result.sources.map((source) => (
                    <SourceRow key={source.id} source={source} />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-text-secondary">
                  Esta respuesta uso resumenes seguros o no encontro fuentes
                  concretos para citar.
                </p>
              )}
              {result.tool_results?.some((tool) => tool.warnings.length > 0) ? (
                <div className="mt-4 rounded-lg bg-warning-subtle px-4 py-3 text-sm text-text-secondary">
                  {result.tool_results
                    .flatMap((tool) => tool.warnings)
                    .slice(0, 2)
                    .join(" ")}
                </div>
              ) : null}
            </Card>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function humanCertainty(confidence: number): string {
  if (confidence >= 0.9) return "Sustentado por datos claros";
  if (confidence >= 0.72) return "Interpretación razonable";
  return "Necesita una aclaración";
}

function StatusPill({ mode }: { mode: NaturalSearchResult["mode"] }) {
  const isRedirect = mode === "action_redirect";
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium",
        isRedirect
          ? "bg-warning-subtle text-text"
          : "bg-brand-subtle text-brand"
      )}
    >
      {isRedirect ? "Accion protegida" : "Solo lectura"}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium text-text">{value}</dd>
    </div>
  );
}

function SourceRow({ source }: { source: NaturalSearchSource }) {
  const date = source.occurred_at ?? source.due_at ?? null;
  const detail = source.status ?? source.source_detail ?? source.type;

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text">{source.label}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          {date ? formatDate(date) : "Sin fecha"} - {formatSourceType(detail)}
        </p>
      </div>
      <p className="shrink-0 text-sm font-medium tabular-nums text-text">
        {source.amount === null
          ? "Sin monto"
          : formatMoney(source.amount, source.currency)}
      </p>
    </div>
  );
}

function answerTitle(result: NaturalSearchResult): string {
  if (result.mode === "action_redirect") return "Esto necesita un flujo seguro";
  if (result.answer.answer_kind === "balance_snapshot") return "Resumen de dinero";
  if (result.answer.answer_kind === "pending_summary") return "Pendientes";
  if (result.answer.answer_kind === "movement_summary") return "Movimientos encontrados";
  if (result.answer.answer_kind === "debt_summary") return "Deudas y prestamos";
  if (result.answer.answer_kind === "recurring_summary") return "Pagos que vienen";
  if (result.answer.answer_kind === "memory_summary") return "Memoria util";
  return "Resultado";
}

function formatKind(result: NaturalSearchResult): string {
  const kind = result.query_interpretation?.kind ?? result.answer.answer_kind;
  const labels: Record<string, string> = {
    balance_snapshot: "Dinero libre",
    movement_search: "Movimientos",
    pending_summary: "Pendientes",
    debt_summary: "Deudas",
    recurring_summary: "Pagos que vienen",
    financial_memory_search: "Memoria financiera",
    memory_summary: "Memoria financiera",
    unsupported: "No soportado",
  };
  return labels[kind] ?? kind;
}

function formatSourceType(value: string) {
  return value.replace(/_/g, " ");
}

function inferWriteRedirect(query: string): { label: string; view: AppView } {
  const normalized = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/\b(pendiente|pendientes|confirma|confirmar|descarta|descartar)\b/.test(normalized)) {
    return { label: "Abrir Pendientes", view: "pending" };
  }

  return { label: "Abrir Movimientos", view: "movements" };
}

function formatMoney(amount: number, currency: "PEN" | "USD") {
  const symbol = currency === "USD" ? "$" : "S/";
  return `${symbol}${amount.toFixed(2)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toUiError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return "No se pudo completar la busqueda.";
}
