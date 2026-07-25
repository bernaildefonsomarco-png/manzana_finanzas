import { describe, expect, it } from "vitest";

import { readConversationalExecutiveMode } from "./mode";

describe("readConversationalExecutiveMode", () => {
  it.each(["off", "shadow", "active"] as const)(
    "honra el modo explicito %s",
    (mode) => {
      expect(
        readConversationalExecutiveMode({
          NODE_ENV: "test",
          CONVERSATIONAL_EXECUTIVE_MODE: mode,
        }),
      ).toBe(mode);
    },
  );

  it("mantiene apagada la migracion en tests que no la declaran", () => {
    expect(readConversationalExecutiveMode({ NODE_ENV: "test" })).toBe("off");
  });

  it("usa shadow como migracion segura fuera de tests", () => {
    expect(readConversationalExecutiveMode({ NODE_ENV: "production" })).toBe(
      "shadow",
    );
  });
});
