"use client";

import { ProjectionsScreen } from "@/features/projections/projections-screen";
import {
  useLegacyNavigate,
  useLegacySignOut,
} from "@/shared/legacy-nav/legacy-view-routes";

export default function ProyeccionesPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <ProjectionsScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
