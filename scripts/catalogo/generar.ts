// Generador del catálogo de comandos y vocabulario (`40` §2, `AC-CATALOGO-01`).
//
// Fuente de verdad mecánica: las tablas de `documentacion/app_web/05_asistente/
// 40_catalogo_de_tools_y_comandos.md` §5 (dimensiones), §6 (medidas y alias) y
// §7 (comandos) — no las §14 de los 16 módulos directamente. Razón: `40` ya
// normalizó el nivel de confirmación (44 formas de prosa → 6 valores de enum,
// `40` §3.1) y resolvió las colisiones de nombre (`40` §9); volver a parsear
// prosa libre de nivel de confirmación en los 16 documentos originales
// reintroduciría exactamente la ambigüedad que `40` existe para eliminar.
//
// Lo que SÍ se contrasta contra los 16 módulos es la existencia del
// identificador (nombre de dimensión/medida/comando): que todo lo declarado
// en la §14 de un módulo aparezca en `40`, y viceversa (`AC-CATALOGO-01`,
// parcial — ver `39_modulo_home_resumen_financiero` W-16 §20 para el alcance
// exacto no cubierto).

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { leerCorpus, type Documento } from "../matriz/lib/corpus.ts";
import { extraerTablas, identificadoresDeCelda } from "./lib/markdown-tablas.ts";
import {
  NIVELES_CONFIRMACION,
  type NivelConfirmacion,
  type Dimension,
  type Medida,
  type Alias,
  type Comando,
} from "../../src/core/catalog/types.ts";

export { NIVELES_CONFIRMACION };
export type { NivelConfirmacion, Dimension, Medida, Alias, Comando };

export interface Catalogo {
  dimensiones: Dimension[];
  medidas: Medida[];
  alias: Alias[];
  comandos: Comando[];
  censo: {
    totalDimensiones: number;
    totalMedidas: number;
    totalAlias: number;
    totalLecturas: number; // dimensiones + medidas + alias
    totalComandos: number;
    porNivel: Record<NivelConfirmacion, number>;
  };
  sincronizacion: {
    /** Identificadores que un módulo declara en su §14 y que no aparecen en 40. */
    faltanEnCatalogo: Array<{ id: string; modulo: string }>;
    /** Identificadores que 40 declara y que no aparecen en ningún §14. */
    faltanEnModulos: string[];
  };
  errores: string[];
}

const MEDIDAS_CON_ADVERTENCIA = new Set(["suma_propuesta", "saldo_total_a_favor", "proyeccion_cierre"]);

function encontrarDoc(documentos: Documento[], rutaSufijo: string): Documento {
  const doc = documentos.find((d) => d.ruta.endsWith(rutaSufijo) || d.rutaSistema.endsWith(rutaSufijo));
  if (!doc) throw new Error(`No se encontró el documento: ${rutaSufijo}`);
  return doc;
}

/** Rango de líneas `[desde, hasta)` de una sección, dado su prefijo (`"§5"`, `"§7.1"`…). */
function rangoDeSeccion(doc: Documento, prefijo: string): [number, number] {
  let desde = -1;
  let hasta = doc.lineas.length;
  for (let i = 0; i < doc.secciones.length; i += 1) {
    const sec = doc.secciones[i];
    const coincide = sec === prefijo || sec.startsWith(`${prefijo}.`);
    if (coincide && desde === -1) desde = i;
    if (desde !== -1 && !coincide && sec !== "") {
      hasta = i;
      break;
    }
  }
  return desde === -1 ? [0, 0] : [desde, hasta];
}

function parsearDimensiones(doc: Documento, errores: string[]): Dimension[] {
  const [desde, hasta] = rangoDeSeccion(doc, "§5");
  const tablas = extraerTablas(doc.lineas, doc.dentroDeCerca, desde, hasta);
  const dimensiones: Dimension[] = [];

  for (const tabla of tablas) {
    const [cabecera, ...filas] = tabla;
    if (!cabecera || cabecera.celdas.length < 3) continue;
    if (!/dimensi[oó]n/i.test(cabecera.celdas[0])) continue;

    for (const fila of filas) {
      if (fila.celdas.length < 3) continue;
      const nombres = identificadoresDeCelda(fila.celdas[0]);
      const dueño = identificadoresDeCelda(fila.celdas[fila.celdas.length - 1])[0];
      if (nombres.length === 0 || !dueño) {
        errores.push(`§5 línea ${fila.linea + 1}: fila sin identificador o sin dueño`);
        continue;
      }
      for (const nombre of nombres) {
        dimensiones.push({ nombre, valores: fila.celdas[1] ?? "", dueño });
      }
    }
  }
  return dimensiones;
}

