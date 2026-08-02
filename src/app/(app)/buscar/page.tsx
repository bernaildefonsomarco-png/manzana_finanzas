"use client";

import { useSearchParams } from "next/navigation";
import { SearchScreen } from "@/features/search/search-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function BuscarPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  return <SearchScreen key={query} initialQuery={query} onNavigate={onNavigate} onSignOut={onSignOut} />;
}
