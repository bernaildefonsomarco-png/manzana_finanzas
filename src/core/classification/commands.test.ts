// ERR-CAT-05 / AC-CAT-13 (`25` §7): un movimiento admite hasta 6 etiquetas.
import { describe, expect, it } from "vitest";
import { ClassificationCommandSchema } from "./commands";

function uuid(n: number): string {
  return `1111111${n}-1111-4111-8111-111111111111`;
}

function setTagsCommand(tagIds: string[]) {
  return {
    type: "SetMovementTagsCommand" as const,
    command_id: uuid(0),
    user_id: uuid(1),
    actor: { type: "user" as const, id: uuid(1) },
    source: "test",
    trace_id: uuid(3),
    payload: {
      movement_id: uuid(2),
      tag_ids: tagIds,
      assignment_source: "user" as const,
      confirmed_by_user: true,
    },
  };
}

describe("ClassificationCommandSchema (SetMovementTagsCommand)", () => {
  it("acepta hasta 6 etiquetas", () => {
    const tagIds = Array.from({ length: 6 }, (_, i) => uuid(i));

    expect(() => ClassificationCommandSchema.parse(setTagsCommand(tagIds))).not.toThrow();
  });

  it("rechaza mas de 6 etiquetas", () => {
    const tagIds = Array.from({ length: 7 }, (_, i) => uuid(i));

    expect(() => ClassificationCommandSchema.parse(setTagsCommand(tagIds))).toThrow(
      /hasta 6 etiquetas/
    );
  });
});
