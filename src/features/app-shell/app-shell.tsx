"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  Compass,
  Eye,
  EyeOff,
  Home,
  ListChecks,
  LogOut,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useDiscreetMode } from "@/shared/privacy/discreet-mode-context";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/cn";

export type AppView =
  | "home"
  | "movements"
  | "pending"
  | "money"
  | "debts"
  | "upcoming"
  | "insights"
  | "search"
  | "settings";

type NavItem = {
  id: AppView;
  label: string;
  mobileLabel?: string;
  href: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  { id: "home", label: "Home", mobileLabel: "Home", href: "#home", icon: <Home className="h-4 w-4" /> },
  {
    id: "movements",
    label: "Movimientos",
    mobileLabel: "Movs.",
    href: "#movimientos",
    icon: <ListChecks className="h-4 w-4" />,
  },
  {
    id: "pending",
    label: "Pendientes",
    mobileLabel: "Pend.",
    href: "#pendientes",
    icon: <Bell className="h-4 w-4" />,
  },
  {
    id: "money",
    label: "Mi Dinero",
    mobileLabel: "Dinero",
    href: "#dinero",
    icon: <WalletCards className="h-4 w-4" />,
  },
  { id: "debts", label: "Deudas", href: "#deudas", icon: <ShieldCheck className="h-4 w-4" /> },
  {
    id: "upcoming",
    label: "Pagos que vienen",
    href: "#pagos",
    icon: <CalendarDays className="h-4 w-4" />,
  },
  {
    id: "insights",
    label: "Descubrimientos",
    href: "#descubrimientos",
    icon: <Compass className="h-4 w-4" />,
  },
];

