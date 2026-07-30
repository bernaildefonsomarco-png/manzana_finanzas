"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { FieldShell, Input, Select } from "@/ui/primitivas/field";
import { MoneyText } from "@/ui/primitivas/money";
import { simulateExpense } from "./projections-api";
import type {
  ExpenseSimulationView,
  PeriodProjectionView,
} from "./projections-types";

export function SimulationCard({
  projection,
}: {
  projection: PeriodProjectionView;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(projection.as_of);
  const mutation = useMutation({
    mutationFn: simulateExpense,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    mutation.mutate({
      amount: parsed,
      category_id: category || null,
      date,
    });
  }

  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
        <Calculator className="h-5 w-5 text-brand" />
        ¿Puedo permitirme…?
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Verás el efecto en tus cifras. La decisión sigue siendo tuya.
      </p>
      <form
        onSubmit={submit}
        className="mt-5 grid gap-4 sm:grid-cols-2 sm:items-end lg:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <FieldShell label="Monto" htmlFor="simulation-amount" required>
          <Input
            id="simulation-amount"
            inputMode="decimal"
            prefix="S/"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FieldShell>
        <FieldShell label="En qué (opcional)" htmlFor="simulation-category">
          <Select
            id="simulation-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Sin categoría</option>
            <option value="alimentacion">Alimentación</option>
            <option value="transporte">Transporte</option>
            <option value="compras_personales">Compras personales</option>
          </Select>
        </FieldShell>
        <FieldShell label="Cuándo" htmlFor="simulation-date" required>
          <Input
            id="simulation-date"
            type="date"
            min={projection.as_of}
            max={projection.period_end}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FieldShell>
        <Button type="submit" loading={mutation.isPending}>
          Calcular
        </Button>
      </form>
      {mutation.isError ? (
        <p role="alert" className="mt-4 text-sm text-error">
          No pude calcular esta simulación. No se creó ningún movimiento.
        </p>
      ) : null}
      {mutation.data ? (
        <SimulationResult
          simulation={mutation.data.simulation}
          budgetEffect={mutation.data.budget_effect}
        />
      ) : null}
      {!projection.available ? (
        <p className="mt-4 text-xs text-text-muted">
          El efecto inmediato puede calcularse, pero el cierre necesita más
          datos.
        </p>
      ) : null}
    </Card>
  );
}

function SimulationResult({
  simulation,
  budgetEffect,
}: {
  simulation: ExpenseSimulationView;
  budgetEffect: Awaited<ReturnType<typeof simulateExpense>>["budget_effect"];
}) {
  const immediate = simulation.parts[0];
  const counted = simulation.parts[1];
  const close = simulation.parts[2];
  return (
    <div className="mt-6">
      <ol className="grid gap-3" aria-label="Resultado de la simulación">
        <li className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-text-muted">
            1. Efecto inmediato
          </p>
          <p className="mt-1 text-sm">
            Gastarlo te dejaría{" "}
            <MoneyText value={Number(immediate.free_money_after)} /> libres.
          </p>
        </li>
        <li className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-text-muted">
            2. Lo que ya está contado
          </p>
          <p className="mt-1 text-sm">
            El dinero de partida ya descuenta{" "}
            <MoneyText value={Number(counted.uncovered_commitments)} /> de
            compromisos conocidos.
          </p>
        </li>
        <li className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-text-muted">
            3. Cómo quedaría el cierre
          </p>
          <p className="mt-1 text-sm">
            {!close.available ? (
              "Todavía no hay días suficientes para proyectar el cierre."
            ) : close.range ? (
              <>
                Quedaría entre <MoneyText value={Number(close.range.min)} /> y{" "}
                <MoneyText value={Number(close.range.max)} />.
              </>
            ) : (
              <>
                Cerraría alrededor de{" "}
                <MoneyText value={Number(close.projection)} />.
              </>
            )}
          </p>
        </li>
      </ol>
      {budgetEffect ? (
        <div className="mt-3 rounded-lg border border-border bg-bg-surface p-4 text-sm">
          Si luego registras este gasto, sumaría{" "}
          <MoneyText value={budgetEffect.simulated_amount} /> al avance del
          presupuesto de {categoryLabel(budgetEffect.category_id)}. Esta
          simulación no cambia ese presupuesto.
        </div>
      ) : null}
      <p className="mt-3 text-xs text-text-muted">
        Simular no registra ni modifica nada.
      </p>
    </div>
  );
}

function categoryLabel(categoryId: string) {
  const labels: Record<string, string> = {
    alimentacion: "Alimentación",
    transporte: "Transporte",
    compras_personales: "Compras personales",
  };
  return labels[categoryId] ?? categoryId;
}
