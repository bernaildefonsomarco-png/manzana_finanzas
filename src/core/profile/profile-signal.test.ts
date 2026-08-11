import { describe, expect, it } from "vitest";
import type { ProfileSignalRequest } from "@/agents/conversational-executive-agent/types";
import { compileProfileSignal } from "./profile-signal";

function señal(
  overrides: Partial<ProfileSignalRequest> = {},
): ProfileSignalRequest {
  return {
    intent: "observed",
    subject_key: "vida:cobro",
    statement: "Cobras el 15 y el último día del mes",
    origin: "dicho",
    unlocks: "poder decirte si llegas a fin de mes",
    source_category_id: null,
    confidence: 0.9,
    ambiguities: [],
    ...overrides,
  };
}

const NO_SENSIBLE = { categoriaOrigenEsSensible: false };

describe("compileProfileSignal (`AC-PERF-14`, `20c` §6b.1)", () => {
  it("una señal real de la capa vida se convierte en candidato", () => {
    expect(compileProfileSignal(señal(), NO_SENSIBLE)).toEqual({
      subjectKey: "vida:cobro",
      capa: "vida",
      statement: "Cobras el 15 y el último día del mes",
      origin: "dicho",
      desbloquea: "poder decirte si llegas a fin de mes",
    });
  });

  it("la capa sale del prefijo del subject_key, no de un campo del modelo", () => {
    const resultado = compileProfileSignal(
      señal({
        subject_key: "vinculo:preocupacion",
        statement: "Lo que más te preocupa es llegar a fin de mes",
      }),
      NO_SENSIBLE,
    );
    expect(resultado?.capa).toBe("vinculo");
  });

  it("`AC-PERF-10`: una categoría sensible no genera candidato", () => {
    expect(
      compileProfileSignal(
        señal({ source_category_id: "salud" }),
        { categoriaOrigenEsSensible: true },
      ),
    ).toBeNull();
  });

  it("`AC-PERF-10` no admite excepción de capa", () => {
    for (const subjectKey of ["vida:trabajo", "vinculo:carga_emocional"]) {
      expect(
        compileProfileSignal(señal({ subject_key: subjectKey }), {
          categoriaOrigenEsSensible: true,
        }),
      ).toBeNull();
    }
  });

  it("sin señal, sin intención o con dudas no hay candidato", () => {
    expect(compileProfileSignal(null, NO_SENSIBLE)).toBeNull();
    expect(
      compileProfileSignal(señal({ intent: "none" }), NO_SENSIBLE),
    ).toBeNull();
    expect(
      compileProfileSignal(
        señal({ ambiguities: ["no sé si habla de él o de su pareja"] }),
        NO_SENSIBLE,
      ),
    ).toBeNull();
  });

  it("una lectura dudosa no se guarda", () => {
    expect(
      compileProfileSignal(señal({ confidence: 0.5 }), NO_SENSIBLE),
    ).toBeNull();
  });

  it("`20c` §9: un hecho que no desbloquea nada no se recoge", () => {
    expect(
      compileProfileSignal(señal({ unlocks: "   " }), NO_SENSIBLE),
    ).toBeNull();
  });

  it("estilo e hilo no entran por aquí: ya tienen dueño", () => {
    expect(
      compileProfileSignal(
        señal({ subject_key: "estilo:longitud" }),
        NO_SENSIBLE,
      ),
    ).toBeNull();
    expect(
      compileProfileSignal(señal({ subject_key: "hilo:tema" }), NO_SENSIBLE),
    ).toBeNull();
  });

  it("un subject_key de otro ámbito de memoria no es perfil", () => {
    expect(
      compileProfileSignal(
        señal({ subject_key: "comercio:Rappi" }),
        NO_SENSIBLE,
      ),
    ).toBeNull();
    expect(
      compileProfileSignal(señal({ subject_key: "sin_prefijo" }), NO_SENSIBLE),
    ).toBeNull();
  });
});
