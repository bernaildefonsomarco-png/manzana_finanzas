"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { DebtsScreen } from "@/features/debts/debts-screen";
import type { DebtScreenIntent } from "@/features/debts/debts-types";
import { HomeScreen } from "@/features/home/home-screen";
import { InsightsScreen } from "@/features/insights/insights-screen";
import { MoneyScreen } from "@/features/money/money-screen";
import { MovementsScreen } from "@/features/movements/movements-screen";
import { PendingScreen } from "@/features/pending/pending-screen";
import { NaturalSearchScreen } from "@/features/search/natural-search-screen";
import { SettingsScreen } from "@/features/settings/settings-screen";
import { UpcomingScreen } from "@/features/upcoming/upcoming-screen";
import { createClient } from "@/data/supabase/client";
import { Button } from "@/ui/primitivas/button";

const defaultView: AppView = "home";
const appViews = new Set<AppView>([
  "home",
  "movements",
  "pending",
  "money",
  "debts",
  "upcoming",
  "insights",
  "search",
  "settings",
]);

export function DashboardApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view")) ?? defaultView;
  const searchQuery = searchParams.get("q") ?? "";
  const movementQuery = searchParams.get("movement_q") ?? "";
  const newMovementRequested = searchParams.get("movement") === "new";
  const debtIntent = parseDebtScreenIntent(searchParams);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  function handleNavigate(nextView: AppView) {
    const params = new URLSearchParams(searchParams.toString());
    clearDebtIntent(params);
    clearMovementIntent(params);
    if (nextView === defaultView) {
      params.delete("view");
    } else {
      params.set("view", nextView);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function handleOpenDebt(intent: DebtScreenIntent) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "debts");
    params.set("debt", intent.debtId);
    params.set("action", intent.action);

    if (intent.installmentId) {
      params.set("installment", intent.installmentId);
    } else {
      params.delete("installment");
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleOpenMovementsFilter(query: string) {
    const params = new URLSearchParams(searchParams.toString());
    clearDebtIntent(params);
    params.set("view", "movements");
    params.set("movement_q", query);
    params.delete("q");
    clearMovementIntent(params);

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleDebtIntentConsumed() {
    const params = new URLSearchParams(searchParams.toString());
    clearDebtIntent(params);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleStartMovement() {
    const params = new URLSearchParams(searchParams.toString());
    clearDebtIntent(params);
    params.set("view", "movements");
    params.set("movement", "new");
    params.delete("movement_q");
    params.delete("q");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleMovementIntentConsumed() {
    const params = new URLSearchParams(searchParams.toString());
    clearMovementIntent(params);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (view === "pending") {
    return <PendingScreen onSignOut={handleSignOut} onNavigate={handleNavigate} />;
  }

  if (view === "home") {
    return (
      <HomeScreen
        onOpenDebt={handleOpenDebt}
        onStartMovement={handleStartMovement}
        onSignOut={handleSignOut}
        onNavigate={handleNavigate}
      />
    );
  }

  if (view === "movements") {
    return (
      <MovementsScreen
        key={`${movementQuery}:${newMovementRequested ? "new" : "list"}`}
        initialQuery={movementQuery}
        openNewOnMount={newMovementRequested}
        onNewIntentConsumed={handleMovementIntentConsumed}
        onSignOut={handleSignOut}
        onNavigate={handleNavigate}
      />
    );
  }

  if (view === "money") {
    return <MoneyScreen onSignOut={handleSignOut} onNavigate={handleNavigate} />;
  }

  if (view === "insights") {
    return <InsightsScreen onSignOut={handleSignOut} onNavigate={handleNavigate} />;
  }

  if (view === "debts") {
    return (
      <DebtsScreen
        debtIntent={debtIntent}
        onDebtIntentConsumed={handleDebtIntentConsumed}
        onSignOut={handleSignOut}
        onNavigate={handleNavigate}
      />
    );
  }

  if (view === "upcoming") {
    return (
      <UpcomingScreen
        onOpenDebt={handleOpenDebt}
        onSignOut={handleSignOut}
        onNavigate={handleNavigate}
      />
    );
  }

  if (view === "settings") {
    return <SettingsScreen onSignOut={handleSignOut} onNavigate={handleNavigate} />;
  }

  if (view === "search") {
    return (
      <NaturalSearchScreen
        key={searchQuery}
        initialQuery={searchQuery}
        onOpenMovementsFilter={handleOpenMovementsFilter}
        onSignOut={handleSignOut}
        onNavigate={handleNavigate}
      />
    );
  }

  return (
    <AppShell
      title={getPlaceholderTitle(view)}
      subtitle="Esta seccion se conectara en los siguientes cortes."
      activeView={view}
      onNavigate={handleNavigate}
      onSignOut={handleSignOut}
    >
      <section className="mx-auto mt-10 max-w-2xl rounded-lg border border-border bg-bg-surface-raised p-6">
        <h1 className="font-heading text-2xl font-semibold tracking-normal text-text">
          {getPlaceholderTitle(view)}
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Ya dejamos la navegacion lista para integrar esta pantalla siguiendo
          las referencias visuales de Stitch y los contratos de producto.
        </p>
        <Button
          className="mt-5"
          variant="secondary"
          onClick={() => handleNavigate("movements")}
        >
          Volver a movimientos
        </Button>
      </section>
    </AppShell>
  );
}

function parseView(value: string | null): AppView | null {
  if (!value) return null;
  return appViews.has(value as AppView) ? (value as AppView) : null;
}

export function parseDebtScreenIntent(
  params: Pick<URLSearchParams, "get">
): DebtScreenIntent | null {
  const debtId = params.get("debt");
  const installmentId = params.get("installment");
  const action = params.get("action");

  if (!debtId || !isUuid(debtId)) return null;
  if (installmentId && !isUuid(installmentId)) return null;
  if (action !== "detail" && action !== "pay") return null;

  return {
    debtId,
    installmentId,
    action,
  };
}

function clearDebtIntent(params: URLSearchParams) {
  params.delete("debt");
  params.delete("installment");
  params.delete("action");
}

function clearMovementIntent(params: URLSearchParams) {
  params.delete("movement");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getPlaceholderTitle(view: AppView): string {
  const titles: Record<AppView, string> = {
    home: "Home",
    movements: "Movimientos",
    pending: "Pendientes",
    money: "Mi Dinero",
    debts: "Deudas",
    upcoming: "Pagos que vienen",
    insights: "Descubrimientos",
    search: "Busqueda natural",
    settings: "Configuracion",
  };

  return titles[view];
}
