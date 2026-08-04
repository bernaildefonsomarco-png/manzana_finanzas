"use client";

import { ContactScreen } from "@/features/help/contact-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function AyudaContactoPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <ContactScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
