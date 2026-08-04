"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { HomeScreen } from "@/features/home/home-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";
import { queryKeys } from "@/shared/data/query-keys";

async function fetchOnboardingStatus(): Promise<string | null> {
  const response = await fetch("/api/v1/onboarding", { credentials: "same-origin" });
  const payload = (await response.json()) as {
    ok: boolean;
    data?: { onboarding?: { persisted_status?: string } };
  };
  if (!payload.ok) return null;
  return payload.data?.onboarding?.persisted_status ?? null;
}

export default function InicioPage() {
  const router = useRouter();
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  // `44` `SCR-ONB-02`/`AC-ONB-07`: quien nunca vio la bienvenida (todavía
  // en `not_started`) la ve una vez, antes de llegar al Inicio de verdad.
  // `AC-PAT-01`: obtención de datos con TanStack Query (`WEB-D186`), no un
  // `useEffect` con bandera de cancelación a mano. No es una comprobación
  // de servidor (`InicioPage` es cliente): un usuario recién creado puede
  // ver el Inicio un instante antes de redirigir, coste aceptado frente a
  // convertir esta pantalla entera en Server Component solo para esto
  // (`WEB-D281`).
  const { data: onboardingStatus } = useQuery({
    queryKey: queryKeys.onboarding,
    queryFn: fetchOnboardingStatus,
  });

  useEffect(() => {
    if (onboardingStatus === "not_started") router.replace("/bienvenida");
  }, [onboardingStatus, router]);

  return (
    <HomeScreen
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      onStartMovement={() => router.push("/movimientos/nuevo")}
    />
  );
}
