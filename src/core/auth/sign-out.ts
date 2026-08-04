import { createClient } from "@/data/supabase/client";

// `43` `ACT-AUTH-10` — "Salir en todos los dispositivos". Distinto de
// `useLegacySignOut` (`ACT-AUTH-09`, solo este dispositivo,
// `scope: 'local'`): aquí se usa el `'global'` que `@supabase/auth-js` trae
// por defecto — cierra todas las sesiones, incluida la actual (`RUL-AUTH-11`:
// "salir en todos los dispositivos" es un control aparte y claramente
// distinto de salir). Se registra `sesiones_cerradas` en `account_events`
// (`43` §4.3) porque es una de las dos acciones de esta pantalla que exigen
// confirmación (`ACT-AUTH-10`, `Sí`).
export async function signOutAllDevices(): Promise<{ ok: true } | { ok: false; message: string }> {
  // El evento se registra ANTES de cerrar sesión: `scope: 'global'` invalida
  // también la sesión actual, y sin ella `getApiAuth` de
  // `/api/v1/auth/events` ya no tendría con qué autenticar el insert.
  await fetch("/api/v1/auth/events", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "sesiones_cerradas" }),
  }).catch(() => undefined);

  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { ok: false, message: "No pude cerrar las demás sesiones. Inténtalo de nuevo." };
  }
  return { ok: true };
}
