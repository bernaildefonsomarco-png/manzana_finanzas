"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CreditCard,
  Landmark,
  Layers,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { ApiClientError } from "@/features/movements/movements-api";
import { Button } from "@/ui/primitivas/button";
import { cn } from "@/ui/primitivas/cn";
import { FieldShell, Input, Select } from "@/ui/primitivas/field";
import { MoneyText } from "@/ui/primitivas/money";
import { EmptyState, ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import type { AccountType, BoxType } from "@/shared/types/domain";
import {
  createAccount,
  createBox,
  deleteAccount,
  deleteBox,
  executeMoneyAction,
  getMoneyDashboard,
  updateAccount,
  updateBox,
  type MoneyActionPayload,
} from "./money-api";
import type {
  AccountBalanceStatus,
  AccountMoneySummary,
  BoxMoneySummary,
  MoneyDashboardResponse,
} from "./money-types";
import {
  accountTypeLabels,
  boxTypeLabels,
  getAccountStatusLabel,
  getMoneyHeroCopy,
} from "./money-view-model";

type MoneyScreenProps = {
  onSignOut?: () => void;
  onNavigate?: (view: AppView) => void;
};

type LoadState = "loading" | "ready" | "error";
type MoneyActionMode = "adjust" | "transfer" | "box";
type MoneyActionIntent = {
  mode: MoneyActionMode;
  accountId?: string;
  boxId?: string;
};

const accountTypeOptions: Array<{
  type: AccountType;
  label: string;
  hint: string;
}> = [
  { type: "digital", label: "Digital", hint: "Yape, Plin, PayPal" },
  { type: "banco", label: "Banco", hint: "BCP, Interbank, BBVA" },
  { type: "fisico", label: "Efectivo", hint: "Billetera o caja fisica" },
  { type: "tarjeta", label: "Tarjeta", hint: "Debito o prepago" },
];

const boxTypeOptions: Array<{
  type: BoxType;
  label: string;
  hint: string;
}> = [
  { type: "compromiso", label: "Compromiso", hint: "Alquiler, cuota, pago fijo" },
  { type: "objetivo", label: "Objetivo", hint: "Viaje, compra, proyecto" },
  { type: "emergencia", label: "Emergencia", hint: "Reserva para imprevistos" },
];

export function MoneyScreen({ onSignOut, onNavigate }: MoneyScreenProps) {
  const [data, setData] = useState<MoneyDashboardResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [uiError, setUiError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountMoneySummary | null>(null);
  const [deletingAccount, setDeletingAccount] =
    useState<AccountMoneySummary | null>(null);
  const [boxModalOpen, setBoxModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<BoxMoneySummary | null>(null);
  const [deletingBox, setDeletingBox] = useState<BoxMoneySummary | null>(null);
  const [moneyActionIntent, setMoneyActionIntent] =
    useState<MoneyActionIntent | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadMoney = useCallback(async () => {
    setLoadState("loading");
    setUiError(null);

    try {
      const nextData = await getMoneyDashboard();
      setData(nextData);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setUiError(toUiError(error));
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const nextData = await getMoneyDashboard();
        if (!active) return;
        setData(nextData);
        setLoadState("ready");
      } catch (error) {
        if (!active) return;
        setLoadState("error");
        setUiError(toUiError(error));
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const heroCopy = useMemo(() => {
    if (!data) return "";

    return getMoneyHeroCopy({
      hasAccounts: data.data_quality.has_accounts,
      freeInAccounts: data.free_in_accounts,
      separatedInBoxes: data.separated_in_boxes,
      upcomingUncoveredCommitments: data.upcoming_uncovered_commitments,
    });
  }, [data]);

  async function handleAccountCreated() {
    setModalOpen(false);
    setFeedback("Cuenta creada. Manzana ya puede calcular dinero libre con mas contexto.");
    await loadMoney();
  }

  async function handleAccountUpdated() {
    setEditingAccount(null);
    setFeedback("Cuenta actualizada. El saldo no cambio.");
    await loadMoney();
  }

  async function handleAccountDeleted() {
    setDeletingAccount(null);
    setFeedback("Cuenta eliminada.");
    await loadMoney();
  }

  async function handleBoxCreated() {
    setBoxModalOpen(false);
    setFeedback("Caja creada. Tu dinero libre ya descuenta lo que separaste.");
    await loadMoney();
  }

  async function handleBoxUpdated() {
    setEditingBox(null);
    setFeedback("Caja actualizada. El saldo no cambio.");
    await loadMoney();
  }

  async function handleBoxDeleted(releasedAmount: number) {
    setDeletingBox(null);
    setFeedback(
      releasedAmount > 0
        ? "Caja eliminada. El monto separado volvio a tu dinero libre."
        : "Caja eliminada."
    );
    await loadMoney();
  }

  async function handleMoneyActionCompleted(message: string) {
    setMoneyActionIntent(null);
    setFeedback(message);
    await loadMoney();
  }

  return (
    <AppShell
      title="Mi Dinero"
      subtitle="Cuentas, cajas y dinero libre sin mezclar datos pendientes."
      activeView="money"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      primaryAction={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
          Agregar cuenta
        </Button>
      }
      mobilePrimaryAction={
        <Button
          size="icon"
          aria-label="Agregar cuenta"
          icon={<Plus className="h-5 w-5" />}
          onClick={() => setModalOpen(true)}
          className="h-12 w-12 rounded-full shadow-lg"
        >
          Agregar cuenta
        </Button>
      }
    >
      <div id="mi-dinero" className="mx-auto max-w-[1040px] pb-10 pt-2 lg:pt-4">
        {loadState === "loading" ? (
          <LoadingBlock label="Calculando Mi Dinero" />
        ) : loadState === "error" || !data ? (
          <ErrorState
            title="No pude cargar Mi Dinero"
            description={uiError ?? "Intenta de nuevo en un momento."}
            onRetry={() => void loadMoney()}
          />
        ) : (
          <div className="space-y-6">
            {feedback ? (
              <div className="flex items-start gap-2 rounded-lg border border-success-subtle bg-success-subtle/60 px-4 py-3 text-sm text-text-secondary">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{feedback}</span>
                <button
                  type="button"
                  aria-label="Cerrar mensaje"
                  className="ml-auto text-text-muted hover:text-text"
                  onClick={() => setFeedback(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <MoneyHero
              data={data}
              copy={heroCopy}
              onAddAccount={() => setModalOpen(true)}
              onMoneyAction={() => setMoneyActionIntent({ mode: "transfer" })}
            />

            {data.data_quality.warnings.length > 0 ? (
              <WarningsPanel warnings={data.data_quality.warnings} />
            ) : null}

            {data.accounts.length === 0 ? (
              <EmptyMoneyState onAddAccount={() => setModalOpen(true)} />
            ) : (
              <section className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
                <AccountsPanel
                  accounts={data.accounts}
                  onEditAccount={setEditingAccount}
                  onDeleteAccount={setDeletingAccount}
                  onAdjustAccount={(account) =>
                    setMoneyActionIntent({ mode: "adjust", accountId: account.id })
                  }
                  onTransferFromAccount={(account) =>
                    setMoneyActionIntent({
                      mode: "transfer",
                      accountId: account.id,
                    })
                  }
                />
                <div className="space-y-5">
                  <BoxesPanel
                    boxes={data.boxes}
                    onAddBox={() => setBoxModalOpen(true)}
                    onSeparateMoney={() => setMoneyActionIntent({ mode: "box" })}
                    onEditBox={setEditingBox}
                    onDeleteBox={setDeletingBox}
                    onMoveBox={(box) =>
                      setMoneyActionIntent({ mode: "box", boxId: box.id })
                    }
                  />
                  <ProtectionPanel onNavigate={onNavigate} />
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {modalOpen ? (
        <AccountModal
          onClose={() => setModalOpen(false)}
          onCreated={handleAccountCreated}
        />
      ) : null}

      {editingAccount ? (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onUpdated={handleAccountUpdated}
        />
      ) : null}

      {deletingAccount ? (
        <DeleteAccountDialog
          account={deletingAccount}
          onClose={() => setDeletingAccount(null)}
          onDeleted={handleAccountDeleted}
        />
      ) : null}

      {boxModalOpen && data ? (
        <BoxModal
          accounts={data.accounts}
          onClose={() => setBoxModalOpen(false)}
          onCreated={handleBoxCreated}
        />
      ) : null}

      {editingBox ? (
        <EditBoxModal
          box={editingBox}
          onClose={() => setEditingBox(null)}
          onUpdated={handleBoxUpdated}
        />
      ) : null}

      {deletingBox ? (
        <DeleteBoxDialog
          box={deletingBox}
          onClose={() => setDeletingBox(null)}
          onDeleted={handleBoxDeleted}
        />
      ) : null}

      {moneyActionIntent && data ? (
        <MoneyActionModal
          data={data}
          intent={moneyActionIntent}
          onClose={() => setMoneyActionIntent(null)}
          onCompleted={handleMoneyActionCompleted}
        />
      ) : null}
    </AppShell>
  );
}

function MoneyHero({
  data,
  copy,
  onAddAccount,
  onMoneyAction,
}: {
  data: MoneyDashboardResponse;
  copy: string;
  onAddAccount: () => void;
  onMoneyAction: () => void;
}) {
  const hasAccounts = data.data_quality.has_accounts;

  return (
    <section className="rounded-xl border border-border bg-bg-surface-raised p-6 shadow-xs sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            Dinero libre
          </p>
          {hasAccounts ? (
            <MoneyText
              value={data.operational_free_money}
              className="mt-4 block font-heading text-5xl font-semibold leading-none text-text sm:text-6xl"
            />
          ) : (
            <h1 className="mt-4 max-w-xl font-heading text-3xl font-semibold leading-tight text-text sm:text-4xl">
              Todavia no calculamos saldos
            </h1>
          )}
          <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary">
            {copy}
          </p>
        </div>

        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
          <WalletCards className="h-7 w-7" />
        </div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyMetric label="Saldo total" value={data.total_balance} disabled={!hasAccounts} />
        <MoneyMetric label="Separado en cajas" value={data.separated_in_boxes} disabled={!hasAccounts} />
        <MoneyMetric label="Libre en cuentas" value={data.free_in_accounts} disabled={!hasAccounts} />
        <MoneyMetric
          label="Compromisos sin cubrir"
          value={data.upcoming_uncovered_commitments}
          disabled={!hasAccounts}
        />
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {!hasAccounts ? (
          <Button icon={<Plus className="h-4 w-4" />} onClick={onAddAccount}>
            Crear primera cuenta
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              icon={<ArrowRight className="h-4 w-4" />}
              onClick={onMoneyAction}
            >
              Mover dinero
            </Button>
            <Button
              variant="ghost"
              icon={<Plus className="h-4 w-4" />}
              onClick={onAddAccount}
            >
              Agregar cuenta
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

function MoneyMetric({
  label,
  value,
  disabled,
}: {
  label: string;
  value: number;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-primary px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      {disabled ? (
        <p className="mt-1 font-heading text-xl font-semibold text-text-muted">
          Sin dato
        </p>
      ) : (
        <MoneyText
          value={value}
          className="mt-1 block font-heading text-xl font-semibold text-text"
        />
      )}
    </div>
  );
}

function EmptyMoneyState({ onAddAccount }: { onAddAccount: () => void }) {
  return (
    <EmptyState
      className="border-dashed"
      icon={<WalletCards className="h-5 w-5" />}
      title="Agrega tu primera cuenta"
      description="Puedes empezar con Yape, efectivo o una cuenta bancaria. No hace falta que el saldo sea perfecto: Manzana lo marcara como dato declarado por ti."
      action={
        <Button icon={<Plus className="h-4 w-4" />} onClick={onAddAccount}>
          Agregar cuenta
        </Button>
      }
    />
  );
}

function AccountsPanel({
  accounts,
  onEditAccount,
  onDeleteAccount,
  onAdjustAccount,
  onTransferFromAccount,
}: {
  accounts: AccountMoneySummary[];
  onEditAccount: (account: AccountMoneySummary) => void;
  onDeleteAccount: (account: AccountMoneySummary) => void;
  onAdjustAccount: (account: AccountMoneySummary) => void;
  onTransferFromAccount: (account: AccountMoneySummary) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-normal text-text">
            Cuentas
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Donde esta tu dinero registrado.
          </p>
        </div>
        <span className="rounded-full bg-brand-subtle px-3 py-1 text-sm font-medium text-text-brand">
          {accounts.length}
        </span>
      </div>

      <div className="divide-y divide-border/70">
        {accounts.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            onEdit={() => onEditAccount(account)}
            onDelete={() => onDeleteAccount(account)}
            onAdjust={() => onAdjustAccount(account)}
            onTransfer={() => onTransferFromAccount(account)}
          />
        ))}
      </div>
    </section>
  );
}

function AccountRow({
  account,
  onEdit,
  onDelete,
  onAdjust,
  onTransfer,
}: {
  account: AccountMoneySummary;
  onEdit: () => void;
  onDelete: () => void;
  onAdjust: () => void;
  onTransfer: () => void;
}) {
  const statusTone = getStatusTone(account.balance_status);

  return (
    <article className="flex min-w-0 items-center gap-4 py-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
        {getAccountIcon(account.type)}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-heading text-base font-semibold text-text">
            {account.name}
          </h3>
          {account.is_default ? (
            <span className="rounded-full bg-bg-surface px-2 py-0.5 text-xs text-text-secondary">
              Default
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-sm text-text-secondary">
          {account.institution ?? accountTypeLabels[account.type]} -{" "}
          {accountTypeLabels[account.type]}
        </p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="min-w-28 text-right">
          <MoneyText
            value={account.current_balance}
            className="font-heading text-base font-semibold text-text"
          />
          <p className={cn("mt-1 text-xs font-medium", statusTone)}>
            {getAccountStatusLabel(account)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Ajustar saldo"
            aria-label={`Ajustar saldo de ${account.name}`}
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={onAdjust}
          >
            Ajustar saldo
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Transferir desde esta cuenta"
            aria-label={`Transferir desde ${account.name}`}
            icon={<ArrowRight className="h-4 w-4" />}
            onClick={onTransfer}
          >
            Transferir desde esta cuenta
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Editar cuenta"
            aria-label={`Editar cuenta ${account.name}`}
            icon={<Pencil className="h-4 w-4" />}
            onClick={onEdit}
          >
            Editar cuenta
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-error hover:text-error"
            title="Eliminar cuenta"
            aria-label={`Eliminar cuenta ${account.name}`}
            icon={<Trash2 className="h-4 w-4" />}
            onClick={onDelete}
          >
            Eliminar cuenta
          </Button>
        </div>
      </div>
    </article>
  );
}

function BoxesPanel({
  boxes,
  onAddBox,
  onSeparateMoney,
  onEditBox,
  onDeleteBox,
  onMoveBox,
}: {
  boxes: BoxMoneySummary[];
  onAddBox: () => void;
  onSeparateMoney: () => void;
  onEditBox: (box: BoxMoneySummary) => void;
  onDeleteBox: (box: BoxMoneySummary) => void;
  onMoveBox: (box: BoxMoneySummary) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-surface text-text-secondary">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold text-text">
              Cajas
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Dinero separado para compromisos, objetivos o emergencia.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {boxes.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowRight className="h-4 w-4" />}
              onClick={onSeparateMoney}
            >
              Separar dinero
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={onAddBox}
          >
            Crear caja
          </Button>
        </div>
      </div>

      {boxes.length > 0 ? (
        <div className="mt-5 divide-y divide-border/70">
          {boxes.map((box) => (
            <article key={box.id} className="flex items-center gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
                <PiggyBank className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-text">{box.name}</h3>
                <p className="mt-1 text-xs text-text-muted">
                  {boxTypeLabels[box.type]} - {box.account_name}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <MoneyText
                  value={box.current_balance}
                  className="font-heading text-sm font-semibold text-text"
                />
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Mover dinero"
                    aria-label={`Mover dinero de ${box.name}`}
                    icon={<ArrowRight className="h-4 w-4" />}
                    onClick={() => onMoveBox(box)}
                  >
                    Mover dinero
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Editar caja"
                    aria-label={`Editar caja ${box.name}`}
                    icon={<Pencil className="h-4 w-4" />}
                    onClick={() => onEditBox(box)}
                  >
                    Editar caja
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-error hover:text-error"
                    title="Eliminar caja"
                    aria-label={`Eliminar caja ${box.name}`}
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => onDeleteBox(box)}
                  >
                    Eliminar caja
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-border bg-bg-primary px-4 py-5">
          <p className="text-sm leading-6 text-text-secondary">
            Todavia no tienes cajas. Puedes separar dinero para alquiler,
            cuotas, emergencia u objetivos sin duplicar saldos.
          </p>
          <Button
            variant="quiet"
            size="sm"
            className="mt-4"
            icon={<Plus className="h-4 w-4" />}
            onClick={onAddBox}
          >
            Separar dinero
          </Button>
        </div>
      )}
    </section>
  );
}

function ProtectionPanel({ onNavigate }: { onNavigate?: (view: AppView) => void }) {
  return (
    <section className="rounded-xl border border-brand/15 bg-bg-surface-raised p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-text">
            Pendientes no cuentan
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Lo detectado por WhatsApp o email no afecta saldos hasta que lo confirmes. Si algo esta esperando, vive en Pendientes.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-text-brand hover:text-brand-hover"
        onClick={() => onNavigate?.("pending")}
      >
        Ver pendientes
        <ArrowRight className="h-4 w-4" />
      </button>
    </section>
  );
}

function WarningsPanel({ warnings }: { warnings: string[] }) {
  return (
    <section className="rounded-xl border border-warning-subtle bg-warning-subtle/45 p-4">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <h2 className="font-heading text-base font-semibold text-text">
            Algo merece revision
          </h2>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-text-secondary">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function AccountModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("Yape");
  const [type, setType] = useState<AccountType>("digital");
  const [institution, setInstitution] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError("Ponle un nombre a la cuenta.");
      return;
    }

    const parsedBalance = parseBalance(initialBalance);
    if (parsedBalance === null) {
      setError("El saldo inicial debe ser un numero valido.");
      return;
    }

    setSaving(true);
    try {
      await createAccount({
        name: cleanName,
        type,
        institution: institution.trim() || null,
        initial_balance: parsedBalance,
      });
      await onCreated();
    } catch (saveError) {
      setError(toUiError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-bg-inverse/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        className="w-full max-w-2xl rounded-2xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
          <div>
            <p className="text-xs font-medium text-text-muted">Mi Dinero</p>
            <h2
              id="account-modal-title"
              className="font-heading text-xl font-semibold tracking-normal text-text"
            >
              Agregar cuenta
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            icon={<X className="h-4 w-4" />}
            onClick={onClose}
            disabled={saving}
          >
            Cerrar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {accountTypeOptions.map((option) => (
              <button
                key={option.type}
                type="button"
                className={cn(
                  "rounded-lg border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                  type === option.type
                    ? "border-brand bg-brand-subtle text-text"
                    : "border-border bg-bg-surface-raised hover:border-border-strong"
                )}
                onClick={() => setType(option.type)}
              >
                <span className="flex items-center gap-2 font-heading text-sm font-semibold">
                  {getAccountIcon(option.type)}
                  {option.label}
                </span>
                <span className="mt-1 block text-xs text-text-muted">
                  {option.hint}
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Nombre" htmlFor="account-name">
              <Input
                id="account-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Yape"
              />
            </FieldShell>
            <FieldShell
              label="Saldo inicial"
              htmlFor="account-balance"
              hint="Puede ser aproximado. Si no sabes, dejalo en 0."
            >
              <Input
                id="account-balance"
                inputMode="decimal"
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value)}
                placeholder="0.00"
              />
            </FieldShell>
          </div>

          <FieldShell
            label="Institucion o app"
            htmlFor="account-institution"
            hint="Opcional. Ej. BCP, Interbank, Yape."
          >
            <Input
              id="account-institution"
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
              placeholder="Ej. Yape"
            />
          </FieldShell>

          <div className="rounded-lg border border-brand-subtle bg-brand-subtle/45 px-4 py-3 text-sm leading-6 text-text-secondary">
            Esta cuenta activa saldos y dinero libre. Tus movimientos anteriores
            sin cuenta siguen intactos hasta que los vincules o corrijas.
          </div>

          {error ? (
            <p className="rounded-md border border-error-subtle bg-error-subtle px-3 py-2 text-sm text-error">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} icon={<RefreshCw className="h-4 w-4" />}>
              Guardar cuenta
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditAccountModal({
  account,
  onClose,
  onUpdated,
}: {
  account: AccountMoneySummary;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [name, setName] = useState(account.name);
  const [type, setType] = useState<AccountType>(account.type);
  const [institution, setInstitution] = useState(account.institution ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError("Ponle un nombre a la cuenta.");
      return;
    }

    setSaving(true);
    try {
      await updateAccount(account.id, {
        name: cleanName,
        type,
        institution: institution.trim() || null,
      });
      await onUpdated();
    } catch (saveError) {
      setError(toUiError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-bg-inverse/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-account-title"
        className="w-full max-w-2xl rounded-2xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
          <div>
            <p className="text-xs font-medium text-text-muted">Cuenta</p>
            <h2
              id="edit-account-title"
              className="font-heading text-xl font-semibold tracking-normal text-text"
            >
              Editar cuenta
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            icon={<X className="h-4 w-4" />}
            onClick={onClose}
            disabled={saving}
          >
            Cerrar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
          <div className="rounded-lg border border-border bg-bg-primary px-4 py-3">
            <p className="text-xs text-text-muted">Saldo actual</p>
            <MoneyText
              value={account.current_balance}
              className="mt-1 block font-heading text-2xl font-semibold text-text"
            />
            <p className="mt-1 text-xs text-text-muted">
              {account.box_count > 0
                ? `${account.box_count} cajas vinculadas`
                : "Sin cajas vinculadas"}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {accountTypeOptions.map((option) => (
              <button
                key={option.type}
                type="button"
                className={cn(
                  "rounded-lg border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                  type === option.type
                    ? "border-brand bg-brand-subtle text-text"
                    : "border-border bg-bg-surface-raised hover:border-border-strong"
                )}
                onClick={() => setType(option.type)}
              >
                <span className="flex items-center gap-2 font-heading text-sm font-semibold">
                  {getAccountIcon(option.type)}
                  {option.label}
                </span>
                <span className="mt-1 block text-xs text-text-muted">
                  {option.hint}
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Nombre" htmlFor="edit-account-name">
              <Input
                id="edit-account-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FieldShell>
            <FieldShell
              label="Institucion o app"
              htmlFor="edit-account-institution"
              hint="Opcional."
            >
              <Input
                id="edit-account-institution"
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
                placeholder="Ej. BCP, Interbank, Yape"
              />
            </FieldShell>
          </div>

          <div className="rounded-lg border border-brand-subtle bg-brand-subtle/45 px-4 py-3 text-sm leading-6 text-text-secondary">
            Editar una cuenta no cambia saldo ni moneda. Si el saldo esta mal,
            debe corregirse con un ajuste financiero auditado.
          </div>

          {error ? (
            <p className="rounded-md border border-error-subtle bg-error-subtle px-3 py-2 text-sm text-error">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} icon={<Pencil className="h-4 w-4" />}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteAccountDialog({
  account,
  onClose,
  onDeleted,
}: {
  account: AccountMoneySummary;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasBalance = Math.abs(account.current_balance) > 0.00001;
  const hasBoxes = account.box_count > 0;
  const canDelete = !hasBalance && !hasBoxes;

  async function handleDelete() {
    if (!canDelete) return;

    setError(null);
    setSaving(true);

    try {
      await deleteAccount(account.id, "dashboard_delete_account");
      await onDeleted();
    } catch (deleteError) {
      setError(toUiError(deleteError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-bg-inverse/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="w-full max-w-lg rounded-2xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <p className="text-xs font-medium text-text-muted">Eliminar cuenta</p>
            <h2
              id="delete-account-title"
              className="font-heading text-xl font-semibold tracking-normal text-text"
            >
              {account.name}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            icon={<X className="h-4 w-4" />}
            onClick={onClose}
            disabled={saving}
          >
            Cerrar
          </Button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-border bg-bg-primary px-4 py-3">
            <p className="text-xs text-text-muted">Saldo actual</p>
            <MoneyText
              value={account.current_balance}
              className="mt-1 block font-heading text-2xl font-semibold text-text"
            />
            <p className="mt-1 text-xs text-text-muted">
              {account.box_count > 0
                ? `${account.box_count} cajas vinculadas`
                : "Sin cajas vinculadas"}
            </p>
          </div>

          <p className="text-sm leading-6 text-text-secondary">
            {canDelete
              ? "Esta cuenta no tiene saldo ni cajas. Se ocultara de Mi Dinero sin crear movimientos."
              : "Para proteger tus saldos, Manzana solo elimina cuentas vacias y sin cajas."}
          </p>

          {!canDelete ? (
            <div className="rounded-lg border border-warning-subtle bg-warning-subtle/45 px-4 py-3 text-sm leading-6 text-text-secondary">
              {hasBoxes
                ? "Primero elimina o vacia las cajas de esta cuenta."
                : "Primero deja el saldo de esta cuenta en cero con un ajuste o transferencia."}
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md border border-error-subtle bg-error-subtle px-3 py-2 text-sm text-error">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={saving}
              disabled={!canDelete}
              icon={<Trash2 className="h-4 w-4" />}
              onClick={handleDelete}
            >
              Eliminar cuenta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoxModal({
  accounts,
  onClose,
  onCreated,
}: {
  accounts: AccountMoneySummary[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const defaultAccount = accounts.find((account) => account.is_default) ?? accounts[0];
  const [accountId, setAccountId] = useState(defaultAccount?.id ?? "");
  const [name, setName] = useState("Emergencia");
  const [type, setType] = useState<BoxType>("objetivo");
  const [initialBalance, setInitialBalance] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError("Ponle un nombre a la caja.");
      return;
    }

    if (!accountId) {
      setError("Elige la cuenta donde vive esta caja.");
      return;
    }

    const parsedInitial = parseNonNegativeMoney(initialBalance);
    if (parsedInitial === null) {
      setError("El monto separado debe ser un numero valido.");
      return;
    }

    const parsedTarget = parseOptionalNonNegativeMoney(targetAmount);
    if (parsedTarget === undefined) {
      setError("La meta debe ser un numero valido.");
      return;
    }

    if (parsedTarget != null && parsedInitial > parsedTarget) {
      setError("El monto separado no debe superar la meta de la caja.");
      return;
    }

    setSaving(true);
    try {
      await createBox({
        account_id: accountId,
        name: cleanName,
        type,
        initial_balance: parsedInitial,
        target_amount: parsedTarget,
        target_date: targetDate.trim() || null,
      });
      await onCreated();
    } catch (saveError) {
      setError(toUiError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-bg-inverse/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="box-modal-title"
        className="w-full max-w-2xl rounded-2xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
          <div>
            <p className="text-xs font-medium text-text-muted">Mi Dinero</p>
            <h2
              id="box-modal-title"
              className="font-heading text-xl font-semibold tracking-normal text-text"
            >
              Crear caja
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            icon={<X className="h-4 w-4" />}
            onClick={onClose}
            disabled={saving}
          >
            Cerrar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {boxTypeOptions.map((option) => (
              <button
                key={option.type}
                type="button"
                className={cn(
                  "rounded-lg border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                  type === option.type
                    ? "border-brand bg-brand-subtle text-text"
                    : "border-border bg-bg-surface-raised hover:border-border-strong"
                )}
                onClick={() => setType(option.type)}
              >
                <span className="flex items-center gap-2 font-heading text-sm font-semibold">
                  <PiggyBank className="h-4 w-4" />
                  {option.label}
                </span>
                <span className="mt-1 block text-xs text-text-muted">
                  {option.hint}
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Cuenta" htmlFor="box-account">
              <Select
                id="box-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} - libre S/ {account.free_balance.toFixed(2)}
                  </option>
                ))}
              </Select>
            </FieldShell>

            <FieldShell label="Nombre" htmlFor="box-name">
              <Input
                id="box-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Emergencia"
              />
            </FieldShell>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FieldShell
              label="Monto separado"
              htmlFor="box-initial"
              hint="Si lo dejas en 0, solo crea la caja."
            >
              <Input
                id="box-initial"
                inputMode="decimal"
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value)}
                placeholder="0.00"
              />
            </FieldShell>

            <FieldShell
              label="Meta"
              htmlFor="box-target"
              hint="Opcional."
            >
              <Input
                id="box-target"
                inputMode="decimal"
                value={targetAmount}
                onChange={(event) => setTargetAmount(event.target.value)}
                placeholder="Ej. 500.00"
              />
            </FieldShell>

            <FieldShell
              label="Fecha objetivo"
              htmlFor="box-target-date"
              hint="Opcional."
            >
              <Input
                id="box-target-date"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </FieldShell>
          </div>

          <div className="rounded-lg border border-brand-subtle bg-brand-subtle/45 px-4 py-3 text-sm leading-6 text-text-secondary">
            Las cajas no duplican dinero. Si separas un monto, Manzana crea una
            asignacion interna auditada y lo descuenta del dinero libre.
          </div>

          {error ? (
            <p className="rounded-md border border-error-subtle bg-error-subtle px-3 py-2 text-sm text-error">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} icon={<PiggyBank className="h-4 w-4" />}>
              Crear caja
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditBoxModal({
  box,
  onClose,
  onUpdated,
}: {
  box: BoxMoneySummary;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [name, setName] = useState(box.name);
  const [type, setType] = useState<BoxType>(box.type);
  const [targetAmount, setTargetAmount] = useState(
    box.target_amount == null ? "" : String(box.target_amount)
  );
  const [targetDate, setTargetDate] = useState(box.target_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError("Ponle un nombre a la caja.");
      return;
    }

    const parsedTarget = parseOptionalNonNegativeMoney(targetAmount);
    if (parsedTarget === undefined) {
      setError("La meta debe ser un numero valido.");
      return;
    }

    if (parsedTarget != null && box.current_balance > parsedTarget) {
      setError("La meta no puede quedar por debajo del saldo actual.");
      return;
    }

    setSaving(true);
    try {
      await updateBox(box.id, {
        name: cleanName,
        type,
        target_amount: parsedTarget,
        target_date: targetDate.trim() || null,
      });
      await onUpdated();
    } catch (saveError) {
      setError(toUiError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-bg-inverse/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-box-modal-title"
        className="w-full max-w-2xl rounded-2xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
          <div>
            <p className="text-xs font-medium text-text-muted">Cajas</p>
            <h2
              id="edit-box-modal-title"
              className="font-heading text-xl font-semibold tracking-normal text-text"
            >
              Editar caja
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            icon={<X className="h-4 w-4" />}
            onClick={onClose}
            disabled={saving}
          >
            Cerrar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
          <div className="rounded-lg border border-border bg-bg-primary px-4 py-3">
            <p className="text-xs text-text-muted">Saldo separado</p>
            <MoneyText
              value={box.current_balance}
              className="mt-1 block font-heading text-2xl font-semibold text-text"
            />
            <p className="mt-1 text-xs text-text-muted">{box.account_name}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {boxTypeOptions.map((option) => (
              <button
                key={option.type}
                type="button"
                className={cn(
                  "rounded-lg border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                  type === option.type
                    ? "border-brand bg-brand-subtle text-text"
                    : "border-border bg-bg-surface-raised hover:border-border-strong"
                )}
                onClick={() => setType(option.type)}
              >
                <span className="flex items-center gap-2 font-heading text-sm font-semibold">
                  <PiggyBank className="h-4 w-4" />
                  {option.label}
                </span>
                <span className="mt-1 block text-xs text-text-muted">
                  {option.hint}
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FieldShell label="Nombre" htmlFor="edit-box-name">
              <Input
                id="edit-box-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FieldShell>

            <FieldShell label="Meta" htmlFor="edit-box-target" hint="Opcional.">
              <Input
                id="edit-box-target"
                inputMode="decimal"
                value={targetAmount}
                onChange={(event) => setTargetAmount(event.target.value)}
                placeholder="Ej. 500.00"
              />
            </FieldShell>

            <FieldShell
              label="Fecha objetivo"
              htmlFor="edit-box-target-date"
              hint="Opcional."
            >
              <Input
                id="edit-box-target-date"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </FieldShell>
          </div>

          <div className="rounded-lg border border-brand-subtle bg-brand-subtle/45 px-4 py-3 text-sm leading-6 text-text-secondary">
            Editar una caja no cambia su saldo. Para mover dinero, Manzana debe
            crear una asignacion interna auditada.
          </div>

          {error ? (
            <p className="rounded-md border border-error-subtle bg-error-subtle px-3 py-2 text-sm text-error">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} icon={<Pencil className="h-4 w-4" />}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteBoxDialog({
  box,
  onClose,
  onDeleted,
}: {
  box: BoxMoneySummary;
  onClose: () => void;
  onDeleted: (releasedAmount: number) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasBalance = box.current_balance > 0;

  async function handleDelete() {
    setError(null);
    setSaving(true);

    try {
      const result = await deleteBox(box.id, "dashboard_delete_box");
      await onDeleted(result.released_amount);
    } catch (deleteError) {
      setError(toUiError(deleteError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-bg-inverse/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-box-title"
        className="w-full max-w-lg rounded-2xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <p className="text-xs font-medium text-text-muted">Eliminar caja</p>
            <h2
              id="delete-box-title"
              className="font-heading text-xl font-semibold tracking-normal text-text"
            >
              {box.name}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            icon={<X className="h-4 w-4" />}
            onClick={onClose}
            disabled={saving}
          >
            Cerrar
          </Button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-border bg-bg-primary px-4 py-3">
            <p className="text-xs text-text-muted">Saldo en la caja</p>
            <MoneyText
              value={box.current_balance}
              className="mt-1 block font-heading text-2xl font-semibold text-text"
            />
          </div>

          <p className="text-sm leading-6 text-text-secondary">
            {hasBalance
              ? "Al eliminarla, Manzana libera este monto con una asignacion interna auditada. Tu saldo de cuenta no cambia; tu dinero libre aumenta."
              : "Esta caja no tiene saldo. Se ocultara de Mi Dinero sin crear movimientos."}
          </p>

          {error ? (
            <p className="rounded-md border border-error-subtle bg-error-subtle px-3 py-2 text-sm text-error">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={saving}
              icon={<Trash2 className="h-4 w-4" />}
              onClick={handleDelete}
            >
              Eliminar caja
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoneyActionModal({
  data,
  intent,
  onClose,
  onCompleted,
}: {
  data: MoneyDashboardResponse;
  intent: MoneyActionIntent;
  onClose: () => void;
  onCompleted: (message: string) => Promise<void>;
}) {
  const defaultAccount = data.accounts.find((account) => account.is_default) ?? data.accounts[0];
  const intentAccount = intent.accountId
    ? data.accounts.find((account) => account.id === intent.accountId)
    : null;
  const defaultBox = intent.boxId
    ? data.boxes.find((box) => box.id === intent.boxId) ?? data.boxes[0]
    : data.boxes[0];
  const initialBoxMode: Extract<
    MoneyActionPayload,
    { action: "move_box_money" }
  >["mode"] = intent.boxId ? "release_from_box" : "separate_to_box";
  const [mode, setMode] = useState<MoneyActionMode>(intent.mode);
  const [adjustAccountId, setAdjustAccountId] = useState(
    intentAccount?.id ?? defaultAccount?.id ?? ""
  );
  const [targetBalance, setTargetBalance] = useState(
    String(intentAccount?.current_balance ?? defaultAccount?.current_balance ?? "")
  );
  const [adjustReason, setAdjustReason] = useState("Correccion manual de saldo");
  const [transferFromId, setTransferFromId] = useState(
    intentAccount?.id ?? defaultAccount?.id ?? ""
  );
  const [transferToId, setTransferToId] = useState(() => {
    const fromId = intentAccount?.id ?? defaultAccount?.id;
    return data.accounts.find((account) => account.id !== fromId)?.id ?? "";
  });
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [boxMode, setBoxMode] = useState<
    Extract<MoneyActionPayload, { action: "move_box_money" }>["mode"]
  >(initialBoxMode);
  const [boxOriginId, setBoxOriginId] = useState(
    initialBoxMode === "separate_to_box" ? "" : defaultBox?.id ?? ""
  );
  const [boxDestinationId, setBoxDestinationId] = useState(() =>
    initialBoxMode === "separate_to_box"
      ? defaultBox?.id ?? ""
      : getDefaultDestinationBoxId(data.boxes, defaultBox?.id)
  );
  const [boxAmount, setBoxAmount] = useState("");
  const [boxDescription, setBoxDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAdjustAccount = data.accounts.find(
    (account) => account.id === adjustAccountId
  );
  const selectedBoxOrigin = data.boxes.find((box) => box.id === boxOriginId);
  const selectedBoxDestination = data.boxes.find(
    (box) => box.id === boxDestinationId
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = buildMoneyActionPayload();
    if (!payload.ok) {
      setError(payload.message);
      return;
    }

    setSaving(true);
    try {
      await executeMoneyAction(payload.action);
      await onCompleted(successMessageForAction(payload.action));
    } catch (actionError) {
      setError(toUiError(actionError));
    } finally {
      setSaving(false);
    }
  }

  function buildMoneyActionPayload():
    | { ok: true; action: MoneyActionPayload }
    | { ok: false; message: string } {
    if (mode === "adjust") {
      if (!adjustAccountId) {
        return { ok: false, message: "Elige la cuenta que quieres ajustar." };
      }

      const parsedTarget = parseBalance(targetBalance);
      if (parsedTarget === null) {
        return { ok: false, message: "El saldo objetivo debe ser valido." };
      }

      return {
        ok: true,
        action: {
          action: "adjust_account_balance",
          account_id: adjustAccountId,
          target_balance: parsedTarget,
          reason: adjustReason.trim() || undefined,
        },
      };
    }

    if (mode === "transfer") {
      const parsedAmount = parsePositiveMoney(transferAmount);
      if (!transferFromId || !transferToId) {
        return { ok: false, message: "Elige cuenta origen y destino." };
      }
      if (transferFromId === transferToId) {
        return { ok: false, message: "La cuenta destino debe ser distinta." };
      }
      if (parsedAmount === null) {
        return { ok: false, message: "El monto de transferencia debe ser mayor a cero." };
      }

      return {
        ok: true,
        action: {
          action: "transfer_between_accounts",
          from_account_id: transferFromId,
          to_account_id: transferToId,
          amount: parsedAmount,
          description: transferDescription.trim() || undefined,
        },
      };
    }

    const parsedBoxAmount = parsePositiveMoney(boxAmount);
    if (parsedBoxAmount === null) {
      return { ok: false, message: "El monto debe ser mayor a cero." };
    }

    if (boxMode === "separate_to_box") {
      if (!boxDestinationId) {
        return { ok: false, message: "Elige la caja donde vas a separar dinero." };
      }

      return {
        ok: true,
        action: {
          action: "move_box_money",
          mode: "separate_to_box",
          amount: parsedBoxAmount,
          box_origin_id: null,
          box_destination_id: boxDestinationId,
          description: boxDescription.trim() || undefined,
        },
      };
    }

    if (boxMode === "release_from_box") {
      if (!boxOriginId) {
        return { ok: false, message: "Elige la caja de origen." };
      }

      return {
        ok: true,
        action: {
          action: "move_box_money",
          mode: "release_from_box",
          amount: parsedBoxAmount,
          box_origin_id: boxOriginId,
          box_destination_id: null,
          description: boxDescription.trim() || undefined,
        },
      };
    }

    if (!boxOriginId || !boxDestinationId) {
      return { ok: false, message: "Elige caja origen y destino." };
    }
    if (boxOriginId === boxDestinationId) {
      return { ok: false, message: "La caja destino debe ser distinta." };
    }

    return {
      ok: true,
      action: {
        action: "move_box_money",
        mode: "box_to_box",
        amount: parsedBoxAmount,
        box_origin_id: boxOriginId,
        box_destination_id: boxDestinationId,
        description: boxDescription.trim() || undefined,
      },
    };
  }

  function handleAdjustAccountChange(nextAccountId: string) {
    setAdjustAccountId(nextAccountId);
    const nextAccount = data.accounts.find((account) => account.id === nextAccountId);
    if (nextAccount) setTargetBalance(String(nextAccount.current_balance));
  }

  function handleTransferFromChange(nextAccountId: string) {
    setTransferFromId(nextAccountId);
    if (transferToId === nextAccountId) {
      setTransferToId(data.accounts.find((account) => account.id !== nextAccountId)?.id ?? "");
    }
  }

  function handleBoxModeChange(
    nextMode: Extract<MoneyActionPayload, { action: "move_box_money" }>["mode"]
  ) {
    setBoxMode(nextMode);

    if (nextMode === "separate_to_box") {
      setBoxOriginId("");
      setBoxDestinationId(boxDestinationId || defaultBox?.id || "");
      return;
    }

    if (nextMode === "release_from_box") {
      setBoxOriginId(boxOriginId || defaultBox?.id || "");
      setBoxDestinationId("");
      return;
    }

    const nextOriginId = boxOriginId || defaultBox?.id || "";
    setBoxOriginId(nextOriginId);
    setBoxDestinationId(
      boxDestinationId && boxDestinationId !== nextOriginId
        ? boxDestinationId
        : getDefaultDestinationBoxId(data.boxes, nextOriginId)
    );
  }

  function handleBoxOriginChange(nextBoxId: string) {
    setBoxOriginId(nextBoxId);
    if (boxMode === "box_to_box" && boxDestinationId === nextBoxId) {
      setBoxDestinationId(getDefaultDestinationBoxId(data.boxes, nextBoxId));
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-bg-inverse/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="money-action-title"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
          <div>
            <p className="text-xs font-medium text-text-muted">Accion financiera</p>
            <h2
              id="money-action-title"
              className="font-heading text-xl font-semibold tracking-normal text-text"
            >
              Mover o corregir dinero
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            icon={<X className="h-4 w-4" />}
            onClick={onClose}
            disabled={saving}
          >
            Cerrar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                id: "adjust" as const,
                title: "Ajustar saldo",
                copy: "Corrige una cuenta con auditoria.",
                disabled: data.accounts.length === 0,
              },
              {
                id: "transfer" as const,
                title: "Transferir",
                copy: "Mueve dinero entre cuentas.",
                disabled: data.accounts.length < 2,
              },
              {
                id: "box" as const,
                title: "Cajas",
                copy: "Separa, libera o mueve caja.",
                disabled: data.boxes.length === 0,
              },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={option.disabled || saving}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                  mode === option.id
                    ? "border-brand bg-brand-subtle text-text"
                    : "border-border bg-bg-surface-raised hover:border-border-strong"
                )}
                onClick={() => setMode(option.id)}
              >
                <span className="block font-heading text-sm font-semibold">
                  {option.title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-text-muted">
                  {option.copy}
                </span>
              </button>
            ))}
          </div>

          {mode === "adjust" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell label="Cuenta" htmlFor="adjust-account">
                  <Select
                    id="adjust-account"
                    value={adjustAccountId}
                    onChange={(event) => handleAdjustAccountChange(event.target.value)}
                    disabled={saving}
                  >
                    {data.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} - saldo S/ {account.current_balance.toFixed(2)}
                      </option>
                    ))}
                  </Select>
                </FieldShell>
                <FieldShell
                  label="Saldo correcto"
                  htmlFor="target-balance"
                  hint="Manzana crea un ajuste por la diferencia."
                >
                  <Input
                    id="target-balance"
                    inputMode="decimal"
                    value={targetBalance}
                    onChange={(event) => setTargetBalance(event.target.value)}
                    disabled={saving}
                    placeholder="0.00"
                  />
                </FieldShell>
              </div>
              <FieldShell label="Motivo" htmlFor="adjust-reason" hint="Visible en auditoria interna.">
                <Input
                  id="adjust-reason"
                  value={adjustReason}
                  onChange={(event) => setAdjustReason(event.target.value)}
                  disabled={saving}
                />
              </FieldShell>
              <div className="rounded-lg border border-border bg-bg-primary px-4 py-3 text-sm leading-6 text-text-secondary">
                {selectedAdjustAccount ? (
                  <>
                    Saldo actual:{" "}
                    <MoneyText
                      value={selectedAdjustAccount.current_balance}
                      className="font-semibold text-text"
                    />
                    . No se edita directo: se guarda un movimiento de ajuste.
                  </>
                ) : (
                  "Elige una cuenta para revisar el impacto."
                )}
              </div>
            </div>
          ) : null}

          {mode === "transfer" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell label="Desde" htmlFor="transfer-from">
                  <Select
                    id="transfer-from"
                    value={transferFromId}
                    onChange={(event) => handleTransferFromChange(event.target.value)}
                    disabled={saving}
                  >
                    {data.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} - S/ {account.current_balance.toFixed(2)}
                      </option>
                    ))}
                  </Select>
                </FieldShell>
                <FieldShell label="Hacia" htmlFor="transfer-to">
                  <Select
                    id="transfer-to"
                    value={transferToId}
                    onChange={(event) => setTransferToId(event.target.value)}
                    disabled={saving}
                  >
                    <option value="">Elige destino</option>
                    {data.accounts
                      .filter((account) => account.id !== transferFromId)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} - S/ {account.current_balance.toFixed(2)}
                        </option>
                      ))}
                  </Select>
                </FieldShell>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell label="Monto" htmlFor="transfer-amount">
                  <Input
                    id="transfer-amount"
                    inputMode="decimal"
                    value={transferAmount}
                    onChange={(event) => setTransferAmount(event.target.value)}
                    disabled={saving}
                    placeholder="0.00"
                  />
                </FieldShell>
                <FieldShell label="Descripcion" htmlFor="transfer-description" hint="Opcional.">
                  <Input
                    id="transfer-description"
                    value={transferDescription}
                    onChange={(event) => setTransferDescription(event.target.value)}
                    disabled={saving}
                    placeholder="Ej. Pase de Yape a banco"
                  />
                </FieldShell>
              </div>
              <div className="rounded-lg border border-brand-subtle bg-brand-subtle/45 px-4 py-3 text-sm leading-6 text-text-secondary">
                Una transferencia baja el saldo de una cuenta y sube el de otra.
                No cambia tu saldo total.
              </div>
            </div>
          ) : null}

          {mode === "box" ? (
            data.boxes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm leading-6 text-text-secondary">
                Crea una caja antes de mover dinero separado.
              </div>
            ) : (
              <div className="space-y-4">
                <FieldShell label="Tipo de movimiento" htmlFor="box-mode">
                  <Select
                    id="box-mode"
                    value={boxMode}
                    onChange={(event) =>
                      handleBoxModeChange(
                        event.target.value as Extract<
                          MoneyActionPayload,
                          { action: "move_box_money" }
                        >["mode"]
                      )
                    }
                    disabled={saving}
                  >
                    <option value="separate_to_box">Separar dinero en caja</option>
                    <option value="release_from_box">Liberar dinero de caja</option>
                    <option value="box_to_box">Mover entre cajas</option>
                  </Select>
                </FieldShell>

                <div className="grid gap-4 sm:grid-cols-2">
                  {boxMode !== "separate_to_box" ? (
                    <FieldShell label="Caja origen" htmlFor="box-origin">
                      <Select
                        id="box-origin"
                        value={boxOriginId}
                        onChange={(event) => handleBoxOriginChange(event.target.value)}
                        disabled={saving}
                      >
                        {data.boxes.map((box) => (
                          <option key={box.id} value={box.id}>
                            {box.name} - S/ {box.current_balance.toFixed(2)}
                          </option>
                        ))}
                      </Select>
                    </FieldShell>
                  ) : null}

                  {boxMode !== "release_from_box" ? (
                    <FieldShell label="Caja destino" htmlFor="box-destination">
                      <Select
                        id="box-destination"
                        value={boxDestinationId}
                        onChange={(event) => setBoxDestinationId(event.target.value)}
                        disabled={saving}
                      >
                        <option value="">Elige destino</option>
                        {data.boxes
                          .filter((box) =>
                            boxMode === "box_to_box"
                              ? box.id !== boxOriginId
                              : true
                          )
                          .map((box) => (
                            <option key={box.id} value={box.id}>
                              {box.name} - {box.account_name}
                            </option>
                          ))}
                      </Select>
                    </FieldShell>
                  ) : null}

                  <FieldShell label="Monto" htmlFor="box-amount">
                    <Input
                      id="box-amount"
                      inputMode="decimal"
                      value={boxAmount}
                      onChange={(event) => setBoxAmount(event.target.value)}
                      disabled={saving}
                      placeholder="0.00"
                    />
                  </FieldShell>
                </div>

                <FieldShell label="Descripcion" htmlFor="box-description" hint="Opcional.">
                  <Input
                    id="box-description"
                    value={boxDescription}
                    onChange={(event) => setBoxDescription(event.target.value)}
                    disabled={saving}
                    placeholder="Ej. Separar para cuota"
                  />
                </FieldShell>

                <div className="rounded-lg border border-brand-subtle bg-brand-subtle/45 px-4 py-3 text-sm leading-6 text-text-secondary">
                  {boxMode === "separate_to_box"
                    ? "Separar dinero aumenta una caja y reduce tu dinero libre, sin cambiar el saldo de cuenta."
                    : boxMode === "release_from_box"
                    ? "Liberar dinero baja la caja y aumenta tu dinero libre, sin cambiar el saldo de cuenta."
                    : "Mover entre cajas conserva el total separado y solo cambia su distribucion."}
                  {selectedBoxOrigin || selectedBoxDestination ? (
                    <span className="mt-1 block text-xs text-text-muted">
                      {selectedBoxOrigin
                        ? `Origen: ${selectedBoxOrigin.name}. `
                        : ""}
                      {selectedBoxDestination
                        ? `Destino: ${selectedBoxDestination.name}.`
                        : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          ) : null}

          {error ? (
            <p className="rounded-md border border-error-subtle bg-error-subtle px-3 py-2 text-sm text-error">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} icon={<RefreshCw className="h-4 w-4" />}>
              Guardar accion
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getAccountIcon(type: AccountType) {
  if (type === "banco") return <Landmark className="h-5 w-5" />;
  if (type === "fisico") return <Banknote className="h-5 w-5" />;
  if (type === "tarjeta") return <CreditCard className="h-5 w-5" />;
  return <Smartphone className="h-5 w-5" />;
}

function getStatusTone(status: AccountBalanceStatus): string {
  if (status === "negative" || status === "overspent") return "text-warning";
  return "text-text-muted";
}

function parseBalance(value: string): number | null {
  const text = value.trim();
  if (!text) return 0;

  const parsed = Number(text.replace(",", "."));
  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed * 100) / 100;
}

function parseNonNegativeMoney(value: string): number | null {
  const parsed = parseBalance(value);
  if (parsed == null || parsed < 0) return null;
  return parsed;
}

function parseOptionalNonNegativeMoney(value: string): number | null | undefined {
  if (!value.trim()) return null;

  const parsed = parseNonNegativeMoney(value);
  return parsed == null ? undefined : parsed;
}

function parsePositiveMoney(value: string): number | null {
  const parsed = parseNonNegativeMoney(value);
  if (parsed == null || parsed <= 0) return null;
  return parsed;
}

function getDefaultDestinationBoxId(
  boxes: BoxMoneySummary[],
  originBoxId?: string
): string {
  const origin = boxes.find((box) => box.id === originBoxId);
  const sameAccountTarget = origin
    ? boxes.find(
        (box) => box.id !== origin.id && box.account_id === origin.account_id
      )
    : null;

  return sameAccountTarget?.id ?? boxes.find((box) => box.id !== originBoxId)?.id ?? "";
}

function successMessageForAction(action: MoneyActionPayload): string {
  if (action.action === "adjust_account_balance") {
    return "Saldo ajustado con auditoria.";
  }

  if (action.action === "transfer_between_accounts") {
    return "Transferencia registrada. El saldo total no cambio.";
  }

  if (action.mode === "separate_to_box") {
    return "Dinero separado en caja. Tu dinero libre se actualizo.";
  }

  if (action.mode === "release_from_box") {
    return "Dinero liberado de la caja. Tu dinero libre se actualizo.";
  }

  return "Movimiento entre cajas registrado.";
}

function toUiError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "No pude completar la accion. Intenta otra vez en un momento.";
}
