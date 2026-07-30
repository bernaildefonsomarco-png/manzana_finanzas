"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { Box } from "@/shared/types/domain";
import { Button } from "@/ui/primitivas/button";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitivas/dialog-parts";
import { FieldShell, Select } from "@/ui/primitivas/field";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";

export function GoalBoxLinkDialog({
  open,
  boxes,
  loading,
  failed,
  saving,
  saveFailed,
  onOpenChange,
  onRetry,
  onLink,
}: {
  open: boolean;
  boxes: Box[];
  loading: boolean;
  failed: boolean;
  saving: boolean;
  saveFailed: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onLink: (boxId: string) => void;
}) {
  const [boxId, setBoxId] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (boxId) onLink(boxId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular caja a la meta</DialogTitle>
          <DialogDescription>
            Elige una caja objetivo existente. Su saldo real será el avance de
            esta meta; aquí no se crea ni se infiere una cuenta.
          </DialogDescription>
        </DialogHeader>
        {loading ? <LoadingBlock label="Cargando cajas objetivo" /> : null}
        {failed ? (
          <ErrorState
            description="No pude cargar tus cajas. La meta no cambió."
            onRetry={onRetry}
          />
        ) : null}
        {!loading && !failed && boxes.length === 0 ? (
          <div className="space-y-3 text-sm text-text-secondary">
            <p>No tienes una caja objetivo disponible para vincular.</p>
            <Link
              href="/mi-dinero"
              className="font-medium text-brand hover:underline"
            >
              Ir a Mi Dinero para crear una
            </Link>
          </div>
        ) : null}
        {!loading && !failed && boxes.length > 0 ? (
          <form onSubmit={submit} className="space-y-4">
            <FieldShell
              label="Caja objetivo"
              htmlFor="goal-box"
              hint="El dominio verificará que pertenezca a una cuenta PEN y no esté vinculada a otra meta."
              required
            >
              <Select
                id="goal-box"
                value={boxId}
                onChange={(event) => setBoxId(event.target.value)}
              >
                <option value="">Selecciona una caja</option>
                {boxes.map((box) => (
                  <option key={box.id} value={box.id}>
                    {box.name} — S/{box.current_balance.toFixed(2)}
                  </option>
                ))}
              </Select>
            </FieldShell>
            {saveFailed ? (
              <p role="alert" className="text-sm text-error">
                No pude vincular esa caja. Verifica que sea PEN, siga activa y
                no respalde otra meta.
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={saving} disabled={!boxId}>
                Vincular caja
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
