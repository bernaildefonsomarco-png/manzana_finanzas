"use client";

import { use } from "react";
import { InsightDetailScreen } from "@/features/insights/insights-screen";
import {
  useLegacyNavigate,
  useLegacySignOut,
} from "@/shared/legacy-nav/legacy-view-routes";

export default function DescubrimientoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <InsightDetailScreen
      id={id}
      onNavigate={useLegacyNavigate()}
      onSignOut={useLegacySignOut()}
    />
  );
}
