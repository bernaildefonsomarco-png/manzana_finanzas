// Tipos del catálogo de comandos y vocabulario (`40`, `W-16`). Fuente única
// para el generador (`scripts/catalogo/generar.ts`) y para quien consume el
// catálogo en tiempo de ejecución (el verificador, el compilador de
// consultas, el ejecutor de comandos).

export const NIVELES_CONFIRMACION = [
  "ninguna",
  "tarjeta",
  "tarjeta_editable",
  "riesgo",
  "masiva",
  "consentimiento",
] as const;
export type NivelConfirmacion = (typeof NIVELES_CONFIRMACION)[number];

export interface Dimension {
  nombre: string;
  valores: string;
  dueño: string;
}

export interface Medida {
  nombre: string;
  descripcion: string;
  dueño: string;
  advertencia: boolean;
}

export interface Alias {
  nombre: string;
  equivaleA: string;
  dueño: string;
}

export interface Comando {
  nombre: string;
  /** Casi siempre uno; puede haber dos (`riesgo` + `masiva`, `40` §7.2/§7.3). */
  niveles: NivelConfirmacion[];
  detalle: string;
  dueño: string;
}

export interface CensoCatalogo {
  totalDimensiones: number;
  totalMedidas: number;
  totalAlias: number;
  totalLecturas: number;
  totalComandos: number;
  porNivel: Record<NivelConfirmacion, number>;
}
