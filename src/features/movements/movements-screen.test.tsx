import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MovementsScreen } from "./movements-screen";

const mocks = vi.hoisted(() => ({
  createMovement: vi.fn(),
  getClassificationCatalog: vi.fn(),
  listMovements: vi.fn(),
}));

vi.mock("./movements-api", async () => {
  const actual = await vi.importActual<typeof import("./movements-api")>(
    "./movements-api"
  );
  return {
    ...actual,
    createMovement: mocks.createMovement,
    listMovements: mocks.listMovements,
  };
});

vi.mock("./classification-api", () => ({
  createRelatedPerson: vi.fn(),
  createSubcategory: vi.fn(),
  createTag: vi.fn(),
  getClassificationCatalog: mocks.getClassificationCatalog,
}));

describe("MovementsScreen onboarding intent", () => {
  beforeEach(() => {
    mocks.createMovement.mockReset();
    mocks.listMovements.mockReset();
    mocks.getClassificationCatalog.mockReset();
    mocks.listMovements.mockResolvedValue([]);
    mocks.getClassificationCatalog.mockResolvedValue({
      categories: [],
      subcategories: [],
      related_people: [],
      tags: [],
    });
  });

  it("abre el formulario desde la CTA inicial y consume el intent al cerrar", async () => {
    const onNewIntentConsumed = vi.fn();
    render(
      <MovementsScreen
        openNewOnMount
        onNewIntentConsumed={onNewIntentConsumed}
      />
    );

    expect(
      await screen.findByRole("dialog", { name: "Nuevo movimiento" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onNewIntentConsumed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
