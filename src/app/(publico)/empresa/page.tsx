import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import {
  ContactBlock,
  IdentityReadinessCard,
  InfoCard,
  PublicPageShell,
} from "@/features/public-site/public-site";
import { publicIdentity } from "@/shared/public-identity";

export const metadata: Metadata = {
  title: "Manzana - Tranquilidad financiera por WhatsApp",
  description:
    "Manzana ayuda a registrar, confirmar y entender movimientos financieros personales con WhatsApp, dashboard y reglas financieras seguras.",
};

const pillars = [
  {
    icon: MessageCircle,
    title: "WhatsApp primero",
    text: "Registra gastos, ingresos y pendientes con lenguaje natural, sin formularios pesados como primer paso.",
  },
  {
    icon: ShieldCheck,
    title: "Confirmacion protegida",
    text: "Lo detectado por email o automatizaciones queda pendiente hasta que la persona lo aprueba.",
  },
  {
    icon: WalletCards,
    title: "Dinero con contexto",
    text: "Cuentas, cajas, deudas, pagos que vienen y movimientos viven en un Core financiero auditable.",
  },
];

const checks = [
  "Nada pendiente modifica saldos sin confirmacion.",
  "Los agentes ayudan a entender lenguaje; las reglas exactas protegen el dinero.",
  "La persona puede revisar origen, corregir datos y usar modo discreto.",
];

export default function CompanyPage() {
  return (
    <PublicPageShell>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface-raised px-4 py-2 text-sm text-text-secondary shadow-xs">
              <LockKeyhole className="size-4 text-brand" aria-hidden="true" />
              Finanzas personales con aprobacion del usuario
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl font-heading text-4xl font-semibold leading-tight tracking-normal text-text sm:text-5xl lg:text-6xl">
                Tu dinero, ordenado contigo y sin culpa.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-text-secondary">
                {publicIdentity.brandName} ayuda a registrar movimientos por
                WhatsApp, revisar pendientes en el dashboard y entender el
                dinero disponible con claridad. La inteligencia artificial
                interpreta mensajes; el Core financiero protege saldos,
                auditoria y confirmaciones.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md bg-brand px-5 py-3 text-sm font-semibold text-text-inverse shadow-sm transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 focus:ring-offset-bg-primary"
              >
                Entrar a Manzana
              </Link>
              <a
                href="#seguridad"
                className="inline-flex items-center justify-center rounded-md border border-border bg-bg-surface-raised px-5 py-3 text-sm font-semibold text-text transition hover:border-border-strong hover:bg-bg-surface focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 focus:ring-offset-bg-primary"
              >
                Ver como protege datos
              </a>
            </div>
          </div>

          <aside className="rounded-2xl border border-border bg-bg-surface-raised p-5 shadow-sm">
            <div className="rounded-xl bg-bg-surface p-5">
              <p className="text-sm font-semibold uppercase tracking-normal text-text-secondary">
                Ejemplo de registro
              </p>
              <div className="mt-4 space-y-3">
                <div className="ml-auto max-w-[84%] rounded-2xl rounded-tr-md bg-brand px-4 py-3 text-sm text-text-inverse">
                  Gaste 8 cafe, 15 taxi y 20 almuerzo
                </div>
                <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-border bg-bg-surface-raised px-4 py-3 text-sm text-text-secondary shadow-xs">
                  Listo. Separe 3 movimientos para revisar: cafe S/8, taxi S/15
                  y almuerzo S/20.
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {checks.map((check) => (
                <div
                  key={check}
                  className="flex items-start gap-3 rounded-lg border border-border bg-bg-surface-raised p-4"
                >
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <p className="text-sm leading-6 text-text-secondary">
                    {check}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <section
          id="seguridad"
          className="grid gap-4 md:grid-cols-3"
          aria-label="Principios de Manzana"
        >
          {pillars.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <article
                key={pillar.title}
                className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs"
              >
                <div className="mb-5 flex size-10 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h2 className="font-heading text-lg font-semibold text-text">
                  {pillar.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  {pillar.text}
                </p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.95fr]">
          <InfoCard title="Identidad publica">
            <p>
              {publicIdentity.brandName} es un producto digital de finanzas
              personales operado por {publicIdentity.legalOperator}. El servicio
              esta preparado para funcionar con WhatsApp como canal principal y
              dashboard como espacio de control.
            </p>
            <p>
              Estado legal declarado: {publicIdentity.legalStatus}. Pais:{" "}
              {publicIdentity.country}. Direccion publica:{" "}
              {publicIdentity.publicAddress}.
            </p>
            <p>
              Sitio web oficial: {publicIdentity.websiteUrl}. Las politicas
              publicas estan disponibles en privacidad, terminos y eliminacion
              de datos.
            </p>
          </InfoCard>

          <ContactBlock />
        </section>

        <IdentityReadinessCard />
      </section>
    </PublicPageShell>
  );
}
