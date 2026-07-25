import { describe, expect, it } from "vitest";
import { nextProviderDeliveryStatus } from "./whatsapp-delivery.repository";

describe("nextProviderDeliveryStatus", () => {
  it("avanza sent -> delivered -> read", () => {
    expect(nextProviderDeliveryStatus("sent", "delivered")).toBe("delivered");
    expect(nextProviderDeliveryStatus("delivered", "read")).toBe("read");
  });

  it("no retrocede cuando Meta entrega estados fuera de orden", () => {
    expect(nextProviderDeliveryStatus("read", "sent")).toBe("read");
    expect(nextProviderDeliveryStatus("read", "delivered")).toBe("read");
    expect(nextProviderDeliveryStatus("delivered", "sent")).toBe("delivered");
  });

  it("mantiene failed como estado terminal", () => {
    expect(nextProviderDeliveryStatus("sent", "failed")).toBe("failed");
    expect(nextProviderDeliveryStatus("failed", "read")).toBe("failed");
  });
});
