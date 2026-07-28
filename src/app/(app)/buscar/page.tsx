"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { NaturalSearchScreen } from "@/features/search/natural-search-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function BuscarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  return (
    <NaturalSearchScreen
      key={query}
      initialQuery={query}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      onOpenMovementsFilter={(movementQuery) =>
        router.push(`/movimientos?q=${encodeURIComponent(movementQuery)}`)
      }
    />
  );
}
