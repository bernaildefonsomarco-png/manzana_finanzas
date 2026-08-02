"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Compass, EyeOff, ThumbsDown, ThumbsUp } from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { useDiscreetMode } from "@/shared/privacy/discreet-mode-context";
import { buildMovementPrefillHref } from "@/shared/movements/movement-prefill";
import { Button } from "@/ui/primitivas/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import {
  getInsightDetail,
  getInsightEvidence,
  interactWithInsight,
  listInsights,
  setInsightTypeMuted,
} from "./insights-api";
import type { InsightEvidence, PublicInsight } from "./insights-types";
import { parseInsightAction } from "./insights-types";

type Props = { onSignOut?: () => void; onNavigate?: (view: AppView) => void };

export function InsightsScreen(props: Props) {
  const [rows, setRows] = useState<PublicInsight[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [history, setHistory] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void listInsights(history).then((next) => {
      if (!active) return;
      setRows(next);
      setState("ready");
    }).catch(() => {
      if (active) setState("error");
    });
    return () => { active = false; };
  }, [history, revision]);
  const reload = () => setRevision((value) => value + 1);

  return (
    <AppShell title="Descubrimientos" subtitle="Hechos que salen de tus propios datos." activeView="insights" {...props}>
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">Hasta cinco hallazgos vigentes, sin consejos ni comparaciones con otras personas.</p>
          <Button variant="secondary" size="sm" onClick={() => { setState("loading"); setHistory((value) => !value); }}>
            {history ? "Ver actuales" : "Ver los anteriores"}
          </Button>
        </div>
        {state === "loading" ? <LoadingBlock label="Cargando descubrimientos" /> : null}
        {state === "error" ? <ErrorState onRetry={reload} /> : null}
        {state === "ready" && rows.length === 0 ? (
          <EmptyState icon={<Compass className="h-5 w-5" />} title="Por ahora no tengo nada nuevo que contarte" description="Cuando haya un hecho con evidencia suficiente, aparecera aqui." />
        ) : null}
        {state === "ready" ? (
          <section className="space-y-4" aria-label="Descubrimientos actuales">
            {rows.map((insight) => <InsightCard key={insight.id} insight={insight} onChanged={reload} />)}
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}

function InsightCard({ insight, onChanged }: { insight: PublicInsight; onChanged: () => void }) {
  const { discreet } = useDiscreetMode();
  const hidden = discreet && insight.risk_level === "sensitive";
  if (hidden) return null;
  return (
    <article className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs" aria-labelledby={`insight-${insight.id}`}>
      {insight.changed_notice ? <p className="mb-3 rounded-md bg-warning-subtle px-3 py-2 text-sm text-text">{insight.changed_notice}</p> : null}
      <h2 id={`insight-${insight.id}`} className="font-heading text-lg font-semibold text-text">{insight.title}</h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{discreet ? hideMoney(insight.body) : insight.body}</p>
      <p className="mt-3 text-sm font-medium text-text">{discreet ? hideMoney(insight.evidence_text) : insight.evidence_text}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-text hover:bg-bg-surface" href={`/descubrimientos/${insight.id}`}>De donde sale esto</Link>
        <ActionLink insight={insight} />
        <Button variant="ghost" size="sm" icon={<ThumbsUp className="h-4 w-4" />} onClick={() => void feedback(insight.id, "util", onChanged)}>Me sirve</Button>
        <Button variant="ghost" size="sm" icon={<ThumbsDown className="h-4 w-4" />} onClick={() => void feedback(insight.id, "no_util", onChanged)}>No me sirve</Button>
        <Button variant="ghost" size="sm" onClick={() => void dismiss(insight.id, onChanged)}>Descartar</Button>
        <Button variant="ghost" size="sm" icon={<EyeOff className="h-4 w-4" />} onClick={() => void mute(insight, onChanged)}>No mostrar este tipo</Button>
      </div>
    </article>
  );
}

function ActionLink({ insight }: { insight: PublicInsight }) {
  const action = parseInsightAction(insight.action);
  const destination = useMemo(() => actionDestination(action, insight), [action, insight]);
  if (!destination) return null;
  return <Link className="inline-flex h-9 items-center rounded-md bg-brand px-3 text-sm font-medium text-text-inverse hover:bg-brand-hover" href={destination.href}>{destination.label}</Link>;
}

export function InsightDetailScreen({ id, ...props }: Props & { id: string }) {
  const [insight, setInsight] = useState<PublicInsight | null>(null);
  const [evidence, setEvidence] = useState<InsightEvidence | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const { discreet } = useDiscreetMode();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.all([getInsightDetail(id), getInsightEvidence(id)]).then(([detail, facts]) => {
      if (!active) return;
      setInsight(detail.insight);
      setEvidence(facts);
      setState("ready");
      void interactWithInsight(id, "seen");
    }).catch((error: unknown) => {
      if (!active) return;
      setState(error && typeof error === "object" && "status" in error && error.status === 404 ? "missing" : "error");
    });
    return () => { active = false; };
  }, [id, revision]);

  return (
    <AppShell title="De donde sale esto" activeView="insights" {...props}>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <Link className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-text-brand" href="/descubrimientos"><ArrowLeft className="h-4 w-4" />Volver a descubrimientos</Link>
        {state === "loading" ? <LoadingBlock label="Cargando evidencia" /> : null}
        {state === "missing" ? <EmptyState title="Ese descubrimiento ya no esta disponible" description="Puedes volver a ver los actuales." /> : null}
        {state === "error" ? <ErrorState onRetry={() => setRevision((value) => value + 1)} /> : null}
        {state === "ready" && insight && evidence ? (
          <article className="rounded-xl border border-border bg-bg-surface-raised p-6 shadow-xs">
            <h1 className="font-heading text-2xl font-semibold text-text">{insight.title}</h1>
            {insight.changed_notice ? <p className="mt-3 rounded-md bg-warning-subtle px-3 py-2 text-sm">{insight.changed_notice}</p> : null}
            <dl className="mt-6 divide-y divide-border">
              <EvidenceRow term="Que mire" value={`${evidence.source_entity_ids.length} referencias entre ${evidence.period.start} y ${evidence.period.end}`} />
              <EvidenceRow term="Que no conte" value={exclusions(evidence.evidence)} />
              <EvidenceRow term="La cuenta" value={discreet ? hideMoney(evidence.evidence_text) : evidence.evidence_text} />
            </dl>
            {evidence.related_movements.length > 0 ? (
              <div className="mt-6">
                <h2 className="font-heading text-base font-semibold">Movimientos que lo sostienen</h2>
                <ul className="mt-3 divide-y divide-border" aria-label="Movimientos usados">
                  {evidence.related_movements.map((movement) => (
                    <li key={movement.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <span>{movement.merchant ?? movement.description ?? "Movimiento"}<br /><span className="text-text-secondary">{movement.occurred_at.slice(0, 10)}</span></span>
                      <span>{discreet ? "S/•••" : `${movement.currency === "PEN" ? "S/" : "US$"}${movement.amount.toFixed(2)}`}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        ) : null}
      </main>
    </AppShell>
  );
}

function EvidenceRow({ term, value }: { term: string; value: string }) {
  return <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]"><dt className="font-medium text-text">{term}</dt><dd className="text-sm text-text-secondary">{value}</dd></div>;
}

function exclusions(evidence: Record<string, unknown>): string {
  const value = evidence.exclusions;
  return Array.isArray(value) && value.length > 0 ? value.join(", ") : "No hubo exclusiones adicionales declaradas.";
}

async function feedback(id: string, value: "util" | "no_util", reload: () => void) {
  await interactWithInsight(id, "feedback", { value });
  reload();
}

async function mute(insight: PublicInsight, reload: () => void) {
  await setInsightTypeMuted(insight.type, true);
  reload();
}

async function dismiss(id: string, reload: () => void) {
  await interactWithInsight(id, "dismiss", { reason: "user_dismissed" });
  reload();
}

export function actionDestination(action: ReturnType<typeof parseInsightAction>, insight: PublicInsight): { href: string; label: string } | null {
  if (!action) return null;
  const prefillHref = buildMovementPrefillHref({
    amount: typeof action.filters?.amount === "number" || typeof action.filters?.amount === "string"
      ? action.filters.amount
      : "",
    categoryId: typeof action.filters?.category_id === "string" ? action.filters.category_id : "",
    date: typeof action.filters?.date === "string" ? action.filters.date : "",
    origin: "descubrimiento",
  });
  if (prefillHref) return { href: prefillHref, label: "Registrar gasto" };
  const filters = new URLSearchParams();
  for (const [key, value] of Object.entries(action.filters ?? {})) {
    if (["string", "number", "boolean"].includes(typeof value)) filters.set(key, String(value));
  }
  if (action.type === "adjust_budget") return { href: `/presupuestos${filters.size ? `?${filters}` : ""}`, label: "Ver presupuesto" };
  if (action.type === "review_debt") return { href: "/deudas", label: "Ver deuda" };
  if (action.type === "confirm_recurring") return { href: "/pagos-que-vienen", label: "Revisar pago" };
  if (["view_money", "create_box", "link_goal"].includes(action.type)) return { href: "/mi-dinero", label: "Ver mi dinero" };
  if (["view_movements", "assign_account", "watch_category"].includes(action.type)) return { href: `/movimientos${filters.size ? `?${filters}` : ""}`, label: "Ver movimientos" };
  if (action.type === "dismiss") return null;
  return { href: `/descubrimientos/${insight.id}`, label: "Ver detalle" };
}

function hideMoney(value: string): string {
  return value.replace(/(?:S\/|US\$)\s*-?[\d.,]+/g, "S/•••");
}
