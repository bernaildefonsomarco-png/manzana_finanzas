import { AuthScreen } from "@/features/auth/auth-screen";
import { DashboardApp } from "@/features/dashboard/dashboard-app";
import { createClient } from "@/data/supabase/server";
import { DiscreetModeProvider } from "@/shared/privacy/discreet-mode-context";
import { ModalAccessibilityGuard } from "@/shared/accessibility/modal-accessibility-guard";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <DiscreetModeProvider>
      <ModalAccessibilityGuard />
      <DashboardApp />
    </DiscreetModeProvider>
  );
}
