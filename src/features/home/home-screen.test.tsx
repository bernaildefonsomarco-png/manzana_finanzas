import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./home-screen";
import type { HomeComposition } from "./home-types";

const mocks = vi.hoisted(() => ({
  getHome: vi.fn(),
  postponeNextAction: vi.fn(),
  setHomeBlockHidden: vi.fn(),
}));

vi.mock("./home-api", () => mocks);

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.postponeNextAction.mockResolvedValue(undefined);
  mocks.setHomeBlockHidden.mockResolvedValue([]);
});

const freeMoneyOk: HomeComposition["blocks"][number] = {
  kind: "free_money",
  status: "ok",
  data: { has_accounts: true, total_balance: 1140, separated_balance: 500, free_balance: 640, account_count: 1, box_count: 1 },
};

function composition(overrides: Partial<HomeComposition> = {}): HomeComposition {
  return { state: "funcional", blocks: [freeMoneyOk], ...overrides };
}

describe("HomeScreen: SCR-HOME-02 estado vacío (AC-HOME-15)", () => {
  it("ofrece tres puertas propias, ninguna es un canal externo", async () => {
    mocks.getHome.mockResolvedValue({ state: "vacio", blocks: [] });
    render(<HomeScreen />);
    expect(await screen.findByText("Empecemos por lo tuyo.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Registrar mi primer movimiento/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Conectar mi correo/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Agregar una cuenta/i })).toBeTruthy();
    // Ningún enlace a WhatsApp ni a un canal externo (05c invertido, RUL-HOME-07).
    expect(screen.queryByText(/whatsapp/i)).toBeNull();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(document.querySelector('a[href*="wa.me"]')).toBeNull();
  });
});

describe("HomeScreen: RUL-HOME-11 sin saludo (AC-HOME-16)", () => {
  it("no hay saludo con nombre, signo de exclamación ni emoji de celebración", async () => {
    mocks.getHome.mockResolvedValue(
      composition({
        blocks: [
          freeMoneyOk,
          { kind: "pending", status: "ok", data: { active_count: 2, needs_completion_count: 0, high_risk_count: 0 } },
        ],
      }),
    );
    const { container } = render(<HomeScreen />);
    await screen.findByText("Tienes libres");
    expect(container.textContent).not.toMatch(/[!¡]/);
    expect(container.textContent).not.toMatch(/🎉|☀️|👋/u);
    expect(screen.queryByText(/buenos días|bienvenido/i)).toBeNull();
  });
});

describe("HomeScreen: RUL-HOME-05 bloque vacío no se muestra (AC-HOME-04)", () => {
  it("solo renderiza las secciones presentes en la composición", async () => {
    mocks.getHome.mockResolvedValue(composition());
    render(<HomeScreen />);
    await screen.findByText("Tienes libres");
    expect(screen.queryByRole("heading", { name: "Lo siguiente" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Pendientes" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Este mes" })).toBeNull();
  });
});

describe("HomeScreen: RUL-HOME-04 lo siguiente (AC-HOME-06)", () => {
  it("muestra una sola tarjeta 'Lo siguiente' con acción y 'Ahora no'", async () => {
    mocks.getHome.mockResolvedValue(
      composition({
        blocks: [
          freeMoneyOk,
          {
            kind: "next_action",
            status: "ok",
            data: {
              id: "reminder-1",
              kind: "cuota_vencida",
              title: "Tu cuota venció",
              body: "No la veo registrada.",
              action_url: "/deudas/abc",
            },
          },
        ],
      }),
    );
    render(<HomeScreen />);
    expect(await screen.findAllByText("Lo siguiente")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Registrar el pago" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ahora no" })).toBeTruthy();
  });

  it("'Ahora no' llama a postponeNextAction con el id del recordatorio", async () => {
    mocks.getHome.mockResolvedValue(
      composition({
        blocks: [
          {
            kind: "next_action",
            status: "ok",
            data: { id: "reminder-9", kind: "pago_proximo", title: "t", body: "b", action_url: "/pagos-que-vienen" },
          },
        ],
      }),
    );
    render(<HomeScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Ahora no" }));
    await waitFor(() => expect(mocks.postponeNextAction).toHaveBeenCalledWith("reminder-9"));
  });
});

describe("HomeScreen: AC-HOME-02/AC-HOME-21 dinero libre", () => {
  it("sin cuentas, explica qué falta en vez de mostrar S/0.00", async () => {
    mocks.getHome.mockResolvedValue(composition({ blocks: [{ kind: "free_money", status: "unavailable", data: { has_accounts: false } }] }));
    render(<HomeScreen />);
    expect(await screen.findByText(/necesito el saldo de al menos una cuenta/i)).toBeTruthy();
    expect(screen.queryByText("S/0.00")).toBeNull();
  });

  it("dinero libre exactamente 0 sí se muestra (39 §19 caso 2)", async () => {
    mocks.getHome.mockResolvedValue(
      composition({
        blocks: [
          {
            kind: "free_money",
            status: "ok",
            data: { has_accounts: true, total_balance: 500, separated_balance: 500, free_balance: 0, account_count: 1, box_count: 1 },
          },
        ],
      }),
    );
    render(<HomeScreen />);
    await screen.findByText("Tienes libres");
    expect(screen.getByText("S/0.00")).toBeTruthy();
  });
});

describe("HomeScreen: AC-HOME-18 orden del DOM", () => {
  it("las secciones aparecen en el mismo orden que la composición", async () => {
    mocks.getHome.mockResolvedValue(
      composition({
        blocks: [
          freeMoneyOk,
          { kind: "pending", status: "ok", data: { active_count: 1, needs_completion_count: 0, high_risk_count: 0 } },
          { kind: "movements", status: "ok", data: [] },
        ],
      }),
    );
    const { container } = render(<HomeScreen />);
    await screen.findByText("Tienes libres");
    const headings = Array.from(container.querySelectorAll("h1, h2")).map((node) => node.textContent);
    const pendingIndex = headings.findIndex((text) => text === "Pendientes");
    const movementsIndex = headings.findIndex((text) => text === "Últimos movimientos");
    expect(pendingIndex).toBeGreaterThan(-1);
    expect(movementsIndex).toBeGreaterThan(pendingIndex);
  });
});

describe("HomeScreen: ocultar un bloque (ACT-HOME-07)", () => {
  it("llama a setHomeBlockHidden con el kind correcto y lo retira de la vista", async () => {
    mocks.getHome.mockResolvedValue(
      composition({
        blocks: [freeMoneyOk, { kind: "pending", status: "ok", data: { active_count: 1, needs_completion_count: 0, high_risk_count: 0 } }],
      }),
    );
    render(<HomeScreen />);
    const pendingHeading = await screen.findByRole("heading", { name: "Pendientes" });
    const pendingSection = pendingHeading.closest("section")!;
    fireEvent.click(within(pendingSection).getByRole("button", { name: "Ocultar" }));
    await waitFor(() => expect(mocks.setHomeBlockHidden).toHaveBeenCalledWith("pending", true));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Pendientes" })).toBeNull());
  });
});

describe("HomeScreen: RUL-HOME-09 error por bloque, sin pantalla en blanco", () => {
  it("un bloque con status error muestra reintentar y el resto sigue normal", async () => {
    mocks.getHome.mockResolvedValue(
      composition({
        blocks: [freeMoneyOk, { kind: "pending", status: "error", retryable: true }],
      }),
    );
    render(<HomeScreen />);
    await screen.findByText("Tienes libres");
    expect(screen.getByText("No pude cargar esta parte.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });
});
