"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/ui/primitivas/card";
import { Button } from "@/ui/primitivas/button";
import { LoadingBlock } from "@/ui/primitivas/states";
import { queryKeys } from "@/shared/data/query-keys";
import { listArchivedAccounts, restoreAccount } from "@/shared/api/money";
import { useOptimisticMutation } from "@/shared/data/optimistic-mutation";
import type { Account } from "@/shared/types/domain";

/** ACT-CUENTAS-04: cuentas archivadas, con la opcion de restaurarlas. */
export function ArchivedAccountsPanel({
  show,
  onToggle,
  onDone,
}: {
  show: boolean;
  onToggle: () => void;
  onDone: (message: string) => void;
}) {
  const query = useQuery({
    queryKey: [...queryKeys.accounts, "archivadas"],
    queryFn: listArchivedAccounts,
    enabled: show,
  });
  const mutation = useOptimisticMutation<string, { account: Account }>({
    mutation: "account.upsert",
    mutationFn: (accountId) => restoreAccount(accountId).then((r) => ({ account: r.account })),
  });

  return (
    <div>
      <button type="button" onClick={onToggle} className="text-sm font-medium text-text-secondary hover:text-text">
        {show ? "Ocultar cuentas archivadas" : "Ver cuentas archivadas"}
      </button>
      {show ? (
        <Card className="mt-2 p-4">
          {query.isLoading ? (
            <LoadingBlock label="Cargando cuentas archivadas" className="min-h-24 py-6" />
          ) : !query.data || query.data.length === 0 ? (
            <p className="text-sm text-text-muted">No tienes cuentas archivadas.</p>
          ) : (
            <ul className="divide-y divide-border">
              {query.data.map((account) => (
                <li key={account.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-sm text-text">{account.name}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={mutation.isPending}
                    onClick={async () => {
                      try {
                        await mutation.mutateAsync(account.id);
                        onDone(`${account.name} restaurada.`);
                        await query.refetch();
                      } catch {
                        // El error se refleja en mutation.error.
                      }
                    }}
                  >
                    Restaurar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
