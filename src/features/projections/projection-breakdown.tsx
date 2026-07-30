"use client";

import { ListTree } from "lucide-react";
import { Card } from "@/ui/primitivas/card";
import { MoneyText } from "@/ui/primitivas/money";
import { ProjectionEvidenceRefs } from "./projection-evidence-refs";
import type { ProjectionBreakdownView } from "./projections-types";

type BreakdownLine = ProjectionBreakdownView["lines"][number];

export function ProjectionBreakdown({
  breakdown,
}: {
  breakdown: ProjectionBreakdownView | null;
}) {
  const hrefByRef = breakdown
    ? buildBreakdownReferenceHrefs(breakdown.lines)
    : new Map<string, string>();
  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
        <ListTree className="h-5 w-5 text-brand" />
        De dónde sale
      </h2>
      {!breakdown?.available ? (
        <p className="mt-4 text-sm text-text-secondary">
          El desglose estará disponible cuando haya datos suficientes.
        </p>
      ) : (
        <table
          className="mt-4 w-full text-sm"
          aria-label="Detalle de la proyección"
        >
          <thead className="sr-only">
            <tr>
              <th>Componente</th>
              <th>Monto</th>
              <th>Evidencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {breakdown.lines.map((line) => (
              <tr key={line.kind}>
                <th
                  scope="row"
                  className={`py-3 text-left font-normal text-text-secondary ${
                    isFreeMoneyChild(line.kind) ? "pl-5" : ""
                  }`}
                >
                  <BreakdownLineLabel line={line} />
                </th>
                <td className="py-3 text-right font-medium">
                  <MoneyText
                    value={breakdownLineTotal(line)}
                    sign={
                      line.kind === "commitments_already_discounted" ||
                      line.kind === "daily_pace"
                        ? "negative"
                        : "auto"
                    }
                  />
                </td>
                <td className="py-3 pl-3 text-right">
                  <ProjectionEvidenceRefs
                    refs={line.refs}
                    hrefByRef={hrefByRef}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function BreakdownLineLabel({ line }: { line: BreakdownLine }) {
  if (line.kind === "free_money") return "Dinero libre hoy";
  if (line.kind === "free_in_accounts") return "Libre en cuentas";
  if (line.kind === "commitments_already_discounted") {
    return "Compromisos ya incluidos";
  }
  if (line.kind === "daily_pace") {
    return (
      <>
        Ritmo estimado
        {line.multiplier && line.amount !== null ? (
          <>
            {" "}
            ({line.multiplier} días ×{" "}
            <MoneyText value={Number(line.amount)} sign="none" />)
          </>
        ) : null}
      </>
    );
  }
  return "Proyección de cierre";
}

function buildBreakdownReferenceHrefs(lines: BreakdownLine[]) {
  const result = new Map<string, string>();
  for (const line of lines) {
    if (line.kind === "commitments_already_discounted") {
      for (const ref of line.refs) {
        result.set(ref, "/pagos-que-vienen");
      }
    }
    if (line.kind === "daily_pace") {
      for (const ref of line.refs) {
        result.set(ref, `/movimientos/${encodeURIComponent(ref)}`);
      }
    }
  }
  return result;
}

function breakdownLineTotal(line: BreakdownLine): number | null {
  if (line.amount === null) return null;
  const amount = Number(line.amount);
  if (line.kind === "daily_pace" && line.multiplier) {
    return amount * line.multiplier;
  }
  return amount;
}

function isFreeMoneyChild(kind: BreakdownLine["kind"]) {
  return (
    kind === "free_in_accounts" ||
    kind === "commitments_already_discounted"
  );
}
