"use client";

import { useRouter } from "next/navigation";
import type { AppView } from "@/features/app-shell/app-shell";

// Puente entre el contrato `onNavigate(view)` que las pantallas condenadas
// de `src/features/**` ya esperan (`WEB-D164`: no se editan) y las rutas
// reales que `W-07` construye. Vive fuera de `features/`, así que no es
// saldar deuda condenada: es la fontanería nueva que las conecta a URLs de
// verdad en vez de un `?view=` (`AC-NAV-04`, `AC-ARQ-01`).
export const LEGACY_VIEW_ROUTES: Record<AppView, string> = {
  home: "/inicio",
  movements: "/movimientos",
  pending: "/pendientes",
  money: "/mi-dinero",
  debts: "/deudas",
  upcoming: "/pagos-que-vienen",
  insights: "/descubrimientos",
  search: "/buscar",
  settings: "/configuracion",
  budgets: "/presupuestos",
  reports: "/reportes",
  projections: "/proyecciones",
  assistant: "/asistente",
  reminders: "/recordatorios",
};

export function useLegacyNavigate(): (view: AppView) => void {
  const router = useRouter();
  return (view: AppView) => router.push(LEGACY_VIEW_ROUTES[view]);
}

export function useLegacySignOut(): () => Promise<void> {
  const router = useRouter();
  return async () => {
    const { createClient } = await import("@/data/supabase/client");
    const supabase = createClient();
    // `43` `ACT-AUTH-09` ("Salir") es de este dispositivo, distinto de
    // `ACT-AUTH-10` ("Salir en todos los dispositivos", `signOutAllDevices`
    // en `@/core/auth/sign-out`). `signOut()` sin `scope` usa `'global'` por
    // defecto en `@supabase/auth-js` — antes de esta corrección, cada
    // "Salir" cerraba la sesión en **todos** los dispositivos sin decirlo:
    // exactamente el defecto que `ACT-AUTH-10` existe para hacer explícito.
    await supabase.auth.signOut({ scope: "local" });
    router.refresh();
  };
}
