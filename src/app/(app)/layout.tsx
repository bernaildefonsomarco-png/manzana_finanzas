import { redirect } from "next/navigation";
import { createClient } from "@/data/supabase/server";
import { DiscreetModeProvider } from "@/shared/privacy/discreet-mode-context";
import { ModalAccessibilityGuard } from "@/shared/accessibility/modal-accessibility-guard";
import { QueryClientProvider } from "@/shared/data/query-client-provider";
import { AssistantProvider } from "./asistente/assistant-context";
import { AssistantPanel } from "./asistente/assistant-panel";

/**
 * `12` §10: el layout de `(app)` verifica la sesión una sola vez. El
 * redirigido real con `?redirigir=<ruta>` ya ocurre en `src/proxy.ts`
 * (única capa con la URL completa, `12` §10); esta comprobación es una
 * segunda capa de defensa, no la primera — si se llega hasta aquí sin
 * usuario es porque el proxy no interceptó la petición (por ejemplo, una
 * navegación de cliente entre rutas de `(app)`).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  return (
    <QueryClientProvider>
      <DiscreetModeProvider>
        <ModalAccessibilityGuard />
        <AssistantProvider>
          {children}
          <AssistantPanel />
        </AssistantProvider>
      </DiscreetModeProvider>
    </QueryClientProvider>
  );
}
