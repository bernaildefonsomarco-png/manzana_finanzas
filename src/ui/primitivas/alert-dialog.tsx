"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Dialog, DialogContent } from "./dialog";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog-parts";
import { Button } from "./button";

type AlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

/**
 * Confirmaciones de riesgo (`16` §5): a diferencia de `Dialog`, `Escape` y
 * el clic fuera **no** cierran — la decisión debe ser explícita, así que
 * `AlertDialogContent` siempre fuerza `dismissible={false}`.
 */
export function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

export function AlertDialogContent({
  size = "sm",
  ...props
}: Omit<Parameters<typeof DialogContent>[0], "dismissible">) {
  return <DialogContent size={size} dismissible={false} {...props} />;
}

export const AlertDialogHeader = DialogHeader;
export const AlertDialogTitle = DialogTitle;
export const AlertDialogDescription = DialogDescription;
export const AlertDialogFooter = DialogFooter;

const GENERIC_LABELS = new Set(["aceptar", "ok", "confirmar"]);

type AlertDialogActionProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * `AC-A11Y` / `16` §5: el botón de confirmación nombra la acción real
 * ("Borrar movimiento"), nunca un genérico "Aceptar". En desarrollo, un
 * genérico falla en vez de quedar en verde con un texto que no dice qué va
 * a pasar.
 */
export function AlertDialogAction({ children, ...props }: AlertDialogActionProps) {
  if (process.env.NODE_ENV !== "production" && typeof children === "string") {
    if (GENERIC_LABELS.has(children.trim().toLowerCase())) {
      throw new Error(
        `<AlertDialogAction> recibió "${children}" — debe nombrar la acción real ("Borrar movimiento"), nunca un genérico (16 §5).`
      );
    }
  }
  return (
    <Button type="button" variant="danger" {...props}>
      {children}
    </Button>
  );
}

export function AlertDialogCancel(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button type="button" variant="secondary" {...props} />;
}
