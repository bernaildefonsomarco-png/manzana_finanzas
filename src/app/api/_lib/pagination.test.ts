import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  buildCompositeCursorOrFilter,
  buildCursorOrFilter,
  clampLimit,
  decodeCompositeCursor,
  decodeCursor,
  encodeCompositeCursor,
  encodeCursor,
  paginate,
  paginateComposite,
  paginateInMemory,
} from "./pagination";

describe("clampLimit (AC-API-02)", () => {
  it("usa el default cuando no se pide limit", () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_PAGE_LIMIT);
    expect(clampLimit(null)).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("recorta, no rechaza, un limit mayor al maximo", () => {
    expect(clampLimit(500)).toBe(MAX_PAGE_LIMIT);
    expect(clampLimit(101)).toBe(MAX_PAGE_LIMIT);
  });

  it("acepta un limit valido dentro de rango", () => {
    expect(clampLimit(10)).toBe(10);
    expect(clampLimit(100)).toBe(100);
  });

  it("usa el default ante valores invalidos (0, negativos, NaN)", () => {
    expect(clampLimit(0)).toBe(DEFAULT_PAGE_LIMIT);
    expect(clampLimit(-5)).toBe(DEFAULT_PAGE_LIMIT);
    expect(clampLimit(Number.NaN)).toBe(DEFAULT_PAGE_LIMIT);
  });
});

describe("encodeCursor / decodeCursor", () => {
  it("hace round-trip del valor de orden y el id", () => {
    const cursor = encodeCursor("2026-07-14T10:00:00.000Z", "abc-123");
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual({ o: "2026-07-14T10:00:00.000Z", i: "abc-123" });
  });

  it("es opaco: no es JSON legible directamente", () => {
    const cursor = encodeCursor("2026-07-14", "id-1");
    expect(() => JSON.parse(cursor)).toThrow();
  });

  it("sin cursor devuelve null (primera pagina)", () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });

  it("un cursor corrupto devuelve 'invalid', no una primera pagina silenciosa", () => {
    expect(decodeCursor("no-es-base64-json-valido-@@@")).toBe("invalid");
    expect(decodeCursor(Buffer.from("[]").toString("base64url"))).toBe("invalid");
    expect(
      decodeCursor(Buffer.from(JSON.stringify({ o: 5, i: "x" })).toString("base64url"))
    ).toBe("invalid");
  });
});

describe("buildCursorOrFilter", () => {
  it("construye el filtro descendente con desempate por id", () => {
    const filter = buildCursorOrFilter("occurred_at", { o: "2026-07-14", i: "id-1" }, "desc");
    expect(filter).toBe(
      "occurred_at.lt.2026-07-14,and(occurred_at.eq.2026-07-14,id.lt.id-1)"
    );
  });

  it("construye el filtro ascendente con desempate por id", () => {
    const filter = buildCursorOrFilter("occurred_at", { o: "2026-07-14", i: "id-1" }, "asc");
    expect(filter).toBe(
      "occurred_at.gt.2026-07-14,and(occurred_at.eq.2026-07-14,id.gt.id-1)"
    );
  });
});

describe("paginate (AC-API-01)", () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, occurred_at: `2026-07-${10 + i}` }));

  it("sin fila sobrante: has_more false y next_cursor null", () => {
    const { data, page } = paginate(rows(3), 5, (row) => row.occurred_at);
    expect(data).toHaveLength(3);
    expect(page.has_more).toBe(false);
    expect(page.next_cursor).toBeNull();
    expect(page.limit).toBe(5);
  });

  it("con fila sobrante: recorta a limit, has_more true, next_cursor de la ultima fila retenida", () => {
    const { data, page } = paginate(rows(6), 5, (row) => row.occurred_at);
    expect(data).toHaveLength(5);
    expect(data.map((r) => r.id)).toEqual(["id-0", "id-1", "id-2", "id-3", "id-4"]);
    expect(page.has_more).toBe(true);
    expect(decodeCursor(page.next_cursor)).toEqual({ o: "2026-07-14", i: "id-4" });
  });

  it("exactamente limit filas (sin sobrante real): has_more false, no false-positive", () => {
    const { data, page } = paginate(rows(5), 5, (row) => row.occurred_at);
    expect(data).toHaveLength(5);
    expect(page.has_more).toBe(false);
    expect(page.next_cursor).toBeNull();
  });

  it("conjunto vacio: has_more false, next_cursor null", () => {
    const { data, page } = paginate(rows(0), 5, (row) => row.occurred_at);
    expect(data).toHaveLength(0);
    expect(page.has_more).toBe(false);
    expect(page.next_cursor).toBeNull();
  });
});

