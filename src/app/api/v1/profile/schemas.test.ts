import { describe, expect, it } from "vitest";
import { UpdateProfileRequestSchema } from "./schemas";

describe("UpdateProfileRequestSchema", () => {
  it("acepta vincular o desvincular telefono", () => {
    expect(
      UpdateProfileRequestSchema.parse({ phone_e164: "+51 928 377 977" })
    ).toEqual({ phone_e164: "+51 928 377 977" });

    expect(UpdateProfileRequestSchema.parse({ phone_e164: null })).toEqual({
      phone_e164: null,
    });
  });

  it("rechaza patches vacios", () => {
    expect(() => UpdateProfileRequestSchema.parse({})).toThrow();
  });
});
