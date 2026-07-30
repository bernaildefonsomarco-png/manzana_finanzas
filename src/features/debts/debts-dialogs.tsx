"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { CalendarDays, Landmark } from "lucide-react";
import { ApiClientError } from "@/features/movements/movements-api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/primitivas/alert-dialog";
import { Button } from "@/ui/primitivas/button";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitivas/dialog-parts";
import { FieldShell, Input, Select } from "@/ui/primitivas/field";
import { DiscreetValue } from "@/ui/primitivas/money";
import { Textarea } from "@/ui/primitivas/textarea";
import type {
  Account,
  DebtDirection,
  DebtKind,
} from "@/shared/types/domain";
import {
  closeDebt,
  createClientIdempotencyKey,
  createDebt,
  createDebtPayment,
  listDebtPaymentAccounts,
  previewDebtPayment,
  reopenDebt,
  rescheduleInstallment,
  skipInstallment,
  updateDebt,
} from "./debts-api";
import type {
  CreateDebtPayload,
  DebtDetailWithPayments,
  DebtInstallmentViewItem,
  DebtPaymentPreview,
  DebtWithPerson,
} from "./debts-types";
import {
  buildInstallmentSchedulePreview,
  debtDirectionLabels,
  debtKindLabels,
  formatDebtMoney,
  limaTodayIso,
  resolveDebtInstallmentPaymentTarget,
} from "./debts-view-model";

const debtKinds: DebtKind[] = [
  "personal",
  "bank_loan",
  "credit_card",
  "installment_purchase",
  "service_or_bill",
  "other",
];