function parsearMedidas(doc: Documento, errores: string[]): Medida[] {
  const [desde, hasta] = rangoDeSeccion(doc, "§6.1");
  const tablas = extraerTablas(doc.lineas, doc.dentroDeCerca, desde, hasta);
  const medidas: Medida[] = [];

  for (const tabla of tablas) {
    const [cabecera, ...filas] = tabla;
    if (!cabecera || cabecera.celdas.length < 3) continue;
    if (!/medida/i.test(cabecera.celdas[0])) continue;

    for (const fila of filas) {
      if (fila.celdas.length < 3) continue;
      const nombres = identificadoresDeCelda(fila.celdas[0]);
      const dueño = identificadoresDeCelda(fila.celdas[fila.celdas.length - 1])[0];
      if (nombres.length === 0 || !dueño) {
        errores.push(`§6.1 línea ${fila.linea + 1}: fila sin identificador o sin dueño`);
        continue;
      }
      for (const nombre of nombres) {
        medidas.push({
          nombre,
          descripcion: fila.celdas[1] ?? "",
          dueño,
          advertencia: MEDIDAS_CON_ADVERTENCIA.has(nombre),
        });
      }
    }
  }
  return medidas;
}

function parsearAlias(doc: Documento, errores: string[]): Alias[] {
  const [desde, hasta] = rangoDeSeccion(doc, "§6.2");
  const tablas = extraerTablas(doc.lineas, doc.dentroDeCerca, desde, hasta);
  const alias: Alias[] = [];

  for (const tabla of tablas) {
    const [cabecera, ...filas] = tabla;
    if (!cabecera || cabecera.celdas.length < 3) continue;
    if (!/alias/i.test(cabecera.celdas[0])) continue;

    for (const fila of filas) {
      if (fila.celdas.length < 3) continue;
      const nombre = identificadoresDeCelda(fila.celdas[0])[0];
      const dueño = identificadoresDeCelda(fila.celdas[2])[0];
      if (!nombre || !dueño) {
        errores.push(`§6.2 línea ${fila.linea + 1}: alias sin identificador o sin dueño`);
        continue;
      }
      alias.push({ nombre, equivaleA: fila.celdas[1] ?? "", dueño });
    }
  }
  return alias;
}

const PATRON_ENCABEZADO_7X = /^###\s+7\.\d+\s+.*—\s*`(\d+[a-z]?)`/;

function parsearComandos(doc: Documento, errores: string[]): Comando[] {
  const [desde, hasta] = rangoDeSeccion(doc, "§7");
  const comandos: Comando[] = [];
  let dueñoActual: string | null = null;
  let inicioSubseccion = desde;

  for (let i = desde; i <= hasta; i += 1) {
    const linea = i < doc.lineas.length ? doc.lineas[i] : "";
    const coincidencia = PATRON_ENCABEZADO_7X.exec(linea);
    const esNuevaSubseccion = coincidencia !== null || i === hasta;

    if (esNuevaSubseccion) {
      if (dueñoActual !== null) {
        const tablas = extraerTablas(doc.lineas, doc.dentroDeCerca, inicioSubseccion, i);
        for (const tabla of tablas) {
          const [cabecera, ...filas] = tabla;
          if (!cabecera || !/comando/i.test(cabecera.celdas[0] ?? "")) continue;
          for (const fila of filas) {
            const nombres = identificadoresDeCelda(fila.celdas[0] ?? "");
            if (nombres.length === 0) continue;
            const nivelesBrutos = identificadoresDeCelda(fila.celdas[1] ?? "");
            const niveles = nivelesBrutos.filter((n): n is NivelConfirmacion =>
              (NIVELES_CONFIRMACION as readonly string[]).includes(n),
            );
            if (niveles.length === 0) {
              errores.push(`§7 (${dueñoActual}) línea ${fila.linea + 1}: comando(s) "${nombres.join(", ")}" sin nivel de confirmación válido`);
            }
            for (const nombre of nombres) {
              comandos.push({ nombre, niveles, detalle: fila.celdas[2] ?? "", dueño: dueñoActual! });
            }
          }
        }
      }
      if (coincidencia) {
        dueñoActual = coincidencia[1];
        inicioSubseccion = i + 1;
      }
    }
  }
  return comandos;
}

