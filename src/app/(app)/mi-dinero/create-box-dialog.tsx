"use client";

import { z } from "zod";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/primitivas/dialog-parts";
import { Button } from "@/ui/primitivas/button";
import { FieldShell, Input, Select } from "@/ui/primitivas/field";
import { useZodForm } from "@/shared/forms/use-zod-form";
import { BoxTargetField } from "./box-target-field";
import { MoneyAmountField } from "./money-amount-field";
import { DialogMutationError } from "@/shared/ui/dialog-mutation-error";
import { useOptimisticMutation } from "@/shared/data/optimistic-mutation";
import { createBox } from "@/shared/api/money";
import { boxTypeLabels } from "@/shared/copy/money-copy";
import { BOX_TYPES } from "@/shared/types/domain";
import type { Box } from "@/shared/types/domain";
import type { AccountMoneySummary } from "@/shared/api/money-types";

const CreateBoxFormSchema = z
  .object({
    account_id: z.string().uuid("Elige la cuenta donde vive esta caja."),
    name: z.string().trim().min(1, "Ponle un nombre a la caja.").max(80),
    type: z.enum(BOX_TYPES),
    initial_balance: z.number().min(0, "El monto separado no puede ser negativo."),
    target_amount: z.number().min(0).nullable(),
    target_date: z.string().nullable(),
  })
  .refine((value) => value.target_amount == null || value.initial_balance <= value.target_amount, {
    path: ["initial_balance"],
    message: "El monto separado no debe superar la meta de la caja.",
  });
type CreateBoxForm = z.infer<typeof CreateBoxFormSchema>;

/** SCR-CUENTAS-05: crear caja. */
export function CreateBoxDialog({
  open,
  onOpenChange,
  accounts,
  defaultAccountId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountMoneySummary[];
  defaultAccountId?: string | null;
  onDone: (message: string) => void;
}) {
  const form = useZodForm(CreateBoxFormSchema, {
    defaultValues: {
      account_id: defaultAccountId ?? accounts[0]?.id ?? "",
      name: "",
      type: "objetivo",
      initial_balance: 0,
      target_amount: null,
      target_date: null,
    },
  });

  const mutation = useOptimisticMutation<CreateBoxForm, Box>({
    mutation: "box.upsert",
    mutationFn: (values) =>
      createBox({
        account_id: values.account_id,
        name: values.name,
        type: values.type,
        initial_balance: values.initial_balance,
        target_amount: values.target_amount,
        target_date: values.target_date,
      }),
  });

  async function onSubmit(values: CreateBoxForm) {
    try {
      await mutation.mutateAsync(values);
      onOpenChange(false);
      onDone("Caja creada. Tu dinero libre ya descuenta lo que separaste.");
    } catch {
      // El error se muestra via mutation.error mas abajo.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva caja</DialogTitle>
          <DialogDescription>
            Las cajas no duplican dinero. Si separas un monto, Manzana crea una asignacion interna
            auditada y lo descuenta del dinero libre.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldShell label="Cuenta" htmlFor="box-account" error={form.formState.errors.account_id?.message}>
            <Select id="box-account" {...form.register("account_id")}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {`${account.name} - libre S/${account.free_balance.toFixed(2)}`}
                </option>
              ))}
            </Select>
          </FieldShell>
          <FieldShell label="Nombre" htmlFor="box-name" error={form.formState.errors.name?.message}>
            <Input id="box-name" placeholder="Emergencia" {...form.register("name")} />
          </FieldShell>
          <FieldShell label="Tipo" htmlFor="box-type">
            <Select id="box-type" {...form.register("type")}>
              {BOX_TYPES.map((type) => (
                <option key={type} value={type}>
                  {boxTypeLabels[type]}
                </option>
              ))}
            </Select>
          </FieldShell>
          <MoneyAmountField
            id="box-initial-balance"
            label="Monto separado"
            hint="Opcional"
            defaultValue="0"
            error={form.formState.errors.initial_balance?.message}
            onValueChange={(value) => form.setValue("initial_balance", value, { shouldValidate: true })}
          />
          <BoxTargetField
            targetAmount={form.watch("target_amount")}
            targetDate={form.watch("target_date")}
            onTargetAmountChange={(value) => form.setValue("target_amount", value, { shouldValidate: true })}
            onTargetDateChange={(value) => form.setValue("target_date", value)}
          />
          <DialogMutationError error={mutation.error} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Crear caja
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