export function DebtEditorDialog({
  debt,
  onClose,
  onSaved,
}: {
  debt: DebtWithPerson | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const editing = debt !== null;
  const [direction, setDirection] = useState<DebtDirection>(
    debt?.direction ?? "i_owe"
  );
  const [kind, setKind] = useState<DebtKind>(debt?.kind ?? "personal");
  const [name, setName] = useState(debt?.name ?? "");
  const [person, setPerson] = useState(
    debt?.related_person?.display_name ?? ""
  );
  const [principal, setPrincipal] = useState(
    debt ? String(debt.principal_amount) : ""
  );
  const [openedAt, setOpenedAt] = useState(
    debt?.opened_at ?? limaTodayIso()
  );
  const [firstDueDate, setFirstDueDate] = useState(
    debt ? debt.due_date ?? "" : ""
  );
  const [installmentCount, setInstallmentCount] = useState(
    debt?.installment_count ? String(debt.installment_count) : ""
  );
  const [installmentAmount, setInstallmentAmount] = useState(
    debt?.installment_amount ? String(debt.installment_amount) : ""
  );
  const [notes, setNotes] = useState(debt?.interest_notes ?? "");
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(
    createClientIdempotencyKey("debt-create")
  );

  useEffect(() => {
    if (editing) return;
    let active = true;
    void listDebtPaymentAccounts()
      .then((result) => {
        if (active) setAccounts(result.accounts.filter((item) => item.currency === "PEN"));
      })
      .catch(() => {
        if (active) setAccounts([]);
      });
    return () => {
      active = false;
    };
  }, [editing]);

  const numericPrincipal = Number(principal);
  const numericCount = Number(installmentCount);
  const numericInstallment = installmentAmount
    ? Number(installmentAmount)
    : null;
  const schedule = useMemo(
    () =>
      buildInstallmentSchedulePreview({
        principalAmount: numericPrincipal,
        installmentCount: numericCount,
        installmentAmount: numericInstallment,
        firstDueDate,
      }),
    [firstDueDate, numericCount, numericInstallment, numericPrincipal]
  );
  const scheduleTotal = schedule.reduce((sum, item) => sum + item.amount, 0);
  const scheduleMismatch =
    schedule.length > 0 &&
    numericInstallment !== null &&
    Math.abs(scheduleTotal - numericPrincipal) / numericPrincipal > 0.01;
  const accountEligible =
    kind === "personal" || kind === "bank_loan";
  const dueBeforeOpened =
    firstDueDate.length > 0 && firstDueDate <= openedAt;
  const canSubmit = editing
    ? name.trim().length > 0 && !dueBeforeOpened
    : name.trim().length > 0 &&
      numericPrincipal > 0 &&
      openedAt <= limaTodayIso() &&
      !dueBeforeOpened &&
      (!installmentCount ||
        (schedule.length === numericCount && !scheduleMismatch));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (debt) {
        await updateDebt(debt.id, {
          name: name.trim(),
          kind,
          due_date: firstDueDate || null,
          interest_notes: notes.trim() || null,
        });
      } else {
        const payload: CreateDebtPayload = {
          direction,
          kind,
          name: name.trim(),
          related_person_name: person.trim() || null,
          principal_amount: numericPrincipal,
          currency: "PEN",
          opened_at: openedAt,
          due_date: firstDueDate || null,
          next_payment_date: installmentCount ? firstDueDate || null : null,
          installment_count: installmentCount ? numericCount : null,
          installment_amount: numericInstallment,
          interest_notes: notes.trim() || null,
          account_id: accountEligible ? accountId || null : null,
        };
        await createDebt(payload, idempotencyKey.current);
      }
      await onSaved();
    } catch (caught) {
      setError(toUiError(caught));
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar deuda" : "Crear deuda"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Solo cambiaremos datos descriptivos; saldo y pagos quedan intactos."
              : "La deuda y sus cuotas se guardan juntas. Crear no mueve dinero salvo que vincules una cuenta de préstamo."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={submit}>
          {!editing ? (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-text-secondary">
                Dirección
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["i_owe", "they_owe_me"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={direction === value}
                    className={
                      direction === value
                        ? "rounded-lg border border-brand bg-brand-subtle p-3 text-left text-text"
                        : "rounded-lg border border-border p-3 text-left text-text-secondary"
                    }
                    onClick={() => setDirection(value)}
                  >
                    <span className="font-medium">
                      {debtDirectionLabels[value]}
                    </span>
                    <span className="mt-1 block text-xs text-text-muted">
                      {value === "i_owe"
                        ? "Un compromiso que tú pagarás."
                        : "Dinero que esperas recibir, sin lenguaje de cobranza."}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Nombre" htmlFor="debt-name" required>
              <Input
                id="debt-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
              />
            </FieldShell>
            <FieldShell label="Tipo" htmlFor="debt-kind" required>
              <Select
                id="debt-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as DebtKind)}
              >
                {debtKinds.map((value) => (
                  <option key={value} value={value}>
                    {debtKindLabels[value]}
                  </option>
                ))}
              </Select>
            </FieldShell>
          </div>

          {!editing ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell
                  label="Persona o entidad"
                  htmlFor="debt-person"
                  hint="Opcional. Solo guardamos el nombre, nunca contacto ni datos bancarios."
                >
                  <Input
                    id="debt-person"
                    value={person}
                    onChange={(event) => setPerson(event.target.value)}
                    maxLength={60}
                  />
                </FieldShell>
                <FieldShell label="Monto en soles" htmlFor="debt-principal" required>
                  <Input
                    id="debt-principal"
                    type="number"
                    min="0.01"
                    step="0.01"
                    prefix="S/"
                    value={principal}
                    onChange={(event) => setPrincipal(event.target.value)}
                  />
                </FieldShell>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell label="Fecha de apertura" htmlFor="debt-opened" required>
                  <Input
                    id="debt-opened"
                    type="date"
                    max={limaTodayIso()}
                    value={openedAt}
                    onChange={(event) => setOpenedAt(event.target.value)}
                  />
                </FieldShell>
                <FieldShell
                  label="Primera fecha o vencimiento"
                  htmlFor="debt-first-due"
                  error={
                    dueBeforeOpened
                      ? "La fecha debe ser posterior a la apertura."
                      : installmentCount && !firstDueDate
                      ? "Necesitas una fecha para generar las cuotas."
                      : undefined
                  }
                >
                  <Input
                    id="debt-first-due"
                    type="date"
                    min={openedAt}
                    value={firstDueDate}
                    onChange={(event) => setFirstDueDate(event.target.value)}
                  />
                </FieldShell>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell label="Número de cuotas" htmlFor="debt-count" hint="Opcional, máximo 360.">
                  <Input
                    id="debt-count"
                    type="number"
                    min="1"
                    max="360"
                    step="1"
                    value={installmentCount}
                    onChange={(event) => setInstallmentCount(event.target.value)}
                  />
                </FieldShell>
                <FieldShell
                  label="Monto por cuota"
                  htmlFor="debt-installment-amount"
                  hint="Opcional; si lo omites, dividimos el principal."
                  error={
                    scheduleMismatch
                      ? "Las cuotas deben aproximarse al total con tolerancia de 1%."
                      : undefined
                  }
                >
                  <Input
                    id="debt-installment-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    prefix="S/"
                    value={installmentAmount}
                    onChange={(event) => setInstallmentAmount(event.target.value)}
                  />
                </FieldShell>
              </div>
              {accountEligible ? (
                <FieldShell
                  label={
                    direction === "i_owe"
                      ? "Cuenta donde recibiste el préstamo"
                      : "Cuenta desde donde prestaste"
                  }
                  htmlFor="debt-account"
                  hint="Opcional. Si eliges una, ese movimiento se crea en la misma transacción."
                >
                  <Select
                    id="debt-account"
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                  >
                    <option value="">Sin movimiento de cuenta</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </FieldShell>
              ) : (
                <div className="rounded-lg border border-border bg-bg-surface p-3 text-sm text-text-secondary">
                  Esta deuda no representa efectivo recibido o prestado. No
                  inventaremos un movimiento de cuenta.
                </div>
              )}
            </>
          ) : (
            <FieldShell
              label="Vencimiento"
              htmlFor="debt-edit-due"
              error={
                dueBeforeOpened
                  ? "La fecha debe ser posterior a la apertura."
                  : undefined
              }
            >
              <Input
                id="debt-edit-due"
                type="date"
                value={firstDueDate}
                onChange={(event) => setFirstDueDate(event.target.value)}
              />
            </FieldShell>
          )}

          <FieldShell
            label="Notas del acuerdo"
            htmlFor="debt-notes"
            hint="Solo texto recordatorio. Manzana no calcula interés ni mora."
          >
            <Textarea
              id="debt-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={300}
            />
          </FieldShell>

          {!editing && schedule.length > 0 ? (
            <section
              aria-label="Vista previa de cuotas"
              className="rounded-lg border border-border bg-bg-surface p-4"
            >
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand" />
                <h3 className="font-medium text-text">
                  Vista previa: {schedule.length} cuotas
                </h3>
              </div>
              <ol className="mt-3 max-h-40 space-y-2 overflow-auto text-sm">
                {schedule.map((item) => (
                  <li
                    key={item.number}
                    className="flex justify-between gap-3 text-text-secondary"
                  >
                    <span>
                      Cuota {item.number} · {item.due_date}
                    </span>
                    <DiscreetValue>
                      {formatDebtMoney(item.amount)}
                    </DiscreetValue>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {error ? <InlineError message={error} /> : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting} disabled={!canSubmit}>
              {editing ? "Guardar cambios" : "Crear deuda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DebtPaymentDialog({
  debt,
  requestedInstallmentId,
  onClose,
  onSaved,
}: {
  debt: DebtDetailWithPayments;
  requestedInstallmentId?: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const target = resolveDebtInstallmentPaymentTarget(
    debt,
    requestedInstallmentId
  );
  const [amount, setAmount] = useState(
    String(target?.amount ?? debt.current_balance)
  );
  const [paidAt, setPaidAt] = useState(limaTodayIso());
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [previewResult, setPreviewResult] = useState<{
    amount: number;
    value?: DebtPaymentPreview;
    error?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(
    createClientIdempotencyKey(`debt-payment:${debt.id}`)
  );
  const numericAmount = Number(amount);
  const overpayment =
    Number.isFinite(numericAmount) && numericAmount > debt.current_balance;
  const validAmount =
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    numericAmount <= debt.current_balance;
  const matchingPreview =
    validAmount && previewResult?.amount === numericAmount
      ? previewResult
      : null;
  const preview = matchingPreview?.value ?? null;
  const previewError = matchingPreview?.error ?? null;
  const previewState = !validAmount
    ? "idle"
    : preview
      ? "ready"
      : previewError
        ? "error"
        : "loading";

  useEffect(() => {
    let active = true;
    void listDebtPaymentAccounts()
      .then((result) => {
        if (active) {
          setAccounts(
            result.accounts.filter((account) => account.currency === debt.currency)
          );
        }
      })
      .catch(() => {
        if (active) setAccounts([]);
      });
    return () => {
      active = false;
    };
  }, [debt.currency]);

  useEffect(() => {
    if (!validAmount) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void previewDebtPayment(debt.id, numericAmount)
        .then((result) => {
          if (!active) return;
          setPreviewResult({ amount: numericAmount, value: result });
        })
        .catch((caught) => {
          if (!active) return;
          setPreviewResult({
            amount: numericAmount,
            error: toUiError(caught),
          });
        });
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [debt.id, numericAmount, validAmount]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || preview.amount !== numericAmount || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createDebtPayment(
        debt.id,
        {
          amount: numericAmount,
          account_id: accountId || null,
          paid_at: `${paidAt}T12:00:00-05:00`,
          note: note.trim() || null,
        },
        idempotencyKey.current
      );
      await onSaved();
    } catch (caught) {
      setError(toUiError(caught));
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {debt.direction === "i_owe"
              ? "Registrar pago"
              : "Registrar devolución"}
          </DialogTitle>
          <DialogDescription>
            Verás exactamente cómo se repartirá antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={submit}>
          <div className="rounded-lg border border-border bg-bg-surface p-4">
            <p className="text-sm text-text-secondary">
              Saldo actual de <DiscreetValue>{debt.name}</DiscreetValue>
            </p>
            <p className="mt-1 font-heading text-2xl font-semibold text-text">
              <DiscreetValue>
                {formatDebtMoney(debt.current_balance, debt.currency)}
              </DiscreetValue>
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell
              label={
                debt.direction === "i_owe" ? "Monto pagado" : "Monto recibido"
              }
              htmlFor="debt-payment-amount"
              required
              error={
                overpayment
                  ? "No aceptamos sobrepago: usa el saldo exacto o registra la diferencia como otro movimiento."
                  : undefined
              }
            >
              <Input
                id="debt-payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                prefix="S/"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </FieldShell>
            <FieldShell label="Fecha en Lima" htmlFor="debt-payment-date" required>
              <Input
                id="debt-payment-date"
                type="date"
                max={limaTodayIso()}
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
              />
            </FieldShell>
          </div>
          {overpayment ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setAmount(String(debt.current_balance))}
              >
                Usar saldo exacto
              </Button>
              <Link
                href="/movimientos/nuevo"
                className="inline-flex h-9 items-center justify-center rounded-md border border-transparent px-3 font-heading text-sm font-medium text-text-secondary transition hover:bg-bg-surface hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                Registrar diferencia aparte
              </Link>
            </div>
          ) : null}
          <FieldShell
            label={
              debt.direction === "i_owe"
                ? "Cuenta desde donde pagaste"
                : "Cuenta donde recibiste"
            }
            htmlFor="debt-payment-account"
            hint="Opcional. Sin cuenta, la deuda cambia pero los saldos de cuenta no."
          >
            <Select
              id="debt-payment-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">Sin cuenta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </FieldShell>
          {debt.linked_box ? (
            <div className="rounded-lg border border-brand-subtle bg-brand-subtle/35 p-4 text-sm text-text-secondary">
              <p className="flex items-center gap-2 font-medium text-text">
                <Landmark className="h-4 w-4" />
                Caja vinculada:{" "}
                <DiscreetValue>{debt.linked_box.name}</DiscreetValue>
              </p>
              <p className="mt-1">
                Reservado:{" "}
                <DiscreetValue>
                  {formatDebtMoney(debt.linked_box.current_balance)}
                </DiscreetValue>
                . No la consumiremos automáticamente: este pago usa solo la
                cuenta que elijas o queda sin cuenta.
              </p>
            </div>
          ) : null}
          <FieldShell label="Nota" htmlFor="debt-payment-note" hint="Opcional.">
            <Input
              id="debt-payment-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={180}
            />
          </FieldShell>

          <section
            aria-live="polite"
            className="rounded-lg border border-border bg-bg-primary p-4"
          >
            <h3 className="font-medium text-text">
              Aplicación antes de confirmar
            </h3>
            {previewState === "loading" ? (
              <p className="mt-2 text-sm text-text-secondary">
                Calculando oldest-first…
              </p>
            ) : previewState === "error" ? (
              <p className="mt-2 text-sm text-error">{previewError}</p>
            ) : preview ? (
              <div className="mt-3 space-y-2 text-sm text-text-secondary">
                <p>
                  {debt.direction === "i_owe" ? "Pagas" : "Recibes"}{" "}
                  <strong className="text-text">
                    <DiscreetValue>
                      {formatDebtMoney(preview.amount, debt.currency)}
                    </DiscreetValue>
                  </strong>
                </p>
                {preview.allocations.map((allocation) => (
                  <p key={allocation.installment_id}>
                    →{" "}
                    <DiscreetValue>
                      {formatDebtMoney(
                        allocation.allocated_amount,
                        debt.currency
                      )}
                    </DiscreetValue>{" "}
                    a cuota {allocation.installment_number} ({allocation.due_date})
                  </p>
                ))}
                {preview.allocations.length === 0 ? (
                  <p>→ Sin calendario: el monto reduce directamente el saldo.</p>
                ) : null}
                {preview.unallocated_amount > 0 ? (
                  <p>
                    →{" "}
                    <DiscreetValue>
                      {formatDebtMoney(
                        preview.unallocated_amount,
                        debt.currency
                      )}
                    </DiscreetValue>{" "}
                    reduce saldo sin asignación porque no quedan cuotas abiertas.
                  </p>
                ) : null}
                <p className="border-t border-border pt-2 font-medium text-text">
                  Quedará{" "}
                  <DiscreetValue>
                    {formatDebtMoney(
                      preview.projected_balance,
                      debt.currency
                    )}
                  </DiscreetValue>
                  .
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-text-muted">
                Ingresa un monto válido para ver la distribución.
              </p>
            )}
          </section>
          {error ? <InlineError message={error} /> : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={submitting}
              disabled={!preview || preview.amount !== numericAmount}
            >
              {debt.direction === "i_owe"
                ? "Registrar pago"
                : "Registrar devolución"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DebtCloseDialog({
  debt,
  onClose,
  onSaved,
}: {
  debt: DebtDetailWithPayments;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [reason, setReason] = useState<"paid" | "forgiven" | null>(
    debt.current_balance === 0 ? "paid" : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(
    createClientIdempotencyKey(`debt-close:${debt.id}`)
  );

  async function confirm() {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await closeDebt(debt.id, reason, idempotencyKey.current);
      await onSaved();
    } catch (caught) {
      setError(toUiError(caught));
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent size="md">
        <AlertDialogHeader>
          <AlertDialogTitle>Cerrar deuda</AlertDialogTitle>
          <AlertDialogDescription>
            Pagada y condonada son hechos distintos. Elige explícitamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset className="space-y-3">
          <legend className="sr-only">Motivo de cierre</legend>
          <label className="flex gap-3 rounded-lg border border-border p-3">
            <input
              type="radio"
              name="close-reason"
              checked={reason === "paid"}
              disabled={debt.current_balance !== 0}
              onChange={() => setReason("paid")}
            />
            <span>
              <span className="block font-medium text-text">Ya está pagada</span>
              <span className="mt-1 block text-sm text-text-secondary">
                {debt.current_balance === 0
                  ? "El saldo confirmado ya es cero."
                  : "Primero registra los pagos faltantes; no inventaremos un ajuste."}
              </span>
            </span>
          </label>
          <label className="flex gap-3 rounded-lg border border-border p-3">
            <input
              type="radio"
              name="close-reason"
              checked={reason === "forgiven"}
              disabled={debt.current_balance === 0}
              onChange={() => setReason("forgiven")}
            />
            <span>
              <span className="block font-medium text-text">
                Me la perdonaron
              </span>
              <span className="mt-1 block text-sm text-text-secondary">
                Guardaremos el saldo condonado; no contará como pago.
              </span>
            </span>
          </label>
        </fieldset>
        {error ? <InlineError message={error} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Volver</AlertDialogCancel>
          <AlertDialogAction
            disabled={!reason || submitting}
            onClick={() => void confirm()}
          >
            {reason === "forgiven" ? "Condonar deuda" : "Cerrar como pagada"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DebtReopenDialog({
  debt,
  onClose,
  onSaved,
}: {
  debt: DebtDetailWithPayments;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(
    createClientIdempotencyKey(`debt-reopen:${debt.id}`)
  );
  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      await reopenDebt(debt.id, idempotencyKey.current);
      await onSaved();
    } catch (caught) {
      setError(toUiError(caught));
      setSubmitting(false);
    }
  }
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reabrir deuda condonada</AlertDialogTitle>
          <AlertDialogDescription>
            Restauraremos exactamente el saldo perdonado registrado. Una deuda
            pagada no se puede reabrir desde aquí.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <InlineError message={error} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting || debt.status !== "cancelled"}
            onClick={() => void confirm()}
          >
            Reabrir deuda condonada
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RescheduleInstallmentDialog({
  debtId,
  installment,
  onClose,
  onSaved,
}: {
  debtId: string;
  installment: DebtInstallmentViewItem;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [dueDate, setDueDate] = useState(installment.due_date);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(
    createClientIdempotencyKey(`installment-reschedule:${installment.id}`)
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dueDate || dueDate === installment.due_date || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await rescheduleInstallment(
        debtId,
        installment.id,
        { due_date: dueDate, reason: reason.trim() || null },
        idempotencyKey.current
      );
      await onSaved();
    } catch (caught) {
      setError(toUiError(caught));
      setSubmitting(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reprogramar cuota {installment.number}</DialogTitle>
          <DialogDescription>
            Solo cambiaremos la fecha. El monto pagado y esperado no se tocan.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <FieldShell label="Nueva fecha" htmlFor="reschedule-date" required>
            <Input
              id="reschedule-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </FieldShell>
          <FieldShell label="Motivo" htmlFor="reschedule-reason" hint="Opcional.">
            <Input
              id="reschedule-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={180}
            />
          </FieldShell>
          {error ? <InlineError message={error} /> : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={submitting}
              disabled={!dueDate || dueDate === installment.due_date}
            >
              Reprogramar cuota
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SkipInstallmentDialog({
  debtId,
  installment,
  onClose,
  onSaved,
}: {
  debtId: string;
  installment: DebtInstallmentViewItem;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(
    createClientIdempotencyKey(`installment-skip:${installment.id}`)
  );
  async function confirm() {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await skipInstallment(
        debtId,
        installment.id,
        reason.trim(),
        idempotencyKey.current
      );
      await onSaved();
    } catch (caught) {
      setError(toUiError(caught));
      setSubmitting(false);
    }
  }
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Omitir cuota {installment.number}</AlertDialogTitle>
          <AlertDialogDescription>
            La cuota quedará terminal y no volverá a abrirse automáticamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FieldShell label="Motivo" htmlFor="skip-reason" required>
          <Input
            id="skip-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={180}
          />
        </FieldShell>
        {error ? <InlineError message={error} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!reason.trim() || submitting}
            onClick={() => void confirm()}
          >
            Omitir esta cuota
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-error-subtle bg-error-subtle/55 p-3 text-sm text-error"
    >
      {message}
    </div>
  );
}

function toUiError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}
