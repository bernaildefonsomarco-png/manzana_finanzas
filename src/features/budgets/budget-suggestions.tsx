"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { MoneyText } from "@/ui/primitivas/money";
import { categoryLabel } from "./budget-options";
import type { BudgetSuggestionView } from "./budgets-types";

export function BudgetSuggestions({
  suggestions,
  onResolve,
}: {
  suggestions: BudgetSuggestionView[];
  onResolve: (id: string, action: "accept" | "dismiss") => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <section aria-labelledby="budget-suggestions-title" className="space-y-3">
      <h2
        id="budget-suggestions-title"
        className="font-heading text-lg font-semibold"
      >
        Sugerencias de tu historial
      </h2>
      {suggestions.map((suggestion) => (
        <Card key={suggestion.id} className="p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4 text-brand" />
                {categoryLabel(suggestion.category_id)}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                La mediana de {suggestion.evidence.length} periodos completos
                es <MoneyText value={suggestion.proposed_amount} />.
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Evidencia:{" "}
                {suggestion.evidence
                  .map((item) => `S/${item.spent.toFixed(2)}`)
                  .join(", ")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onResolve(suggestion.id, "dismiss")}
              >
                No, gracias
              </Button>
              <Button
                size="sm"
                onClick={() => onResolve(suggestion.id, "accept")}
              >
                Crear con ese monto
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </section>
  );
}
