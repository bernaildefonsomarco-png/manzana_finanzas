"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { MovementDetailView } from "../../movement-detail-view";

/**
 * `(.)[id]` intercepta la navegación desde `/movimientos` hacia
 * `/movimientos/[id]`: el listado de fondo sigue visible y esto se muestra
 * como panel lateral con URL propia (`12` §6, `AC-ARQ-08`). Cargar la misma
 * URL directamente (recargar) no pasa por aquí — la sirve `[id]/page.tsx`.
 */
export default function MovimientoPanelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-modal flex justify-end bg-black/20">
      <button
        type="button"
        aria-label="Cerrar panel"
        className="absolute inset-0"
        onClick={() => router.back()}
      />
      <div className="relative flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-bg-primary p-5 shadow-lg">
        <div className="flex justify-end">
          <Link
            href="/movimientos"
            aria-label="Cerrar panel"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface hover:text-text"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <MovementDetailView movementId={id} />
      </div>
    </div>
  );
}
