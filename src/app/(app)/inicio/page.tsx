"use client";

import { useRouter } from "next/navigation";
import { HomeScreen } from "@/features/home/home-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function InicioPage() {
  const router = useRouter();
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  return (
    <HomeScreen
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      onStartMovement={() => router.push("/movimientos/nuevo")}
    />
  );
}
