"use client";

import { z } from "zod";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/primitivas/dialog-parts";
import { Button } from "@/ui/primitivas/button";
import { FieldShell, Input, Select } from "@/ui/primitivas/field";
import { useZodForm } from "@/shared/forms/use-zod-form";
import { useOptimisticMutation } from "@/shared/data/optimistic-mutation";
import { createAccount } from "@/shared/api/money";
import { ApiClientError } from "@/shared/api/http-client";
import { accountTypeLabels } from "@/shared/copy/money-copy";
import { ACCOUNT_TYPES } from "@/shared/types/domain";
import type { Account } from "@/shared/types/domain";

const CreateAccountFormSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre a la cuenta.").max(80),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().trim().max(80).optional(),
  initial_balance: z.number().finite("El saldo inicial debe ser un numero valido."),
});
type CreateAccountForm = z.infer<typeof CreateAccountFormSchema>;

/** SCR-CUENTAS-04: crear cuenta. */
export function CreateAccountDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const form = useZodForm(CreateAccountFormSchema, {
    defaultValues: { name: "", type: "digital", institution: "", initial_balance: 0 },
  });

  const mutation = useOptimisticMutation<CreateAccountForm, Account>({
    mutation: "account.upsert",
    mutationFn: (values) =>
      createAccount({
        name: values.name,
        type: values.type,
        institution: values.institution?.trim() || null,
        initial_balance: values.initial_balance,
      }),
  });

  async function onSubmit(values: CreateAccountForm) {
    try {
      await mutation.mutateAsync(values);
      onOpenChange(false);
      onDone("Cuenta creada. Manzana ya puede calcular dinero libre con mas contexto.");
    } catch {
      // El error se muestra via mutation.error mas abajo.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva cuenta</DialogTitle>
          <DialogDescription>
            Esta cuenta activa saldos y dinero libre. Tus movimientos anteriores sin cuenta siguen
            intactos hasta que los vincules o corrijas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldShell label="Nombre" htmlFor="account-name" error={form.formState.errors.name?.message}>
            <Input id="account-name" placeholder="Yape" {...form.register("name")} />
          </FieldShell>
          <FieldShell label="Tipo" htmlFor="account-type">
            <Select id="account-type" {...form.register("type")}>
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {accountTypeLabels[type]}
                </option>
              ))}
            </Select>
          </FieldShell>
          <FieldShell label="Institucion o app" htmlFor="account-institution" hint="Opcional">
            <Input id="account-institution" placeholder="BCP" {...form.register("institution")} />
          </FieldShell>
          <FieldShell
            label="Saldo inicial"
            htmlFor="account-balance"
            error={form.formState.errors.initial_balance?.message}
          >
            <Input
              id="account-balance"
              inputMode="decimal"
              prefix="S/"
              defaultValue="0"
              onChange={(event) => {
                const parsed = Number(event.target.value.replace(",", "."));
                form.setValue("initial_balance", Number.isFinite(parsed) ? parsed : NaN, {
                  shouldValidate: true,
                });
              }}
            />
          </FieldShell>
          {mutation.error ? (
            <p role="alert" className="text-sm text-error">
              {mutation.error instanceof ApiClientError
                ? mutation.error.message
                : "No pude completar la accion. Intenta otra vez en un momento."}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Crear cuenta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
