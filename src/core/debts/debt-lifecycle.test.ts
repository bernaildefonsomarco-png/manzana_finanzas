import { describe, expect, it } from "vitest";
import {
  deriveDebtInstallmentLifecycleStatus,
  deriveDebtLifecycleStatus,
} from "./debt-lifecycle";

describe("debt lifecycle", () => {
  it.each([
    ["2026-07-09", "overdue"],
    ["2026-07-10", "due_soon"],
    ["2026-07-13", "due_soon"],
    ["2026-07-14", "pending"],
  ] as const)(
    "clasifica una cuota con vencimiento %s como %s",
    (dueDate, expected) => {
      expect(
        deriveDebtInstallmentLifecycleStatus({
          currentStatus: "pending",
          dueDate,
          asOfDate: "2026-07-10",
        })
      ).toBe(expected);
    }
  );

  it.each(["paid", "rescheduled", "skipped"] as const)(
    "preserva el estado terminal %s",
    (status) => {
      expect(
        deriveDebtInstallmentLifecycleStatus({
          currentStatus: status,
          dueDate: "2026-01-01",
          asOfDate: "2026-07-10",
        })
      ).toBe(status);
    }
  );

  it("deriva el estado de la deuda desde sus cuotas abiertas", () => {
    expect(
      deriveDebtLifecycleStatus({
        currentStatus: "active",
        installmentStatuses: ["pending", "overdue"],
      })
    ).toBe("overdue");
    expect(
      deriveDebtLifecycleStatus({
        currentStatus: "overdue",
        installmentStatuses: ["pending", "due_soon"],
      })
    ).toBe("due_soon");
    expect(
      deriveDebtLifecycleStatus({
        currentStatus: "due_soon",
        installmentStatuses: ["pending", "paid"],
      })
    ).toBe("active");
  });

  it.each(["draft", "paid", "cancelled", "archived"] as const)(
    "no reabre una deuda en estado %s",
    (status) => {
      expect(
        deriveDebtLifecycleStatus({
          currentStatus: status,
          installmentStatuses: ["overdue"],
        })
      ).toBe(status);
    }
  );
});