export function AppShell({
  children,
  title,
  subtitle,
  primaryAction,
  mobilePrimaryAction,
  onSignOut,
  hideDesktopHeader = false,
  hideMobileNavigation = false,
  activeView = "movements",
  onNavigate,
  searchDefaultValue,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  primaryAction?: ReactNode;
  mobilePrimaryAction?: ReactNode;
  onSignOut?: () => void;
  hideDesktopHeader?: boolean;
  hideMobileNavigation?: boolean;
  activeView?: AppView;
  onNavigate?: (view: AppView) => void;
  searchDefaultValue?: string;
}) {
  const { discreet, saving: savingDiscreet, setDiscreet } = useDiscreetMode();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    moreMenuRef.current?.querySelector("button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  function navigate(view: AppView) {
    setMoreOpen(false);
    onNavigate?.(view);
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text">
      <aside className="fixed inset-y-0 left-0 z-sticky hidden w-60 border-r border-border/70 bg-bg-surface px-4 py-5 lg:flex lg:flex-col">
        <Brand />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              active={item.id === activeView}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
        <div className="mt-5 space-y-2 border-t border-border/70 pt-4">
          <NavLink
            item={{
              id: "settings",
              label: "Configuración",
              href: "#configuracion",
              icon: <Settings className="h-4 w-4" />,
            }}
            active={activeView === "settings"}
            onNavigate={onNavigate}
          />
          {onSignOut ? (
            <button
              type="button"
              className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium tracking-normal text-text-secondary transition hover:bg-bg-surface hover:text-text active:scale-[0.98]"
              onClick={onSignOut}
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </button>
          ) : null}
        </div>
      </aside>

      <div className="min-w-0 lg:pl-60">
        <header
          className={cn(
            "sticky top-0 z-sticky bg-bg-primary/92 px-4 py-3 backdrop-blur lg:px-8",
            hideDesktopHeader && "lg:hidden"
          )}
        >
          <div className="mx-auto flex max-w-[1220px] items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="lg:hidden">
                <Brand compact />
              </div>
              <div className="hidden lg:block">
                <p className="text-xs font-medium text-text-muted">
                  Manzana
                </p>
                <h1 className="font-heading text-2xl font-semibold tracking-normal text-text">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
                ) : null}
              </div>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <form
                action=""
                method="get"
                className="hidden min-w-[260px] max-w-[420px] flex-1 items-center rounded-lg border border-border bg-bg-surface-raised px-3 shadow-xs transition focus-within:border-border-focus focus-within:ring-2 focus-within:ring-brand/15 md:flex"
              >
                <input type="hidden" name="view" value="search" />
                <Search className="h-4 w-4 shrink-0 text-text-muted" />
                <input
                  name="q"
                  defaultValue={searchDefaultValue}
                  className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm text-text outline-none placeholder:text-text-muted"
                  placeholder="Pregunta algo sobre tu dinero..."
                  aria-label="Pregunta algo sobre tu dinero"
                />
                <button
                  type="submit"
                  className="text-xs font-medium text-brand transition hover:text-brand-hover"
                >
                  Buscar
                </button>
              </form>
              <div className="md:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  icon={<Search className="h-4 w-4" />}
                  onClick={() => onNavigate?.("search")}
                >
                  Buscar
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                icon={<Bell className="h-4 w-4" />}
                onClick={() => onNavigate?.("pending")}
              >
                Abrir notificaciones pendientes
              </Button>
              <Button
                variant="ghost"
                size="icon"
                loading={savingDiscreet}
                icon={
                  discreet ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )
                }
                onClick={() => void setDiscreet(!discreet)}
              >
                {discreet
                  ? "Mostrar información financiera"
                  : "Activar modo discreto"}
              </Button>
              <div className="hidden sm:block">{primaryAction}</div>
            </div>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto min-w-0 max-w-[1180px] overflow-x-hidden px-4 pb-28 pt-6 lg:px-8 lg:pb-10",
            hideDesktopHeader && "lg:pt-0"
          )}
        >
          <div className="mb-5 lg:hidden">
            <h1 className="font-heading text-2xl font-semibold tracking-normal text-text">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
            ) : null}
          </div>
          {children}
        </main>
      </div>

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-bg-surface-raised/95 px-3 pb-3 pt-2 backdrop-blur lg:hidden",
          hideMobileNavigation && "hidden"
        )}
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {navItems.slice(0, 4).map((item) => (
            <MobileNavLink
              key={item.label}
              item={item}
              active={item.id === activeView}
              onNavigate={onNavigate}
            />
          ))}
          <button
            type="button"
            className="flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium tracking-normal text-text-secondary transition hover:bg-bg-surface active:scale-[0.98]"
            aria-expanded={moreOpen}
            aria-controls="mobile-more-menu"
            onClick={() => setMoreOpen((value) => !value)}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span>Más</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-modal bg-black/20 lg:hidden"
            aria-label="Cerrar menú"
            onClick={() => setMoreOpen(false)}
          />
          <div
            ref={moreMenuRef}
            id="mobile-more-menu"
            role="menu"
            aria-label="Más secciones"
            className="fixed inset-x-3 bottom-20 z-modal mx-auto max-w-md rounded-xl border border-border bg-bg-surface-raised p-2 shadow-lg lg:hidden"
          >
            {[
              ...navItems.slice(4),
              {
                id: "settings" as const,
                label: "Configuración",
                href: "#configuracion",
                icon: <Settings className="h-4 w-4" />,
              },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-text-secondary hover:bg-bg-surface hover:text-text"
                onClick={() => navigate(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {!hideMobileNavigation && (mobilePrimaryAction ?? primaryAction) ? (
        <div className="fixed bottom-20 right-4 z-sticky sm:hidden">
          {mobilePrimaryAction ?? primaryAction}
        </div>
      ) : null}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-text-inverse shadow-xs">
        M
      </div>
      {!compact ? (
        <div>
          <p className="font-heading text-base font-semibold tracking-normal text-brand">
            Manzana
          </p>
          <p className="text-xs text-text-muted">Tranquilidad financiera</p>
        </div>
      ) : (
        <p className="font-heading text-base font-semibold tracking-normal text-brand">
          Manzana
        </p>
      )}
    </div>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: (view: AppView) => void;
}) {
  const className = cn(
    "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium tracking-normal transition active:scale-[0.98]",
    active
      ? "bg-brand/10 text-brand"
      : "text-text-secondary hover:bg-bg-surface hover:text-text"
  );

  if (onNavigate) {
    return (
      <button type="button" className={className} onClick={() => onNavigate(item.id)}>
        {item.icon}
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <a href={item.href} className={className}>
      {item.icon}
      <span>{item.label}</span>
    </a>
  );
}

function MobileNavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: (view: AppView) => void;
}) {
  const className = cn(
    "flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium tracking-normal transition active:scale-[0.98]",
    active
      ? "bg-brand-subtle text-brand"
      : "text-text-secondary hover:bg-bg-surface"
  );

  if (onNavigate) {
    return (
      <button type="button" className={className} onClick={() => onNavigate(item.id)}>
        {item.icon}
        <span className="max-w-full truncate">{item.mobileLabel ?? item.label}</span>
      </button>
    );
  }

  return (
    <a href={item.href} className={className}>
      {item.icon}
      <span className="max-w-full truncate">{item.mobileLabel ?? item.label}</span>
    </a>
  );
}
