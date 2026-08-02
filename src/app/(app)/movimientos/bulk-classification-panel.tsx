"use client";

import { useState } from "react";
import { CATEGORY_OPTIONS } from "@/features/budgets/budget-options";
import type { CategoryId } from "@/shared/types/domain";
import { classifyBulk, undoClassificationBatch, type BulkPreview } from "@/shared/api/classification-operations";
import { Button } from "@/ui/primitivas/button";

export function BulkClassificationPanel({ movementIds, onDone }: { movementIds: string[]; onDone: () => void }) {
  const [categoryId, setCategoryId] = useState<CategoryId | "">("");
  const [includeManual, setIncludeManual] = useState(false);
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [batch, setBatch] = useState<{ id: string; movement_count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function previewChange() {
    if (!categoryId) return;
    setBusy(true); setError(null);
    try {
      const result = await classifyBulk({ movementIds, categoryId, includeManuallyCorrected: includeManual, preview: true, idempotencyKey: key });
      setPreview(result.preview ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude preparar la reclasificación.");
    } finally { setBusy(false); }
  }

  async function applyChange() {
    if (!categoryId || !preview) return;
    setBusy(true); setError(null);
    try {
      const result = await classifyBulk({ movementIds, categoryId, includeManuallyCorrected: includeManual, preview: false, idempotencyKey: key });
      if (result.batch) setBatch(result.batch);
      setPreview(null);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude reclasificar el lote.");
    } finally { setBusy(false); }
  }

  return (
    <section className="sticky bottom-4 rounded-xl border border-brand/30 bg-bg-surface-raised p-4 shadow-lg" aria-live="polite" aria-labelledby="bulk-title">
      <h2 id="bulk-title" className="font-heading font-semibold text-text">Reclasificar {movementIds.length} seleccionados</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-text">Destino
          <select className="mt-1 block h-10 rounded-md border border-border bg-bg-surface px-3" value={categoryId} onChange={(event) => { setCategoryId(event.target.value as CategoryId | ""); setPreview(null); setKey(crypto.randomUUID()); }}>
            <option value="">Elige una categoría</option>
            {CATEGORY_OPTIONS.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-text-secondary"><input type="checkbox" checked={includeManual} onChange={(event) => { setIncludeManual(event.target.checked); setPreview(null); }} />Incluir los corregidos a mano</label>
        <Button variant="secondary" disabled={!categoryId || busy} onClick={() => void previewChange()}>Previsualizar</Button>
      </div>
      {preview ? (
        <div className="mt-4 rounded-lg bg-bg-surface p-4">
          <p className="font-medium text-text">Cambiarán {preview.count} movimientos; {preview.excluded_count} quedan fuera.</p>
          {preview.movements?.length ? <ul className="mt-2 list-disc pl-5 text-sm text-text-secondary">{preview.movements.map((movement) => <li key={movement.id}>{movement.merchant ?? movement.description ?? "Movimiento"}</li>)}</ul> : null}
          <Button className="mt-3" disabled={busy} onClick={() => void applyChange()}>Confirmar reclasificación masiva</Button>
        </div>
      ) : null}
      {batch ? <p className="mt-3 text-sm text-success-on-subtle">Se reclasificaron {batch.movement_count}. <button className="underline" onClick={() => void undoClassificationBatch(batch.id).then(() => { setBatch(null); onDone(); })}>Deshacer lote</button></p> : null}
      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
    </section>
  );
}
