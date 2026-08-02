"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Brain, RotateCcw, Trash2 } from "lucide-react";
import { AppShell } from "@/features/app-shell/app-shell";
import { Button } from "@/ui/primitivas/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import {
  correctMemory,
  forgetAllMemory,
  forgetMemory,
  getMemoryDetail,
  listMemory,
  listProfileCandidates,
  markMemoryViewed,
  reactivateMemory,
  resolveCandidate,
  undoMemory,
} from "./memory-api";
import type { MemoryEvent, MemoryGroups, MemoryItem, MemoryScope, ProfileCandidate } from "./memory-types";

const EMPTY: MemoryGroups = { profile: [], classification: [], preference: [], inactive: [] };

export function MemoryScreen({ includeInactive = false, scope }: { includeInactive?: boolean; scope?: MemoryScope }) {
  const [groups, setGroups] = useState(EMPTY);
  const [candidate, setCandidate] = useState<ProfileCandidate | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [revision, setRevision] = useState(0);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([listMemory(includeInactive, scope), listProfileCandidates()])
      .then(([memory, candidates]) => {
        if (!active) return;
        setGroups(memory);
        setCandidate(candidates[0] ?? null);
        setState("ready");
      })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [includeInactive, scope, revision]);

  const reload = (notice?: string) => {
    setMessage(notice ?? null);
    setRevision((value) => value + 1);
  };
  const activeCount = groups.profile.length + groups.classification.length + groups.preference.length;

  return (
    <AppShell title="Lo que sé de ti" subtitle="Todo esto lo puedes corregir o borrar." activeView="settings">
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <Link href="/configuracion" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-text-brand">
          <ArrowLeft className="h-4 w-4" />Volver a configuración
        </Link>
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filtros de memoria">
          <FilterLink href="/configuracion/memoria" active={!includeInactive && !scope}>Todo</FilterLink>
          <FilterLink href="/configuracion/memoria?clase=profile" active={scope === "profile"}>Sobre ti</FilterLink>
          <FilterLink href="/configuracion/memoria?clase=classification" active={scope === "classification"}>Clasificaciones</FilterLink>
          <FilterLink href="/configuracion/memoria?clase=preference" active={scope === "preference"}>Cómo usas Manzana</FilterLink>
          <FilterLink href="/configuracion/memoria?inactivos=1" active={includeInactive}>Dejé de usar estas</FilterLink>
        </nav>

        {message ? <p role="status" className="mb-4 rounded-lg bg-success-subtle px-4 py-3 text-sm text-text">{message}</p> : null}
        {state === "loading" ? <LoadingBlock label="Cargando lo aprendido" /> : null}
        {state === "error" ? <ErrorState onRetry={() => setRevision((value) => value + 1)} /> : null}
        {state === "ready" && candidate && !includeInactive ? (
          <CandidateCard candidate={candidate} onChanged={reload} />
        ) : null}
        {state === "ready" && activeCount === 0 && groups.inactive.length === 0 ? (
          <EmptyState
            icon={<Brain className="h-5 w-5" />}
            title="Todavía no sé nada de ti"
            description="A medida que registres, iré aprendiendo. Todo lo que aprenda aparecerá aquí."
          />
        ) : null}
        {state === "ready" ? (
          <div className="space-y-7">
            {!includeInactive ? <MemorySection title="Sobre ti" items={groups.profile} onChanged={reload} /> : null}
            {!includeInactive ? <MemorySection title="Cómo clasifico tus gastos" items={groups.classification} onChanged={reload} /> : null}
            {!includeInactive ? <MemorySection title="Cómo usas Manzana" items={groups.preference} onChanged={reload} /> : null}
            {includeInactive ? <MemorySection title="Dejé de usar estas" items={groups.inactive} onChanged={reload} inactive /> : null}
          </div>
        ) : null}

        <section className="mt-10 rounded-xl border border-danger/30 bg-bg-surface-raised p-5" aria-labelledby="forget-all-title">
          <h2 id="forget-all-title" className="font-heading text-lg font-semibold text-text">Olvidar todo lo aprendido</h2>
          <p className="mt-2 text-sm text-text-secondary">Es irreversible. Puedes <Link className="text-text-brand underline" href="/api/v1/privacy/export">exportar tus datos antes</Link>.</p>
          <label className="mt-4 block text-sm font-medium text-text" htmlFor="memory-confirmation">Escribe OLVIDAR para continuar</label>
          <input id="memory-confirmation" className="mt-2 h-10 w-full max-w-sm rounded-md border border-border bg-bg-surface px-3 text-sm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          <Button className="mt-3" variant="danger" disabled={confirmation !== "OLVIDAR"} icon={<Trash2 className="h-4 w-4" />} onClick={() => void forgetAllMemory(confirmation).then(() => { setConfirmation(""); reload("Olvidé todo lo aprendido."); })}>Olvidar todo</Button>
        </section>
      </main>
    </AppShell>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link aria-current={active ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-sm ${active ? "border-brand bg-brand-subtle text-text-brand" : "border-border text-text-secondary"}`} href={href}>{children}</Link>;
}

function MemorySection({ title, items, onChanged, inactive = false }: { title: string; items: MemoryItem[]; onChanged: (message?: string) => void; inactive?: boolean }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={`memory-${title}`}>
      <h2 id={`memory-${title}`} className="mb-3 font-heading text-lg font-semibold text-text">{title} <span className="text-text-secondary">({items.length})</span></h2>
      <div className="space-y-3">{items.map((item) => <MemoryCard key={item.id} item={item} onChanged={onChanged} inactive={inactive} />)}</div>
    </section>
  );
}

function MemoryCard({ item, onChanged, inactive }: { item: MemoryItem; onChanged: (message?: string) => void; inactive: boolean }) {
  return (
    <article className="rounded-xl border border-border bg-bg-surface-raised p-5">
      <h3 className="font-medium text-text">{item.statement}</h3>
      <p className="mt-2 text-sm text-text-secondary">A favor: {item.positive_evidence_count} · En contra: {item.negative_evidence_count}{inactive ? ` · Estado: ${item.status}` : ""}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-text" href={`/configuracion/memoria/${item.id}`}>Ver evidencia</Link>
        {!inactive ? <Button variant="secondary" size="sm" onClick={() => void correct(item, onChanged)}>Corregir</Button> : null}
        {!inactive ? <Button variant="ghost" size="sm" onClick={() => void forget(item, onChanged)}>Olvidar</Button> : null}
        {inactive && item.can_reactivate ? <Button variant="secondary" size="sm" onClick={() => void reactivateMemory(item).then(() => onChanged("Aprendizaje reactivado."))}>Reactivar</Button> : null}
      </div>
      {inactive && !item.can_reactivate ? <p className="mt-3 text-xs text-text-secondary">Lo que olvidaste no se reactiva aquí; una nueva clasificación explícita puede volver a enseñármelo.</p> : null}
    </article>
  );
}

function CandidateCard({ candidate, onChanged }: { candidate: ProfileCandidate; onChanged: (message?: string) => void }) {
  return (
    <section className="mb-7 rounded-xl border border-brand/30 bg-brand-subtle p-5" aria-labelledby="candidate-title">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-brand">Algo por confirmar</p>
      <h2 id="candidate-title" className="mt-2 font-heading text-lg font-semibold text-text">{candidate.statement}</h2>
      <p className="mt-2 text-sm text-text-secondary">¿Es correcto? No lo usaré como hecho hasta que lo confirmes.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void resolveCandidate(candidate, "confirm").then(() => onChanged("Hecho confirmado."))}>Sí, es así</Button>
        <Button variant="secondary" size="sm" onClick={() => void correctCandidate(candidate, onChanged)}>No exactamente</Button>
        <Button variant="ghost" size="sm" onClick={() => void resolveCandidate(candidate, "never-ask").then(() => onChanged("No volveré a preguntar esto."))}>No preguntar esto</Button>
      </div>
    </section>
  );
}

async function correct(item: MemoryItem, onChanged: (message?: string) => void) {
  const replacement = window.prompt("¿Cuál es la forma correcta?", item.statement)?.trim();
  if (!replacement || replacement === item.statement) return;
  await correctMemory(item, replacement);
  onChanged("Aprendizaje corregido. El pasado no cambió.");
}

async function forget(item: MemoryItem, onChanged: (message?: string) => void) {
  if (!window.confirm(`Voy a olvidar: ${item.statement}. Los movimientos anteriores no cambiarán.`)) return;
  await forgetMemory(item);
  onChanged("Aprendizaje olvidado. Puedes deshacerlo durante 30 días desde su detalle.");
}

async function correctCandidate(candidate: ProfileCandidate, onChanged: (message?: string) => void) {
  const statement = window.prompt("Cuéntame la forma correcta", candidate.statement)?.trim();
  if (!statement) return;
  await resolveCandidate(candidate, "confirm", statement);
  onChanged("Guardé únicamente lo que confirmaste.");
}

export function MemoryDetailScreen({ id }: { id: string }) {
  const [currentId, setCurrentId] = useState(id);
  const [detail, setDetail] = useState<{ memory: MemoryItem; events: MemoryEvent[] } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void getMemoryDetail(currentId).then(async (value) => {
      await markMemoryViewed(value.memory);
      if (!active) return;
      setDetail(value); setState("ready");
    }).catch((error: unknown) => {
      if (!active) return;
      setState(error && typeof error === "object" && "status" in error && error.status === 404 ? "missing" : "error");
    });
    return () => { active = false; };
  }, [currentId, revision]);

  const replaceMemory = (replacement: MemoryItem) => {
    window.history.replaceState(null, "", `/configuracion/memoria/${replacement.id}`);
    setCurrentId(replacement.id);
    setState("loading");
  };

  return (
    <AppShell title="Un aprendizaje" activeView="settings">
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/configuracion/memoria" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-text-brand"><ArrowLeft className="h-4 w-4" />Volver a memoria</Link>
        {state === "loading" ? <LoadingBlock label="Cargando evidencia" /> : null}
        {state === "missing" ? <EmptyState title="Eso ya no está en mi memoria" description="Puedes volver a ver todo lo aprendido." /> : null}
        {state === "error" ? <ErrorState onRetry={() => setRevision((value) => value + 1)} /> : null}
        {state === "ready" && detail ? <MemoryDetail detail={detail} onChanged={() => setRevision((value) => value + 1)} onReplaced={replaceMemory} /> : null}
      </main>
    </AppShell>
  );
}

function MemoryDetail({ detail, onChanged, onReplaced }: { detail: { memory: MemoryItem; events: MemoryEvent[] }; onChanged: () => void; onReplaced: (memory: MemoryItem) => void }) {
  const { memory, events } = detail;
  return (
    <article className="rounded-xl border border-border bg-bg-surface-raised p-6">
      <h1 className="font-heading text-2xl font-semibold text-text">{memory.statement}</h1>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <Evidence term="A favor" value={`${memory.positive_evidence_count} referencias`} />
        <Evidence term="En contra" value={`${memory.negative_evidence_count} referencias`} />
        <Evidence term="Desde" value={formatDate(memory.created_at)} />
        <Evidence term="Última vez" value={memory.last_used_at ? formatDate(memory.last_used_at) : "Sin uso registrado"} />
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void correctDetail(memory, onReplaced)}>Corregir</Button>
        {memory.active ? <Button variant="ghost" onClick={() => void forget(memory, () => onChanged())}>Olvidar</Button> : null}
        <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => void undoMemory(memory).then(onChanged)}>Deshacer el último cambio</Button>
      </div>
      <section className="mt-8" aria-labelledby="memory-history">
        <h2 id="memory-history" className="font-heading text-lg font-semibold text-text">Historial</h2>
        {events.length === 0 ? <p className="mt-3 text-sm text-text-secondary">Todavía no hay cambios registrados.</p> : (
          <ol className="mt-3 divide-y divide-border">{events.map((event) => <li key={event.id} className="py-3 text-sm"><strong>{event.action}</strong> · {formatDate(event.created_at)} · {event.actor}</li>)}</ol>
        )}
      </section>
    </article>
  );
}

async function correctDetail(item: MemoryItem, onReplaced: (memory: MemoryItem) => void) {
  const statement = window.prompt("¿Cuál es la forma correcta?", item.statement)?.trim();
  if (!statement || statement === item.statement) return;
  const result = await correctMemory(item, statement);
  onReplaced(result.replacement ?? result.memory);
}

function Evidence({ term, value }: { term: string; value: string }) {
  return <div><dt className="text-sm font-medium text-text">{term}</dt><dd className="mt-1 text-sm text-text-secondary">{value}</dd></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" }).format(new Date(value));
}
