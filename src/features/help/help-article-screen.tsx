"use client";

import Link from "next/link";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { Card } from "@/ui/primitivas/card";
import type { HelpArticle } from "./help-articles";

type Props = { article: HelpArticle; onSignOut?: () => void; onNavigate?: (view: AppView) => void };

// `48` `SCR-AYUDA-04` — documento con estructura de encabezados real,
// legible con el navegador ampliado al 200% (`48` §11).
export function HelpArticleScreen({ article, ...props }: Props) {
  return (
    <AppShell title={article.question} activeView="settings" {...props}>
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <Card elevated className="p-6">
          <h1 className="font-heading text-xl font-semibold text-text">{article.question}</h1>
          <div className="mt-4 space-y-3 text-sm leading-6 text-text-secondary">
            {article.body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </Card>
        <Link
          href="/ayuda"
          className="mt-4 inline-block text-sm font-medium text-text-brand hover:text-brand-hover"
        >
          Volver a ayuda
        </Link>
      </main>
    </AppShell>
  );
}
