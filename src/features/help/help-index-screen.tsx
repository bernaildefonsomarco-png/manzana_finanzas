"use client";

import Link from "next/link";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { Card } from "@/ui/primitivas/card";
import { ChevronRight } from "lucide-react";
import { HELP_ARTICLES } from "./help-articles";

type Props = { onSignOut?: () => void; onNavigate?: (view: AppView) => void };

// `48` `SCR-AYUDA-03` — nueve artículos en una lista, sin categorías ni
// buscador. Con nueve elementos, un buscador es peor que la lista.
export function HelpIndexScreen(props: Props) {
  return (
    <AppShell title="Ayuda" activeView="settings" {...props}>
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <Card elevated className="divide-y divide-border overflow-hidden">
          {HELP_ARTICLES.map((article) => (
            <Link
              key={article.slug}
              href={`/ayuda/${article.slug}`}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-text hover:bg-bg-surface"
            >
              <span>{article.question}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
            </Link>
          ))}
        </Card>

        <Link
          href="/ayuda/contacto"
          className="mt-4 block rounded-lg border border-border bg-bg-surface-raised px-4 py-3 text-center text-sm font-medium text-text-brand hover:bg-bg-surface"
        >
          Escribir a soporte
        </Link>
      </main>
    </AppShell>
  );
}
