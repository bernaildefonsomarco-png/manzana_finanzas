import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deriveInitialOnboardingSummary,
  recordInitialOnboardingValue,
  startInitialOnboarding,
} from "./onboarding-activation";

const mocks = vi.hoisted(() => ({
  advanceOnboardingStage: vi.fn(),
}));

vi.mock("@/data/repositories/onboarding.repository", () => ({
  advanceOnboardingStage: mocks.advanceOnboardingStage,
}));

describe("OnboardingActivationEngine", () => {
  beforeEach(() => {
    mocks.advanceOnboardingStage.mockReset();
    mocks.advanceOnboardingStage.mockResolvedValue({
      changed: true,
      previous_status: "not_started",
      current_status: "started",
      reason: "advanced",
    });
  });

  it("mantiene al usuario sin uso en una sola accion inicial", () => {
    expect(
      deriveInitialOnboardingSummary({
        persistedStatus: "not_started",
        confirmedMovementsCount: 0,
        debtsCount: 0,
      })
    ).toEqual({
      persisted_status: "not_started",
      effective_status: "not_started",
      stage: "registered_without_use",
      first_value_kind: null,
      show_initial_prompt: true,
      show_first_value_tip: false,
    });
  });

  it("deriva primer valor desde un movimiento aunque el worker siga pendiente", () => {
    expect(
      deriveInitialOnboardingSummary({
        persistedStatus: "started",
        confirmedMovementsCount: 1,
        debtsCount: 0,
      })
    ).toMatchObject({
      effective_status: "first_value_reached",
      stage: "first_value",
      first_value_kind: "movement",
      show_initial_prompt: false,
      show_first_value_tip: true,
    });
  });

  it("reconoce una deuda como ruta valida de primer valor", () => {
    expect(
      deriveInitialOnboardingSummary({
        persistedStatus: "not_started",
        confirmedMovementsCount: 0,
        debtsCount: 1,
      })
    ).toMatchObject({
      effective_status: "first_value_reached",
      first_value_kind: "debt",
      show_initial_prompt: false,
    });
  });

  it("no reactiva automaticamente un onboarding pausado", () => {
    expect(
      deriveInitialOnboardingSummary({
        persistedStatus: "paused",
        confirmedMovementsCount: 1,
        debtsCount: 0,
      })
    ).toMatchObject({
      effective_status: "paused",
      stage: "paused",
      show_initial_prompt: false,
      show_first_value_tip: false,
    });
  });

  it("no degrada estados posteriores al corte inicial", () => {
    expect(
      deriveInitialOnboardingSummary({
        persistedStatus: "activated_strong",
        confirmedMovementsCount: 0,
        debtsCount: 0,
      })
    ).toMatchObject({
      effective_status: "activated_strong",
      stage: "beyond_initial_cut",
      show_initial_prompt: false,
    });
  });

  it("inicia y registra primer valor solo por el puerto atomico", async () => {
    const client = {} as never;

    await startInitialOnboarding(client, {
      userId: "user-1",
      source: "dashboard_home",
      traceId: "trace-1",
    });
    await recordInitialOnboardingValue(client, {
      userId: "user-1",
      trigger: "movement_confirmed",
      source: "outbox",
      traceId: "trace-2",
    });

    expect(mocks.advanceOnboardingStage).toHaveBeenNthCalledWith(1, client, {
      userId: "user-1",
      targetStatus: "started",
      trigger: "initial_action_selected",
      source: "dashboard_home",
      traceId: "trace-1",
    });
    expect(mocks.advanceOnboardingStage).toHaveBeenNthCalledWith(2, client, {
      userId: "user-1",
      targetStatus: "first_value_reached",
      trigger: "movement_confirmed",
      source: "outbox",
      traceId: "trace-2",
    });
  });
});
