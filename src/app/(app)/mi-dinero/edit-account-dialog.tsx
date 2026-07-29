"use client";

import { z } from "zod";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/primitivas/dialog-parts";
import { Button } from "@/ui/primitivas/button";
import { FieldShell, Input, Select } from "@/ui/primitivas/field";
import { useZodForm } from "@/shared/forms/use-zod-form";
import { useOptimisticMutation } from "@/shared/data/optimistic-mutation";
import { updateAccount } from "@/shared/api/money";
import { ApiClientError } from "@/shared/api/http-client";
import { accountTypeLabels } from "@/shared/copy/money-copy";
import { ACCOUNT_TYPES } from "@/shared/types/domain";
import type { Account } from "@/shared/types/domain";
import type { AccountMoneySummary } from "@/shared/api/money-types";

const EditAccountFormSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre a la cuenta.").max(80),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().trim().max(80).optional(),
});
type EditAccountForm = z.infer<typeof EditAccountFormSchema>;

/** SCR-CUENTAS-04: editar cuenta. Nunca cambia saldo ni moneda (24 S5.1). */
export function EditAccountDialog({
  account,
  open,
  onOpenChange,
  onDone,
}: {
  account: AccountMoneySummary | Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const form = useZodForm(EditAccountFormSchema, {
    defaultValues: {
      name: account.name,
      type: account.type,
      institution: account.institution ?? "",
    },
  });

  const mutation = useOptimisticMutation<EditAccountForm, Account>({
    mutation: "account.upsert",
    mutationFn: (values) =>
      updateAccount(account.id, {
        name: values.name,
        type: values.type,
        institution: values.institution?.trim() || null,
      }),
  });

  async function onSubmit(values: EditAccountForm) {
    try {
      await mutation.mutateAsync(values);
      onOpenChange(false);
      onDone("Cuenta actualizada. El saldo no cambio.");
    } catch {
      // El error se muestra via mutation.error mas abajo.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {account.name}</DialogTitle>
          <DialogDescription>
            Editar una cuenta no cambia saldo ni moneda. Si el saldo esta mal, corrigelo con un
            ajuste financiero auditado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldShell label="Nombre" htmlFor="edit-account-name" error={form.formState.errors.name?.message}>
            <Input id="edit-account-name" {...form.register("name")} />
          </FieldShell>
          <FieldShell label="Tipo" htmlFor="edit-account-type">
            <Select id="edit-account-type" {...form.register("type")}>
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {accountTypeLabels[type]}
                </option>
              ))}
            </Select>
          </FieldShell>
          <FieldShell label="Institucion o app" htmlFor="edit-account-institution" hint="Opcional">
            <Input id="edit-account-institution" {...form.register("institution")} />
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
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