describe("buildCompositeCursorOrFilter (movements: created_at, occurred_at, id)", () => {
  it("construye el filtro de 2 columnas + desempate por id", () => {
    const filter = buildCompositeCursorOrFilter(
      ["created_at", "occurred_at"],
      { o: ["2026-07-14T10:00:00Z", "2026-07-13T09:00:00Z"], i: "id-1" },
      "desc"
    );
    expect(filter).toBe(
      "created_at.lt.2026-07-14T10:00:00Z," +
        "and(created_at.eq.2026-07-14T10:00:00Z,occurred_at.lt.2026-07-13T09:00:00Z)," +
        "and(created_at.eq.2026-07-14T10:00:00Z,occurred_at.eq.2026-07-13T09:00:00Z,id.lt.id-1)"
    );
  });

  it("con una sola columna, coincide con buildCursorOrFilter", () => {
    const cursor = { o: ["2026-07-14"], i: "id-1" };
    const composite = buildCompositeCursorOrFilter(["occurred_at"], cursor, "desc");
    const simple = buildCursorOrFilter("occurred_at", { o: "2026-07-14", i: "id-1" }, "desc");
    expect(composite).toBe(simple);
  });
});

describe("encodeCompositeCursor / decodeCompositeCursor", () => {
  it("hace round-trip de varios valores de orden y el id", () => {
    const cursor = encodeCompositeCursor(["2026-07-14", "2026-07-13"], "id-1");
    expect(decodeCompositeCursor(cursor)).toEqual({
      o: ["2026-07-14", "2026-07-13"],
      i: "id-1",
    });
  });

  it("un cursor compuesto corrupto devuelve 'invalid'", () => {
    expect(decodeCompositeCursor("no-valido-@@@")).toBe("invalid");
    expect(
      decodeCompositeCursor(Buffer.from(JSON.stringify({ o: "no-es-array", i: "x" })).toString("base64url"))
    ).toBe("invalid");
  });
});

describe("paginateComposite", () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${i}`,
      created_at: `2026-07-${10 + i}`,
      occurred_at: `2026-06-${10 + i}`,
    }));

  it("recorta a limit y codifica el cursor con ambas columnas", () => {
    const { data, page } = paginateComposite(rows(6), 5, (row) => [
      row.created_at,
      row.occurred_at,
    ]);
    expect(data).toHaveLength(5);
    expect(page.has_more).toBe(true);
    expect(decodeCompositeCursor(page.next_cursor)).toEqual({
      o: ["2026-07-14", "2026-06-14"],
      i: "id-4",
    });
  });

  it("sin sobrante: has_more false", () => {
    const { page } = paginateComposite(rows(3), 5, (row) => [row.created_at, row.occurred_at]);
    expect(page.has_more).toBe(false);
    expect(page.next_cursor).toBeNull();
  });
});

describe("paginateInMemory (catalogos pequenos: cuentas, cajas, categorias...)", () => {
  const rows = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

  it("sin cursor, empieza desde el principio", () => {
    const { data, page } = paginateInMemory(rows, 2, null);
    expect(data.map((r) => r.id)).toEqual(["a", "b"]);
    expect(page.has_more).toBe(true);
  });

  it("con cursor, retoma justo despues del id dado", () => {
    const cursor = decodeCursor(encodeCursor("b", "b"));
    const { data, page } = paginateInMemory(rows, 2, cursor === "invalid" ? null : cursor);
    expect(data.map((r) => r.id)).toEqual(["c", "d"]);
    expect(page.has_more).toBe(true);
  });

  it("la ultima pagina no tiene next_cursor", () => {
    const cursor = decodeCursor(encodeCursor("d", "d"));
    const { data, page } = paginateInMemory(rows, 2, cursor === "invalid" ? null : cursor);
    expect(data.map((r) => r.id)).toEqual(["e"]);
    expect(page.has_more).toBe(false);
    expect(page.next_cursor).toBeNull();
  });
});
