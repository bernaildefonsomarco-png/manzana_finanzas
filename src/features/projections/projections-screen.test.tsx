import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectionBreakdown } from "./projection-breakdown";
import { ProjectionHero } from "./projection-hero";
import { SimulationCard } from "./projection-simulation-card";
import { ProjectionSummaryCard } from "./projection-summary-card";
import { ProjectionsScreen } from "./projections-screen";
import type {
  PeriodProjectionView,
  ProjectionBreakdownView,
} from "./projections-types";

const mocks = vi.hoisted(() => ({
  getMonthlySituation: vi.fn(),
  getPeriodProjection: vi.fn(),
  getProjectionBreakdown: vi.fn(),
  simulateExpense: vi.fn(),
}));

vi.mock("./projections-api", () => mocks);
vi.mock("@/features/app-shell/app-shell", () => ({
  AppShell: ({
    title,
    children,
  }: {
    title: string;
    children: ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe("Projections W-12", () => {
  it("AC-PROY-06/08/13/16: no contiene veredicto, score, comparación ni palabras prohibidas", () => {
    const source = projectionProductionSources()
      .join("\n")
      .toLocaleLowerCase("es");
    for (const forbidden of [
      "sí puedes cubrir",
      "no te lo recomendaría",
      "deberías",
      "te conviene",
      "mejor",
      "recomiendo",
      "no te alcanza",
      "riesgo",
      "peligro",
      "malo",
      "salud financiera:",
      "score",
      "otros usuarios",
      "promedio de mercado",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("AC-PROY-14: la superficie no depende de comandos financieros ni amplía su allowlist de lectura", () => {
    const productionSources = projectionProductionSources();
    const combinedSource = productionSources.join("\n");
    const apiSource = readFileSync(
      join(process.cwd(), "src/features/projections/projections-api.ts"),
      "utf8",
    );

    for (const source of productionSources) {
      expect(source).not.toMatch(/from\s+["']@\/(?:core|data)\//);
    }
    expect(combinedSource).not.toContain("/movimientos/nuevo");
    const routes = [
      ...apiSource.matchAll(/["'](\/api\/v1\/[^"']+)["']/g),
    ]
      .map((match) => match[1])
      .sort();
    expect(routes).toEqual([
      "/api/v1/projections/health",
      "/api/v1/projections/period",
      "/api/v1/projections/period/breakdown",
      "/api/v1/simulate",
    ]);
    expect(apiSource.match(/method:\s*"POST"/g) ?? []).toHaveLength(1);
  });

  it("AC-PROY-01: declara los supuestos exactos debajo de la cifra", () => {
    const { rerender } = render(
      <ProjectionHero
        projection={{ ...projection(true), assumptions: [] }}
      />,
    );
    expect(screen.queryByText("S/250.00")).not.toBeInTheDocument();
    expect(screen.getByText("No pude mostrar la proyección")).toBeInTheDocument();

    rerender(<ProjectionHero projection={projection(true)} />);

    const assumptions = screen.getByRole("list", {
      name: "Supuestos de la proyección",
    });
    expect(within(assumptions).getByText("S/89.00")).toBeInTheDocument();
    expect(within(assumptions).getByText("S/62.00")).toBeInTheDocument();
    expect(within(assumptions).getByText("5 días")).toBeInTheDocument();
    expect(within(assumptions).getByText("S/0.00")).toBeInTheDocument();
    expect(within(assumptions).getByText("recurring-rule-7")).toBeInTheDocument();
    expect(within(assumptions).getByText("movement-14")).toBeInTheDocument();
    expect(
      within(assumptions).getByText("Mediana de 14 días civiles en Lima"),
    ).toBeInTheDocument();
  });

  it("AC-PROY-04: alta dispersión se presenta como rango y explica la variación", () => {
    render(
      <ProjectionHero
        projection={{
          ...projection(true),
          projection: null,
          range: { min: "180.00", max: "320.00" },
        }}
      />,
    );

    expect(screen.getByText("S/180.00")).toBeInTheDocument();
    expect(screen.getByText("S/320.00")).toBeInTheDocument();
    expect(screen.getByText("Rango por variación")).toBeInTheDocument();
    expect(screen.queryByText("S/250.00")).not.toBeInTheDocument();
  });

  it("AC-PROY-05: sin siete días muestra el motivo y ninguna cifra futura", () => {
    render(<ProjectionHero projection={projection(false)} />);

    expect(screen.getByText("Todavía faltan unos días")).toBeInTheDocument();
    expect(
      screen.getByText(/Con siete días civiles observables/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Al cierre de este mes")).not.toBeInTheDocument();
    expect(screen.queryByText("S/250.00")).not.toBeInTheDocument();
  });

  it("AC-PROY-12: muestra la aritmética y hace navegable cada referencia conocida", () => {
    render(<ProjectionBreakdown breakdown={breakdown()} />);

    const table = screen.getByRole("table", {
      name: "Detalle de la proyección",
    });
    expect(within(table).getByText("S/649.00")).toBeInTheDocument();
    expect(within(table).getByText("- S/89.00")).toBeInTheDocument();
    expect(within(table).getByText("- S/310.00")).toBeInTheDocument();
    expect(within(table).getByText("S/250.00")).toBeInTheDocument();

    for (const link of within(table).getAllByRole("link", {
      name: "recurring-rule-7",
    })) {
      expect(link).toHaveAttribute("href", "/pagos-que-vienen");
    }
    for (const link of within(table).getAllByRole("link", {
      name: "movement-14",
    })) {
      expect(link).toHaveAttribute("href", "/movimientos/movement-14");
    }
  });

  it("SCR-PROY-03: envía monto, categoría y fecha, y muestra el efecto presupuestal sin escribir", async () => {
    mocks.simulateExpense.mockResolvedValue({
      available: true,
      reason: null,
      simulation: simulation(),
      budget_effect: {
        category_id: "alimentacion",
        simulated_amount: 300,
      },
    });
    renderWithQueryClient(<SimulationCard projection={projection(true)} />);

    const date = screen.getByLabelText(/Cuándo/);
    expect(date).toHaveAttribute("min", "2026-07-26");
    expect(date).toHaveAttribute("max", "2026-07-31");
    fireEvent.change(screen.getByLabelText(/Monto/), {
      target: { value: "300" },
    });
    fireEvent.change(screen.getByLabelText("En qué (opcional)"), {
      target: { value: "alimentacion" },
    });
    fireEvent.change(date, { target: { value: "2026-07-28" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));

    await waitFor(() =>
      expect(mocks.simulateExpense.mock.calls[0]?.[0]).toEqual({
        amount: 300,
        category_id: "alimentacion",
        date: "2026-07-28",
      }),
    );
    expect(
      await screen.findByText(/presupuesto de Alimentación/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText("S/300.00").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Simular no registra ni modifica nada."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Registrar gasto/i }),
    ).not.toBeInTheDocument();
  });

  it("AC-PROY-15: ante fallo no muestra una proyección aproximada de respaldo", async () => {
    mocks.getPeriodProjection.mockRejectedValue(new Error("calculation failed"));
    mocks.getMonthlySituation.mockRejectedValue(new Error("calculation failed"));
    mocks.getProjectionBreakdown.mockRejectedValue(
      new Error("calculation failed"),
    );

    renderWithQueryClient(<ProjectionsScreen />);

    expect(
      await screen.findByText("No pude calcular la proyección"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No mostraré una cifra aproximada. Reintenta para calcularla con el estado actual.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Al cierre de este mes")).not.toBeInTheDocument();
    expect(screen.queryByText("S/250.00")).not.toBeInTheDocument();
  });

  it("SCR-PROY-04: el componente reutilizable no aparece sin datos suficientes", () => {
    const { rerender } = render(
      <ProjectionSummaryCard projection={projection(false)} />,
    );
    expect(screen.queryByText("Proyección de cierre")).not.toBeInTheDocument();
    rerender(<ProjectionSummaryCard projection={projection(true)} />);
    expect(screen.getByText("Proyección de cierre")).toBeInTheDocument();
  });
});

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>,
  );
}

function projection(available: boolean): PeriodProjectionView {
  return {
    available,
    reason: available ? null : "fewer_than_7_observable_days",
    currency: "PEN",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    as_of: "2026-07-26",
    projection: available ? "250.00" : null,
    range: null,
    free_money: "560.00",
    daily_pace: "62.00",
    observed_days: available ? 14 : 4,
    days_remaining: 5,
    assumptions: [
      {
        kind: "commitments_already_discounted",
        amount: "89.00",
        refs: ["recurring-rule-7"],
      },
      {
        kind: "daily_pace",
        amount: "62.00",
        basis: "median_14_lima_calendar_days",
        refs: ["movement-14"],
      },
      {
        kind: "days_remaining",
        value: 5,
        refs: [],
      },
      {
        kind: "future_income",
        amount: "0.00",
        basis: "not_available_v1",
        refs: [],
      },
    ],
  };
}

function breakdown(): ProjectionBreakdownView {
  return {
    available: true,
    currency: "PEN",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    lines: [
      {
        kind: "free_money",
        amount: "560.00",
        refs: [],
      },
      {
        kind: "free_in_accounts",
        amount: "649.00",
        refs: [],
      },
      {
        kind: "commitments_already_discounted",
        amount: "89.00",
        refs: ["recurring-rule-7"],
      },
      {
        kind: "daily_pace",
        amount: "62.00",
        multiplier: 5,
        refs: ["movement-14"],
      },
      {
        kind: "projected_close",
        amount: "250.00",
        refs: ["recurring-rule-7", "movement-14"],
      },
    ],
  };
}

function simulation() {
  return {
    currency: "PEN" as const,
    parts: [
      {
        kind: "immediate_effect" as const,
        free_money_before: "560.00",
        simulated_amount: "300.00",
        free_money_after: "260.00",
      },
      {
        kind: "already_counted" as const,
        uncovered_commitments: "89.00",
        refs: ["recurring-rule-7"],
      },
      {
        kind: "projected_close" as const,
        available: true,
        projection: "-50.00",
        range: null,
        assumptions: projection(true).assumptions,
      },
    ],
  };
}

function projectionProductionSources() {
  const directory = join(process.cwd(), "src/features/projections");
  return readdirSync(directory)
    .filter(
      (file) =>
        /\.(?:ts|tsx)$/.test(file) &&
        !file.endsWith(".test.ts") &&
        !file.endsWith(".test.tsx"),
    )
    .map((file) => readFileSync(join(directory, file), "utf8"));
}
