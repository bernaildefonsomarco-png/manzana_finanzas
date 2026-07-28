import { describe, expect, it } from "vitest";
import { parseCorrectionCommandText } from "./correction-resolution";

const MOVEMENT_ID = "00000000-0000-4000-8000-000000000010";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000021";

describe("correction command parser", () => {
  it("parsea correccion de monto", () => {
    expect(parseCorrectionCommandText(`corr:amount:${MOVEMENT_ID}:25_50`)).toEqual({
      kind: "amount",
      command_id: `corr:amount:${MOVEMENT_ID}:25_50`,
      movement_id: MOVEMENT_ID,
      amount: 25.5,
    });
  });

  it("parsea correccion de categoria canonica", () => {
    expect(
      parseCorrectionCommandText(`corr:category:${MOVEMENT_ID}:transporte`)
    ).toEqual({
      kind: "category",
      command_id: `corr:category:${MOVEMENT_ID}:transporte`,
      movement_id: MOVEMENT_ID,
      category_id: "transporte",
    });
  });

  it("parsea correccion de cuenta origen", () => {
    expect(
      parseCorrectionCommandText(`corr:acct_origin:${MOVEMENT_ID}:${ACCOUNT_ID}`)
    ).toEqual({
      kind: "account_origin",
      command_id: `corr:acct_origin:${MOVEMENT_ID}:${ACCOUNT_ID}`,
      movement_id: MOVEMENT_ID,
      account_id: ACCOUNT_ID,
      account_field: "account_origin_id",
    });
  });

  it("parsea eliminacion segura", () => {
    expect(parseCorrectionCommandText(`corr:delete:${MOVEMENT_ID}`)).toEqual({
      kind: "delete",
      command_id: `corr:delete:${MOVEMENT_ID}`,
      movement_id: MOVEMENT_ID,
      delete_mode: "soft_delete",
    });
  });

  it("rechaza categoria no canonica", () => {
    expect(parseCorrectionCommandText(`corr:category:${MOVEMENT_ID}:cafes`)).toBeNull();
  });
});
