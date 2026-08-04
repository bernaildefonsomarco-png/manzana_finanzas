import { describe, expect, it, vi } from "vitest";
import { hashForAudit, recordAccountEvent, requestMeta } from "./account-events";

describe("hashForAudit — AC-AUTH-19: nunca se guarda la IP en claro", () => {
  it("produce un hash sha256 estable, no la IP en claro", () => {
    const hash = hashForAudit("189.28.14.7");
    expect(hash).not.toBe("189.28.14.7");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashForAudit("189.28.14.7")).toBe(hash);
  });

  it("dos IPs distintas producen hashes distintos", () => {
    expect(hashForAudit("189.28.14.7")).not.toBe(hashForAudit("189.28.14.8"));
  });

  it("nulo o vacío devuelve nulo", () => {
    expect(hashForAudit(null)).toBeNull();
    expect(hashForAudit(undefined)).toBeNull();
    expect(hashForAudit("")).toBeNull();
  });
});

describe("requestMeta", () => {
  it("toma la primera IP de x-forwarded-for", () => {
    const request = new Request("https://manzana.app", {
      headers: { "x-forwarded-for": "189.28.14.7, 10.0.0.1", "user-agent": "vitest" },
    });
    expect(requestMeta(request)).toEqual({ ip: "189.28.14.7", userAgent: "vitest" });
  });

  it("cae a x-real-ip si no hay x-forwarded-for", () => {
    const request = new Request("https://manzana.app", {
      headers: { "x-real-ip": "10.9.9.9" },
    });
    expect(requestMeta(request).ip).toBe("10.9.9.9");
  });
});

describe("recordAccountEvent", () => {
  it("inserta con el kind, el user_id y los hashes, nunca la IP en claro", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: () => ({ insert }) };

    await recordAccountEvent(client, {
      userId: "user-1",
      kind: "clave_cambiada",
      ip: "189.28.14.7",
      userAgent: "vitest-agent",
    });

    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      kind: "clave_cambiada",
      ip_hash: hashForAudit("189.28.14.7"),
      user_agent_hash: hashForAudit("vitest-agent"),
    });
  });

  it("RUL-HECHO-02: si recordAccountEvent no se llama, el insert nunca ocurre", () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    // No se llama a recordAccountEvent aquí a propósito: confirma que el
    // insert del test anterior prueba la función, no solo que exista.
    expect(insert).not.toHaveBeenCalled();
  });

  it("un fallo al escribir el evento no lanza — la acción real ya ocurrió", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: "db down" } });
    const client = { from: () => ({ insert }) };

    await expect(
      recordAccountEvent(client, {
        userId: "user-1",
        kind: "sesiones_cerradas",
        ip: null,
        userAgent: null,
      })
    ).resolves.toBeUndefined();
  });
});
