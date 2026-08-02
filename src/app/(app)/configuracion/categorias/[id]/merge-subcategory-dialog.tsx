"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import { DialogFooter, DialogHeader, DialogTitle } from "@/ui/primitivas/dialog-parts";
import { Button } from "@/ui/primitivas/button";
import {
  mergeSubcategories,
  undoSubcategoryMerge,
} from "@/shared/api/classification-operations";
import type { UserSubcategory } from "@/shared/types/domain";

export function MergeSubcategoryDialog({
  source,
  candidates,
  open,
  onOpenChange,
  onDone,
}: {
  source: UserSubcategory;
  candidates: UserSubcategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [preview, setPreview] = useState<{ count: number; target_count_before: number; target_count_after: number } | null>(null);
  const [batch, setBatch] = useState<{ id: string; movement_count: number } | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview() {
    if (!targetId) return;
    setBusy(true); setError(null);
    try {
      const result = await mergeSubcategories({ sourceId: source.id, targetId, preview: true, idempotencyKey: key });
      setPreview(result.preview ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude preparar la fusión.");
    } finally { setBusy(false); }
  }

  async function confirmMerge() {
    if (!targetId || !preview) return;
    setBusy(true); setError(null);
    try {
      const result = await mergeSubcategories({ sourceId: source.id, targetId, preview: false, idempotencyKey: key });
      if (result.batch) {
        setBatch(result.batch);
        onDone(`Fusioné ${source.label}: ${result.batch.movement_count} movimientos conservaron su clasificación.`);
      }
      setPreview(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude fusionar las subcategorías.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Fusionar {source.label}</DialogTitle></DialogHeader>
        {candidates.length === 0 ? <p className="text-sm text-text-secondary">Necesitas otra subcategoría en la misma categoría.</p> : (
          <>
            <label className="text-sm font-medium text-text" htmlFor="merge-target">Se fusionará dentro de</label>
            <select id="merge-target" className="mt-2 h-10 w-full rounded-md border border-border bg-bg-surface px-3" value={targetId} onChange={(event) => { setTargetId(event.target.value); setPreview(null); setKey(crypto.randomUUID()); }}>
              <option value="">Elige el destino</option>
              {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
            </select>
            <Button className="mt-3" variant="secondary" disabled={!targetId || busy} onClick={() => void loadPreview()}>Ver conteo antes de fusionar</Button>
          </>
        )}
        {preview ? <div className="mt-4 rounded-lg bg-warning-subtle p-4 text-sm text-text"><strong>{preview.count} movimientos</strong> pasarán a la subcategoría elegida. El destino tendrá {preview.target_count_before} + {preview.count} = {preview.target_count_after}. Puedes deshacer durante 7 días.</div> : null}
        {batch ? <p className="mt-3 text-sm text-success-on-subtle">Fusión realizada. <button className="underline" onClick={() => void undoSubcategoryMerge(source.id, batch.id).then(() => { setBatch(null); onDone("Fusión deshecha."); })}>Deshacer ahora</button></p> : null}
        {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button disabled={!preview || busy} onClick={() => void confirmMerge()}>Confirmar fusión</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
