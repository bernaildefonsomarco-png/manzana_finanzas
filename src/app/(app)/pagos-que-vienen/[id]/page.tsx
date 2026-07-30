"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { UpcomingDetailScreen } from "@/features/upcoming/upcoming-detail-screen";
import {
  useLegacyNavigate,
  useLegacySignOut,
} from "@/shared/legacy-nav/legacy-view-routes";

export default function PagoQueVieneDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  return (
    <UpcomingDetailScreen
      ruleId={id}
      onBack={() => router.push("/pagos-que-vienen")}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    />
  );
}
