import { describe, expect, it } from "vitest";
import { readAgentRuntimeConfig } from "@/agents/runtime/config";
import { verificarArranqueSeguro } from "./instrumentation";

describe("AC-RT-01 / AC-REU-06: gate de arranque seguro (53 D-04)", () => {
  it("no lanza fuera de producción, aunque local_fixture esté activo", () => {
    const config = readAgentRuntimeConfig({ APP_ENV: "local" });
    expect(() => verificarArranqueSeguro(config)).not.toThrow();
  });

  it("AC-RT-01: lanza en producción si local_fixture está permitido", () => {
    // No debería poder ocurrir con las reglas de isLocalFixtureAllowed (solo
    // local/test), pero el gate no confía en eso: si algún día una nueva
    // variable de entorno lo permitiera, esto debe seguir fallando el
    // arranque, no solo el endpoint de salud.
    const config = readAgentRuntimeConfig({ APP_ENV: "production" });
    expect(config.localFixtureAllowed).toBe(false); // documenta la premisa
    // Se fuerza la condición directamente para probar el gate, no la regla
    // de isLocalFixtureAllowed (que ya tiene su propio test en config.test.ts).
    expect(() =>
      verificarArranqueSeguro({ ...config, localFixtureAllowed: true })
    ).toThrow(/AC-RT-01/);
  });

  it("AC-REU-06: lanza en producción si production_safe es falso (API sin configurar)", () => {
    const config = readAgentRuntimeConfig({ APP_ENV: "production" });
    expect(() => verificarArranqueSeguro(config)).toThrow(/AC-REU-06/);
  });

  it("no lanza en producción cuando production_safe es verdadero", () => {
    const config = readAgentRuntimeConfig({
      APP_ENV: "production",
      AGENT_RUNTIME_API_KIND: "openai",
      AGENT_RUNTIME_API_MODEL: "gpt-test",
      OPENAI_API_KEY: "secret-value-que-no-debe-aparecer-en-el-mensaje",
      AGENT_RUNTIME_FALLBACK_LOCAL: "true",
    });
    expect(() => verificarArranqueSeguro(config)).not.toThrow();
  });

  it("el mensaje de error no expone credenciales", () => {
    const config = readAgentRuntimeConfig({
      APP_ENV: "production",
      AGENT_RUNTIME_API_KIND: "openai",
      OPENAI_API_KEY: "secret-value-que-no-debe-aparecer-en-el-mensaje",
    });
    try {
      verificarArranqueSeguro(config);
      throw new Error("se esperaba que lanzara");
    } catch (error) {
      expect(String(error)).not.toContain("secret-value-que-no-debe-aparecer-en-el-mensaje");
    }
  });
});
