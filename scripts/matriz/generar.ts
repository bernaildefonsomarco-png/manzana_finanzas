#!/usr/bin/env node
// El generador de la matriz de trazabilidad (`50` §8).
//
// `RUL-TRAZ-06` — la matriz se genera, no se edita. Este script lee
// `documentacion/app_web/` y produce `scripts/matriz/matriz.generada.json`:
// el censo de identificadores, su estado de resolucion, y una fila por
// identificador con las columnas de `50` §4 que hoy se pueden derivar. Lo
// que no se puede derivar queda `null` (`RUL-TRAZ-09`): nunca se adivina.
//
// No depende de nada de la aplicacion — ni de `src/`, ni de una base de
// datos. Por eso puede cerrar `W-01`, el primer corte, sin esperar a nada.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { leerCorpus } from "./lib/corpus.ts";
import { leerRegistroDeTokens } from "./lib/registro-tokens.ts";
import { extraerApariciones, agruparPorIdentificador, type Familia } from "./lib/identificadores.ts";
import { recogerEvidenciasDeCriterios } from "./lib/criterios.ts";
import { evaluarSuperficies } from "./lib/superficies.ts";
import { leerCorteDueño, leerExcepcionesDeCierre, corteQueCierra } from "./lib/cortes.ts";

export interface FilaMatriz {
  id: string;
  familia: Familia;
  documento: string | null;
  seccion: string | null;
  ruta_url: string | null;
  endpoint: null;
  componente: null;
  test: null;
  clase_prueba: string | null;
  nivel_evidencia: string[] | null;
  porton: string | null;
  estado: string;
  dueño: null;
  fecha_revision: null;
  corte: string | null;
}

export interface Matriz {
  generadoEl: string;
  censo: {
    totalIdentificadores: number;
    porFamilia: Record<string, number>;
    criterios: {
      total: number;
      porPorton: { G1: number; G2: number; G3: number };
      porClase: Record<string, number>;
      conClaseAsignada: number;
      conTestSinClase: number;
    };
  };
  validacion: {
    conVariasDefiniciones: { id: string; documentos: string[] }[];
    citasSinDefinicion: string[];
    tokensNoRegistrados: string[];
    criteriosConFormaInvalida: string[];
  };
  superficies: {
    total: number;
    conRuta: number;
    sinRuta: string[];
  };
  filas: FilaMatriz[];
}

export function generarMatriz(): Matriz {
  const documentos = leerCorpus();
  const registro = leerRegistroDeTokens(documentos);
  const apariciones = extraerApariciones(documentos, registro);
  const porId = agruparPorIdentificador(apariciones);
  const evidencias = recogerEvidenciasDeCriterios(documentos);
  const superficies = evaluarSuperficies(documentos, porId);
  const porDocumento = leerCorteDueño(documentos);
  const excepciones = leerExcepcionesDeCierre(documentos);

  const filas: FilaMatriz[] = [];
  for (const entrada of porId.values()) {
    const definicion = entrada.definiciones[0] ?? null;
    const ev = entrada.familia === "AC" ? evidencias.get(entrada.id) : undefined;

    filas.push({
      id: entrada.id,
      familia: entrada.familia,
      documento: definicion?.documento ?? null,
      seccion: definicion?.seccion ?? null,
      ruta_url: null, // la llena `evaluarSuperficies` aparte para SCR-, ver abajo
      endpoint: null,
      componente: null,
      test: null,
      clase_prueba: ev?.clase ?? null,
      nivel_evidencia: ev?.niveles ?? null,
      porton: ev?.porton ?? null,
      estado: "pendiente",
      dueño: null,
      fecha_revision: null,
      corte:
        entrada.familia === "AC" && definicion
          ? corteQueCierra(entrada.id, definicion.numeroDocumento, { porDocumento, excepciones })
          : definicion
            ? (porDocumento.get(definicion.numeroDocumento) ?? null)
            : null,
    });
  }

  const familias: Record<string, number> = {};
  for (const entrada of porId.values()) familias[entrada.familia] = (familias[entrada.familia] ?? 0) + 1;

  const conVariasDefiniciones = [...porId.values()].filter((e) => e.definiciones.length > 1);
  const citasSinDefinicion = [...porId.values()].filter((e) => e.definiciones.length === 0);
  const tokensNoRegistrados = [
    ...new Set(apariciones.filter((a) => a.id && !a.tokenRegistrado).map((a) => a.token)),
  ];

  const portones = { G1: 0, G2: 0, G3: 0 };
  for (const ev of evidencias.values()) if (ev.porton) portones[ev.porton] += 1;

  const clases: Record<string, number> = {};
  for (const ev of evidencias.values()) if (ev.clase) clases[ev.clase] = (clases[ev.clase] ?? 0) + 1;

  const superficiesConRuta = superficies.filter((s) => s.declaraRuta).length;
  const rutaPorId = new Map(superficies.map((s) => [s.id, s.textoRuta]));
  for (const fila of filas) {
    if (fila.familia === "SCR") fila.ruta_url = rutaPorId.get(fila.id) ?? null;
  }

  return {
    generadoEl: new Date().toISOString(),
    censo: {
      totalIdentificadores: porId.size,
      porFamilia: familias,
      criterios: {
        total: familias.AC ?? 0,
        porPorton: portones,
        porClase: clases,
        conClaseAsignada: [...evidencias.values()].filter((e) => e.clase).length,
        conTestSinClase: [...evidencias.values()].filter((e) => e.exigeTest && !e.clase).length,
      },
    },
    validacion: {
      // AC-HECHO-01 / AC-TRAZ-01 parcial: identificadores con mas de una definicion.
      conVariasDefiniciones: conVariasDefiniciones.map((e) => ({
        id: e.id,
        documentos: e.definiciones.map((d) => `${d.documento}:${d.linea}`),
      })),
      // AC-TRAZ-03: identificadores citados sin ninguna definicion.
      citasSinDefinicion: citasSinDefinicion.map((e) => e.id),
      // AC-TRAZ-02: tokens usados que no estan en el registro de 50 §2.
      tokensNoRegistrados,
      // AC-HECHO-03: AC- cuya evidencia declara mal la clase (TEST sin clase, o clase sin TEST).
      criteriosConFormaInvalida: [...evidencias.values()]
        .filter((e) => !e.formaValida && !(e.exigeTest && !e.clase))
        .map((e) => e.id),
    },
    superficies: {
      total: superficies.length,
      conRuta: superficiesConRuta,
      sinRuta: superficies.filter((s) => !s.declaraRuta).map((s) => `${s.id} (${s.documento})`),
    },
    filas,
  };
}

function main(): void {
  const matriz = generarMatriz();
  const destino = join(process.cwd(), "scripts", "matriz", "matriz.generada.json");
  writeFileSync(destino, JSON.stringify(matriz, null, 2) + "\n", "utf8");

  console.log(`Identificadores: ${matriz.censo.totalIdentificadores}`);
  console.log(`Por familia: ${JSON.stringify(matriz.censo.porFamilia)}`);
  console.log(
    `Criterios: ${matriz.censo.criterios.total} (G1 ${matriz.censo.criterios.porPorton.G1}, G2 ${matriz.censo.criterios.porPorton.G2}, G3 ${matriz.censo.criterios.porPorton.G3})`
  );
  console.log(`Superficies con **Ruta:**: ${matriz.superficies.conRuta} de ${matriz.superficies.total}`);
  console.log(`Escrito en ${destino}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
