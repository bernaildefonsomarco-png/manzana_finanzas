import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentDegradation: vi.fn() }));

vi.mock("@/core/degradation/current-grade", () => ({
  getCurrentDegradation: mocks.getCurrentDegradation,
}));

import { GET } from "./route";

describe("GET /api/v1/assistant/health", () => {
  it("41 S9: expone el grado, si puede proponer acciones y si debe ofrecer via manual", async () => {
    mocks.getCurrentDegradation.mockReturnValue({
      decision: {
        grado: "solo_lectura",
        puedeProponerAcciones: false,
        debeOfrecerViaManualConcreta: false,
        puedeInventarRespuesta: false,
      },
      readiness: { overall_ready: true },
    });

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({
      grado: "solo_lectura",
      puede_proponer_acciones: false,
      debe_ofrecer_via_manual: false,
      agent_runtime: { overall_ready: true },
    });
  });

  it("no es cacheable (41 S15: private, no-store)", async () => {
    mocks.getCurrentDegradation.mockReturnValue({
      decision: {
        grado: "normal",
        puedeProponerAcciones: true,
        debeOfrecerViaManualConcreta: false,
        puedeInventarRespuesta: false,
      },
      readiness: { overall_ready: true },
    });

    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
