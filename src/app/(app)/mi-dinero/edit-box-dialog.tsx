"use client";

import { z } from "zod";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/primitivas/dialog-parts";
import { Button } from "@/ui/primitivas/button";
import { FieldShell, Input, Select } from "@/ui/primitivas/field";
import { MoneyText } from "@/ui/primitivas/money";
import { useZodForm } from "@/shared/forms/use-zod-form";
import { useOptimisticMutation } from "@/shared/data/optimistic-mutation";
import { updateBox } from "@/shared/api/money";
import { DialogMutationError } from "@/shared/ui/dialog-mutation-error";
import { boxTypeLabels } from "@/shared/copy/money-copy";
import { BOX_TYPES } from "@/shared/types/domain";
import type { Box } from "@/shared/types/domain";
import type { BoxMoneySummary } from "@/shared/api/money-types";

const EditBoxFormSchema = z
  .object({
    name: z.string().trim().min(1, "Ponle un nombre a la caja.").max(80),
    type: z.enum(BOX_TYPES),
    target_amount: z.number().min(0).nullable(),
    target_date: z.string().nullable(),
    currentBalance: z.number(),
  })
  .refine((value) => value.target_amount == null || value.currentBalance <= value.target_amount, {
    path: ["target_amount"],
    message: "La meta no puede quedar por debajo del saldo actual.",
  });
type EditBoxForm = z.infer<typeof EditBoxFormSchema>;

/** SCR-CUENTAS-05: editar caja. Nunca cambia su saldo. */
export function EditBoxDialog({
  box,
  open,
  onOpenChange,
  onDone,
}: {
  box: BoxMoneySummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const form = useZodForm(EditBoxFormSchema, {
    defaultValues: {
      name: box.name,
      type: box.type,
      target_amount: box.target_amount,
      target_date: box.target_date,
      currentBalance: box.current_balance,
    },
  });

  const mutation = useOptimisticMutation<EditBoxForm, Box>({
    mutation: "box.upsert",
    mutationFn: (values) =>
      updateBox(box.id, {
        name: values.name,
        type: values.type,
        target_amount: values.target_amount,
        target_date: values.target_date,
      }),
  });

  async function onSubmit(values: EditBoxForm) {
    try {
      await mutation.mutateAsync(values);
      onOpenChange(false);
      onDone("Caja actualizada. El saldo no cambio.");
    } catch {
      // El error se muestra via mutation.error mas abajo.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {box.name}</DialogTitle>
          <DialogDescription>
            Editar una caja no cambia su saldo. Para mover dinero, usa &quot;Mover dinero&quot;.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-baseline justify-between rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm">
            <span className="text-text-secondary">Cuenta: {box.account_name}</span>
            <MoneyText value={box.current_balance} currency={box.currency} />
          </div>
          <FieldShell label="Nombre" htmlFor="edit-box-name" error={form.formState.errors.name?.message}>
            <Input id="edit-box-name" {...form.register("name")} />
          </FieldShell>
          <FieldShell label="Tipo" htmlFor="edit-box-type">
            <Select id="edit-box-type" {...form.register("type")}>
              {BOX_TYPES.map((type) => (
                <option key={type} value={type}>
                  {boxTypeLabels[type]}
                </option>
              ))}
            </Select>
          </FieldShell>
          <FieldShell
            label="Meta"
            htmlFor="edit-box-target"
            hint="Opcional"
            error={form.formState.errors.target_amount?.message}
          >
            <Input
              id="edit-box-target"
              inputMode="decimal"
              prefix="S/"
              defaultValue={box.target_amount ?? ""}
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (!raw) {
                  form.setValue("target_amount", null, { shouldValidate: true });
                  return;
                }
                const parsed = Number(raw.replace(",", "."));
                form.setValue("target_amount", Number.isFinite(parsed) ? parsed : NaN, {
                  shouldValidate: true,
                });
              }}
            />
          </FieldShell>
          <DialogMutationError error={mutation.error} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
