"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { Input } from "@/ui/primitivas/field";
import {
  deleteUserAccount,
  getAccountDeletionImpact,
  type AccountDeletionImpact,
} from "@/features/settings/settings-api";

const CONFIRMATION_PHRASE = "ELIMINAR MI CUENTA";

// `43` `SCR-AUTH-08` — irreversible, sin periodo de gracia (`RUL-AUTH-10`).
// Tres salvaguardas: exportar antes (arriba, en `ExportDataScreen`),
// enumerar qué se pierde con cifras reales, y escribir una palabra exacta.
// Jerarquía de botones según `WEB-D099`: el primario es cancelar.
export function DeleteAccountSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<AccountDeletionImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openSection() {
    setOpen(true);
    if (impact || loadingImpact) return;
    setLoadingImpact(true);
    getAccountDeletionImpact()
      .then(setImpact)
      .catch(() => setError("No pude calcular qué vas a perder. Inténtalo de nuevo."))
      .finally(() => setLoadingImpact(false));
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteUserAccount(confirmation);
      router.push("/cuenta-eliminada");
    } catch {
      setError("No pude eliminar tu cuenta ahora. Tus datos están a salvo; inténtalo de nuevo.");
      setDeleting(false);
    }
  }

  if (!open) {
    return (
      <section className="mt-8 border-t border-border pt-6">
        <h2 className="text-sm font-semibold text-text">Eliminar mi cuenta</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Esto no se puede deshacer.
        </p>
        <Button variant="danger" size="sm" className="mt-3" onClick={openSection}>
          Eliminar mi cuenta
        </Button>
      </section>
    );
  }

  return (
    <section className="mt-8 border-t border-border pt-6" aria-label="Eliminar mi cuenta">
      <Card elevated className="p-5">
        <h2 className="font-heading text-lg font-semibold text-text">Eliminar mi cuenta</h2>
        <p className="mt-2 text-sm text-text-secondary">Esto no se puede deshacer.</p>

        <div className="mt-4">
          <p className="text-sm font-medium text-text">Vas a perder:</p>
          {loadingImpact ? (
            <p className="mt-2 text-sm text-text-secondary">Calculando…</p>
          ) : impact ? (
            <ul className="mt-2 space-y-1 text-sm text-text-secondary">
              <li>{impact.movements.toLocaleString("es-PE")} movimientos</li>
              <li>{impact.debts.toLocaleString("es-PE")} deudas y su historial</li>
              <li>{impact.email_connections.toLocaleString("es-PE")} correos conectados</li>
              <li>{impact.learned_things.toLocaleString("es-PE")} cosas que aprendí sobre tu dinero</li>
              <li>{impact.conversations.toLocaleString("es-PE")} conversaciones</li>
            </ul>
          ) : null}
        </div>

        <label className="mt-4 block text-sm font-medium text-text" htmlFor="delete-confirmation">
          Escribe {CONFIRMATION_PHRASE} para confirmar
        </label>
        <Input
          id="delete-confirmation"
          className="mt-2"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
        />

        {error ? (
          <p role="alert" className="mt-3 text-sm text-error">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="danger"
            disabled={confirmation !== CONFIRMATION_PHRASE}
            loading={deleting}
            onClick={() => void handleDelete()}
          >
            Eliminar mi cuenta
          </Button>
        </div>
      </Card>
    </section>
  );
}
