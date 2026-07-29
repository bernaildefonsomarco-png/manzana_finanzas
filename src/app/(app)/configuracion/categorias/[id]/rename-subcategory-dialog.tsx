"use client";

import { z } from "zod";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import { DialogFooter, DialogHeader, DialogTitle } from "@/ui/primitivas/dialog-parts";
import { Button } from "@/ui/primitivas/button";
import { FieldShell, Input } from "@/ui/primitivas/field";
import { useZodForm } from "@/shared/forms/use-zod-form";
import { useOptimisticMutation } from "@/shared/data/optimistic-mutation";
import { renameSubcategory } from "@/shared/api/categories";
import { DialogMutationError } from "@/shared/ui/dialog-mutation-error";
import type { UserSubcategory } from "@/shared/types/domain";

const RenameFormSchema = z.object({
  label: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(80),
});
type RenameForm = z.infer<typeof RenameFormSchema>;

/** RUL-CAT §5: renombrar tambien re-normaliza y detecta duplicados. */
export function RenameSubcategoryDialog({
  subcategory,
  open,
  onOpenChange,
  onDone,
}: {
  subcategory: UserSubcategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const form = useZodForm(RenameFormSchema, { defaultValues: { label: subcategory.label } });

  const mutation = useOptimisticMutation<RenameForm, UserSubcategory>({
    mutation: "subcategory.edit",
    mutationFn: (values) => renameSubcategory(subcategory.id, values.label),
  });

  async function onSubmit(values: RenameForm) {
    try {
      await mutation.mutateAsync(values);
      onOpenChange(false);
      onDone(`Subcategoria renombrada a "${values.label}".`);
    } catch {
      // El error se muestra via mutation.error mas abajo.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renombrar {subcategory.label}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldShell label="Nombre" htmlFor="rename-subcategory" error={form.formState.errors.label?.message}>
            <Input id="rename-subcategory" {...form.register("label")} />
          </FieldShell>
          <DialogMutationError error={mutation.error} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
