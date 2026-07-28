import Link from "next/link";
import { Card } from "@/ui/primitivas/card";

/**
 * Marcador de una sección cuyo contenido real construye un corte de módulo
 * futuro (`54` bloque B). Existir con URL propia es responsabilidad de
 * `W-07` (`AC-NAV-01`); el contenido no lo es — inventarlo violaría
 * `RUL-HECHO-04`. Mismo patrón que ya usaba `dashboard-app.tsx` para las
 * secciones sin corte todavía.
 */
export function PlaceholderSection({
  title,
  description,
  backHref,
  backLabel,
}: {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <section className="mx-auto mt-10 max-w-2xl">
      <Card elevated className="p-6">
        <h1 className="font-heading text-2xl font-semibold tracking-normal text-text">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
        <Link
          href={backHref}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-md border border-border bg-bg-surface-raised px-5 font-heading text-sm font-medium tracking-normal text-text transition hover:border-border-strong hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          {backLabel}
        </Link>
      </Card>
    </section>
  );
}
