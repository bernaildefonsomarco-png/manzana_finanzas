"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { LoadingBlock } from "@/ui/primitivas/states";
import { search, suggestSpelling, type SearchResponse } from "./search-api";

type Props = {
  initialQuery: string;
  onSignOut?: () => void;
  onNavigate?: (view: AppView) => void;
};

// SCR-BUS-02 (38 §8): determinista, sin puntuación ni relevancia
// (RUL-BUS-02, AC-BUS-01). Confirmados y pendientes en grupos separados
// (RUL-BUS-05).
export function SearchScreen({ initialQuery, ...props }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(initialQuery ? "loading" : "idle");

  function handleChange(value: string) {
    setQ(value);
    if (!value.trim()) {
      setState("idle");
      setResponse(null);
    } else {
      setState("loading");
    }
  }

  useEffect(() => {
    if (!q.trim()) return;
    let active = true;
    const timer = setTimeout(() => {
      void search(q)
        .then((data) => {
          if (!active) return;
          setResponse(data);
          setState("ready");
          const noResults =
            data.results &&
            data.results.movements.length === 0 &&
            data.results.pending.length === 0 &&
            data.results.accounts.length === 0 &&
            data.results.debts.length === 0 &&
            data.results.commitments.length === 0;
          if (noResults && data.filters?.text) {
            void suggestSpelling(data.filters.text).then((s) => active && setSuggestion(s));
          } else {
            setSuggestion(null);
          }
        })
        .catch(() => {
          if (active) setState("error");
        });
    }, 150); // 150ms de retardo (17 §): no consulta en cada tecla
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);

  return (
    <AppShell title="Buscar o ir a…" activeView="search" {...props}>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <label htmlFor="search-input" className="sr-only">
          Buscar
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-surface-raised px-4 py-3">
          <SearchIcon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          <input
            id="search-input"
            type="search"
            value={q}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="netflix, julio, > 100…"
            className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-secondary"
          />
        </div>

        {state === "idle" ? (
          <p className="mt-6 text-sm text-text-secondary">Escribe para buscar movimientos, cuentas, deudas y más.</p>
        ) : null}
        {state === "loading" ? <LoadingBlock label="Buscando" className="mt-6" /> : null}
        {state === "error" ? <p className="mt-6 text-sm text-error">No pude buscar ahora. Puedes filtrar los movimientos a mano.</p> : null}

        {state === "ready" && response?.is_question ? (
          <div className="mt-6 rounded-xl border border-border bg-bg-surface-raised p-5">
            <p className="text-sm text-text">Eso es una pregunta, y la puedo responder mejor en la conversación.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/asistente?q=${encodeURIComponent(response.query ?? q)}`}
                className="inline-flex h-9 items-center rounded-md bg-brand px-3 text-sm font-medium text-text-inverse hover:bg-brand-hover"
              >
                Preguntárselo a Manzana
              </Link>
              <span className="text-sm text-text-secondary">o si buscabas movimientos:</span>
              <Link
                href={`/movimientos?q=${encodeURIComponent(response.query ?? q)}`}
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-text hover:bg-bg-surface"
              >
                Buscar &quot;{response.query}&quot;
              </Link>
            </div>
          </div>
        ) : null}

        {state === "ready" && response && !response.is_question && response.filters ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {response.filters.text ? <FilterChip label={response.filters.text} /> : null}
            {response.filters.date_range ? <FilterChip label={response.filters.date_range.label} /> : null}
            {response.filters.amount ? (
              <FilterChip
                label={
                  response.filters.amount.kind === "gt"
                    ? `más de S/${response.filters.amount.amount}`
                    : response.filters.amount.kind === "lt"
                      ? `menos de S/${response.filters.amount.amount}`
                      : `S/${response.filters.amount.amount}`
                }
              />
            ) : null}
          </div>
        ) : null}

        {state === "ready" && response && !response.is_question && response.results ? (
          <SearchResults results={response.results} suggestion={suggestion} query={q} />
        ) : null}
      </main>
    </AppShell>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-8 items-center rounded-full border border-border bg-bg-surface px-3 text-xs font-medium text-text">
      {label}
    </span>
  );
}

function SearchResults({
  results,
  suggestion,
  query,
}: {
  results: NonNullable<SearchResponse["results"]>;
  suggestion: string | null;
  query: string;
}) {
  const totalConfirmed =
    results.movements.length + results.accounts.length + results.categories.length + results.debts.length + results.commitments.length;

  if (totalConfirmed === 0 && results.pending.length === 0) {
    return (
      <div className="mt-6 space-y-3">
        <p className="text-sm text-text">No encontré nada con &quot;{query}&quot;.</p>
        {suggestion ? (
          <p className="text-sm text-text">
            ¿Quisiste decir &quot;{suggestion}&quot;?{" "}
            <Link href={`/buscar?q=${encodeURIComponent(suggestion)}`} className="font-medium text-brand hover:text-brand-hover">
              Buscar {suggestion}
            </Link>
          </p>
        ) : null}
        <div className="flex gap-2">
          <Link href="/movimientos" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-text hover:bg-bg-surface">
            Ver todos los movimientos
          </Link>
          <Link href="/movimientos/nuevo" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-text hover:bg-bg-surface">
            Registrar uno nuevo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6" aria-live="polite">
      {results.movements.length > 0 ? (
        <section aria-label={`Movimientos (${results.movements.length})`}>
          <h2 className="mb-2 text-sm font-semibold text-text">Movimientos ({results.movements.length})</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {results.movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-text">{m.merchant ?? m.description ?? "Movimiento"}</span>
                <span className="font-medium text-text">S/{m.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {results.pending.length > 0 ? (
        <section aria-label={`Sin confirmar (${results.pending.length})`}>
          <h2 className="mb-2 text-sm font-semibold text-text">Sin confirmar ({results.pending.length})</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {results.pending.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-text">{m.merchant ?? m.description ?? "Pendiente"}</span>
                <span className="font-medium text-text">S/{m.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {results.accounts.length + results.categories.length + results.debts.length + results.commitments.length > 0 ? (
        <section aria-label="Otros">
          <h2 className="mb-2 text-sm font-semibold text-text">Otros</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {results.accounts.map((a) => (
              <li key={a.id} className="px-4 py-2.5 text-sm text-text">
                {a.name} · {a.kind}
              </li>
            ))}
            {results.debts.map((d) => (
              <li key={d.id} className="px-4 py-2.5 text-sm text-text">
                {d.name}
                {d.related_person_name ? ` · ${d.related_person_name}` : ""}
              </li>
            ))}
            {results.commitments.map((c) => (
              <li key={c.id} className="px-4 py-2.5 text-sm text-text">
                {c.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="rounded-xl border border-border bg-bg-surface-raised p-4">
        <p className="text-sm text-text-secondary">¿Buscabas algo que no encontraste aquí?</p>
        <Link href={`/asistente?q=${encodeURIComponent(query)}`} className="mt-1 inline-block text-sm font-medium text-brand hover:text-brand-hover">
          Preguntárselo a Manzana
        </Link>
      </div>
    </div>
  );
}