/** Identificadores en primera columna de tablas dentro de §14.1/§14.2 de un módulo. */
function identificadoresDeclaradosEnModulo(doc: Documento): Set<string> {
  const ids = new Set<string>();
  for (const prefijo of ["§14.1", "§14.2"]) {
    const [desde, hasta] = rangoDeSeccion(doc, prefijo);
    const tablas = extraerTablas(doc.lineas, doc.dentroDeCerca, desde, hasta);
    for (const tabla of tablas) {
      const [cabecera, ...filas] = tabla;
      if (!cabecera) continue;
      const primeraEsIdentificador = /dimensi[oó]n|medida|comando|alias/i.test(cabecera.celdas[0] ?? "");
      if (!primeraEsIdentificador) continue;
      for (const fila of filas) {
        for (const id of identificadoresDeCelda(fila.celdas[0] ?? "")) ids.add(id);
      }
    }
  }
  return ids;
}

const MODULOS_CON_CATALOGO = [
  "24", "25", "26", "27", "28", "29", "30", "31",
  "32", "33", "34", "35", "36", "37", "38", "39",
];

export function generarCatalogo(): Catalogo {
  const documentos = leerCorpus();
  const doc40 = encontrarDoc(documentos, "40_catalogo_de_tools_y_comandos.md");
  const errores: string[] = [];

  const dimensiones = parsearDimensiones(doc40, errores);
  const medidas = parsearMedidas(doc40, errores);
  const alias = parsearAlias(doc40, errores);
  const comandos = parsearComandos(doc40, errores);

  const idsEnCatalogo = new Set<string>([
    ...dimensiones.map((d) => d.nombre),
    ...medidas.map((m) => m.nombre),
    ...alias.map((a) => a.nombre),
    ...comandos.map((c) => c.nombre),
  ]);

  const faltanEnCatalogo: Array<{ id: string; modulo: string }> = [];
  const idsEnAlgunModulo = new Set<string>();

  for (const numero of MODULOS_CON_CATALOGO) {
    const doc = documentos.find((d) => d.numero === numero && d.bloque === "04_modulos");
    if (!doc) {
      errores.push(`No se encontró el módulo ${numero} en 04_modulos/`);
      continue;
    }
    const ids = identificadoresDeclaradosEnModulo(doc);
    for (const id of ids) {
      idsEnAlgunModulo.add(id);
      if (!idsEnCatalogo.has(id)) faltanEnCatalogo.push({ id, modulo: numero });
    }
  }

  const faltanEnModulos = [...idsEnCatalogo].filter((id) => !idsEnAlgunModulo.has(id)).sort();

  const porNivel = Object.fromEntries(
    NIVELES_CONFIRMACION.map((nivel) => [nivel, comandos.filter((c) => c.niveles.includes(nivel)).length]),
  ) as Record<NivelConfirmacion, number>;

  return {
    dimensiones,
    medidas,
    alias,
    comandos,
    censo: {
      totalDimensiones: dimensiones.length,
      totalMedidas: medidas.length,
      totalAlias: alias.length,
      totalLecturas: dimensiones.length + medidas.length + alias.length,
      totalComandos: comandos.length,
      porNivel,
    },
    sincronizacion: { faltanEnCatalogo, faltanEnModulos },
    errores,
  };
}

function comoLiteralTs(catalogo: Catalogo): string {
  const cuerpo = JSON.stringify(
    {
      dimensiones: catalogo.dimensiones,
      medidas: catalogo.medidas,
      alias: catalogo.alias,
      comandos: catalogo.comandos,
      censo: catalogo.censo,
    },
    null,
    2,
  );
  return `// Generado por \`npm run catalogo:generar\` a partir de
// \`documentacion/app_web/05_asistente/40_catalogo_de_tools_y_comandos.md\`
// (\`scripts/catalogo/generar.ts\`, \`40\` §2, \`WEB-D254\`). No editar a mano:
// \`tests/corpus/catalogo-generado.test.ts\` falla el build si este archivo
// queda desincronizado de una regeneración fresca.

import type { Dimension, Medida, Alias, Comando, CensoCatalogo } from "./types.ts";

export const CATALOGO_GENERADO: {
  dimensiones: Dimension[];
  medidas: Medida[];
  alias: Alias[];
  comandos: Comando[];
  censo: CensoCatalogo;
} = ${cuerpo} as const;
`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const catalogo = generarCatalogo();
  if (catalogo.errores.length > 0) {
    console.error("Errores de parseo:", catalogo.errores);
    process.exitCode = 1;
  } else if (catalogo.sincronizacion.faltanEnCatalogo.length > 0 || catalogo.sincronizacion.faltanEnModulos.length > 0) {
    console.error("Desincronización 40 ↔ módulos:", catalogo.sincronizacion);
    process.exitCode = 1;
  } else {
    const destino = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "core", "catalog", "generated.ts");
    writeFileSync(destino, comoLiteralTs(catalogo), "utf8");
    console.log(`Catálogo escrito en ${destino}`);
    console.log(JSON.stringify(catalogo.censo, null, 2));
  }
}
