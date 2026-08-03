import { describe, expect, it } from "vitest";
import { decidirConfirmacionDePerfil } from "./confirmation-gate";

const candidatoIngreso = { id: "c1", subjectKey: "vida:cobro_frecuencia", askCount: 0 };
const candidatoTrabajo = { id: "c2", subjectKey: "vida:trabajo", askCount: 0 };

describe("decidirConfirmacionDePerfil (20c S3, AC-PERF-02)", () => {
  it("nunca pregunta en el primer turno de la conversacion", () => {
    const resultado = decidirConfirmacionDePerfil({
      esPrimerTurnoDeLaConversacion: true,
      yaSePreguntoEnEstaConversacion: false,
      candidatos: [candidatoIngreso],
      desbloqueaAlgoConcreto: () => true,
    });
    expect(resultado).toEqual({ preguntar: false, razon: "primer_turno" });
  });

  it("como maximo una confirmacion por conversacion", () => {
    const resultado = decidirConfirmacionDePerfil({
      esPrimerTurnoDeLaConversacion: false,
      yaSePreguntoEnEstaConversacion: true,
      candidatos: [candidatoIngreso],
      desbloqueaAlgoConcreto: () => true,
    });
    expect(resultado).toEqual({
      preguntar: false,
      razon: "ya_se_pregunto_en_esta_conversacion",
    });
  });

  it("no pregunta si ningun candidato desbloquea algo concreto", () => {
    const resultado = decidirConfirmacionDePerfil({
      esPrimerTurnoDeLaConversacion: false,
      yaSePreguntoEnEstaConversacion: false,
      candidatos: [candidatoIngreso, candidatoTrabajo],
      desbloqueaAlgoConcreto: () => false,
    });
    expect(resultado).toEqual({ preguntar: false, razon: "sin_candidatos_elegibles" });
  });

  it("pregunta por un candidato elegible fuera del primer turno", () => {
    const resultado = decidirConfirmacionDePerfil({
      esPrimerTurnoDeLaConversacion: false,
      yaSePreguntoEnEstaConversacion: false,
      candidatos: [candidatoIngreso],
      desbloqueaAlgoConcreto: () => true,
    });
    expect(resultado).toEqual({ preguntar: true, candidato: candidatoIngreso });
  });

  it("deja de preguntar tras dos veces ignorado (20c S3)", () => {
    const ignoradoDosVeces = { ...candidatoIngreso, askCount: 2 };
    const resultado = decidirConfirmacionDePerfil({
      esPrimerTurnoDeLaConversacion: false,
      yaSePreguntoEnEstaConversacion: false,
      candidatos: [ignoradoDosVeces],
      desbloqueaAlgoConcreto: () => true,
    });
    expect(resultado).toEqual({ preguntar: false, razon: "sin_candidatos_elegibles" });
  });

  it("todavia pregunta si solo fue ignorado una vez", () => {
    const ignoradoUnaVez = { ...candidatoIngreso, askCount: 1 };
    const resultado = decidirConfirmacionDePerfil({
      esPrimerTurnoDeLaConversacion: false,
      yaSePreguntoEnEstaConversacion: false,
      candidatos: [ignoradoUnaVez],
      desbloqueaAlgoConcreto: () => true,
    });
    expect(resultado).toEqual({ preguntar: true, candidato: ignoradoUnaVez });
  });

  it("entre varios elegibles, elige el que menos veces se pregunto ya", () => {
    const menosPreguntado = { ...candidatoTrabajo, askCount: 0 };
    const masPreguntado = { ...candidatoIngreso, askCount: 1 };
    const resultado = decidirConfirmacionDePerfil({
      esPrimerTurnoDeLaConversacion: false,
      yaSePreguntoEnEstaConversacion: false,
      candidatos: [masPreguntado, menosPreguntado],
      desbloqueaAlgoConcreto: () => true,
    });
    expect(resultado).toEqual({ preguntar: true, candidato: menosPreguntado });
  });
});
