// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MergeSubcategoryDialog } from "./merge-subcategory-dialog";

const mocks = vi.hoisted(() => ({ mergeSubcategories: vi.fn(), undoSubcategoryMerge: vi.fn() }));
vi.mock("@/shared/api/classification-operations", () => mocks);

beforeEach(() => {
  mocks.mergeSubcategories.mockReset()
    .mockResolvedValueOnce({ preview: { count: 47, target_count_before: 89, target_count_after: 136 } })
    .mockResolvedValueOnce({ batch: { id: "batch-1", movement_count: 47, undo_until: "2026-08-08T00:00:00Z" } });
  mocks.undoSubcategoryMerge.mockReset().mockResolvedValue(undefined);
});

describe("RUL-CAT-07", () => {
  it("muestra 47 + 89 = 136 antes de fusionar y conserva undo", async () => {
    render(<MergeSubcategoryDialog
      source={{ id: "11111111-1111-4111-8111-111111111111", user_id: "user-1", category_id: "transporte", label: "Uber", normalized_label: "uber", created_by: "user", metadata: {}, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", deleted_at: null }}
      candidates={[{ id: "22222222-2222-4222-8222-222222222222", user_id: "user-1", category_id: "transporte", label: "Taxi", normalized_label: "taxi", created_by: "user", metadata: {}, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", deleted_at: null }]}
      open onOpenChange={vi.fn()} onDone={vi.fn()}
    />);
    fireEvent.change(screen.getByLabelText("Se fusionará dentro de"), { target: { value: "22222222-2222-4222-8222-222222222222" } });
    fireEvent.click(screen.getByRole("button", { name: "Ver conteo antes de fusionar" }));
    expect(await screen.findByText(/89 \+ 47 = 136/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar fusión" }));
    expect(await screen.findByRole("button", { name: "Deshacer ahora" })).toBeTruthy();
    await waitFor(() => expect(mocks.mergeSubcategories).toHaveBeenLastCalledWith(expect.objectContaining({ preview: false })));
  });
});
