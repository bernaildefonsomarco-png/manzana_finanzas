import Link from "next/link";
import { CheckCircle2, CircleAlert, Mail, ShieldCheck } from "lucide-react";

import {
  getIdentityReadinessFields,
  isIdentityPackageReady,
  publicIdentity,
} from "@/shared/public-identity";

const navLinks = [
  { href: "/empresa", label: "Empresa" },
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Terminos" },
  { href: "/contacto", label: "Contacto" },
];

export function PublicHeader() {
  return (
    <header className="border-b border-border bg-bg-primary/95">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-5 sm:px-10 lg:px-12">
        <Link href="/empresa" className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-brand text-base font-semibold text-text-inverse shadow-xs">
            M
          </div>
          <div>
            <p className="font-heading text-lg font-semibold text-brand">
              {publicIdentity.brandName}
            </p>
            <p className="text-sm text-text-secondary">
              Tranquilidad financiera
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 sm:flex" aria-label="Legal">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-bg-surface hover:text-text focus:outline-none focus:ring-2 focus:ring-border-focus"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-bg-primary">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 text-sm text-text-secondary sm:px-10 md:grid-cols-[1fr_auto] lg:px-12">
        <div>
          <p className="font-semibold text-text">{publicIdentity.brandName}</p>
          <p className="mt-1 max-w-2xl leading-6">
            {publicIdentity.productDescription}
          </p>
          <p className="mt-3">
            Operador: {publicIdentity.legalOperator}. Pais:{" "}
            {publicIdentity.country}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-brand">
              {link.label}
            </Link>
          ))}
          <Link href="/eliminar-datos" className="hover:text-brand">
            Eliminar datos
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function PublicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg-primary text-text">
      <PublicHeader />
      {children}
      <PublicFooter />
    </main>
  );
}

export function PublicHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-10 lg:px-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-normal text-brand">
          {eyebrow}
        </p>
        <h1 className="mt-4 font-heading text-4xl font-semibold leading-tight text-text sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 text-lg leading-8 text-text-secondary">
          {description}
        </p>
      </div>
    </section>
  );
}

export function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-surface-raised p-6 shadow-xs">
      <h2 className="font-heading text-xl font-semibold text-text">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-6 text-text-secondary">
        {children}
      </div>
    </section>
  );
}

export function IdentityReadinessCard() {
  const ready = isIdentityPackageReady();
  const fields = getIdentityReadinessFields();

  return (
    <InfoCard title="Estado del paquete de identidad">
      <div
        className={`flex items-start gap-3 rounded-lg border p-4 ${
          ready
            ? "border-success-subtle bg-success-subtle"
            : "border-warning-subtle bg-warning-subtle"
        }`}
      >
        {ready ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
        ) : (
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
        )}
        <div>
          <p className="font-semibold text-text">
            {ready
              ? "Listo para revision publica"
              : "Faltan datos reales antes de enviar a Meta"}
          </p>
          <p className="mt-1">
            Esta tarjeta existe para evitar enviar a Meta una pagina con datos
            incompletos o que no coincidan con tus documentos.
          </p>
        </div>
      </div>

      <dl className="grid gap-3">
        {fields.map((field) => (
          <div
            key={field.label}
            className="grid gap-1 rounded-lg border border-border bg-bg-primary p-4 sm:grid-cols-[180px_1fr_auto]"
          >
            <dt className="font-medium text-text">{field.label}</dt>
            <dd className="text-text-secondary">{field.value}</dd>
            <dd
              className={`text-sm font-semibold ${
                field.ready ? "text-success" : "text-warning"
              }`}
            >
              {field.ready ? "Configurado" : "Pendiente"}
            </dd>
          </div>
        ))}
      </dl>
    </InfoCard>
  );
}

export function ContactBlock() {
  return (
    <div className="rounded-xl border border-border bg-bg-surface-raised p-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
          <Mail className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-semibold text-text">
            Contacto oficial
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Correo: {publicIdentity.contactEmail}
          </p>
          <p className="text-sm leading-6 text-text-secondary">
            Soporte: {publicIdentity.supportEmail}
          </p>
          <p className="text-sm leading-6 text-text-secondary">
            Privacidad: {publicIdentity.privacyEmail}
          </p>
          <p className="text-sm leading-6 text-text-secondary">
            Telefono: {publicIdentity.contactPhone}
          </p>
        </div>
      </div>
    </div>
  );
}

export function TrustList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-3 rounded-lg border border-border bg-bg-primary p-4"
        >
          <ShieldCheck
            className="mt-0.5 size-5 shrink-0 text-brand"
            aria-hidden="true"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
