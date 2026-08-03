// Cálculo aislado (`20b` §6, `23` §5b.2, `W-16`). Función pura: entra un
// array de filas ya traídas por el panorama o la consulta abierta, sale un
// valor. Cero base de datos, cero red, cero ficheros (`AC-SEM-06`) — esta
// garantía es estructural: el módulo no importa ningún cliente de datos.

export const LIMITE_FILAS_CALCULO_AISLADO = 50_000;
export const LIMITE_TIEMPO_MS_CALCULO_AISLADO = 3_000;

export type SandboxSanityCheck = {
  code:
    | "suma_excede_total"
    | "conteo_excede_filas"
    | "porcentaje_fuera_de_rango"
    | "fecha_fuera_de_rango"
    | "valor_no_numerico";
  message: string;
};

export type IsolatedCalculationInput<TRow, TResult> = {
  filas: TRow[];
  /** `20b` §5.4/§6.1: el resultado hereda las referencias de su entrada. */
  referencias: string[];
  calcular: (filas: TRow[]) => TResult;
  /** `20b` §6.4: procedimiento en lenguaje del usuario, no el código. */
  explicacion: string;
  /** `20b` §2.1/§6.1: todo supuesto del mundo que el cálculo aplicó. */
  supuestos?: string[];
  /** `20b` §6.3: comprobación de sanidad específica del cálculo. */
  comprobarSanidad?: (resultado: TResult, filas: TRow[]) => SandboxSanityCheck | null;
};

export type IsolatedCalculationResult<TResult> =
  | {
      emitido: true;
      resultado: TResult;
      referencias: string[];
      explicacion: string;
      supuestos: string[];
      tiempoMs: number;
    }
  | {
      emitido: false;
      razon: "limite_de_filas" | "limite_de_tiempo" | "fallo_de_sanidad" | "error_de_calculo";
      mensaje: string;
    };

/**
 * `AC-SEM-12`/`AC-SEM-13`: superar el límite de filas o de tiempo nunca
 * devuelve un resultado parcial — se rechaza entero, con la razón, para que
 * quien llama aplique la escalera de `20b` §6.2 (reformular, acotar y
 * decirlo, o rechazar). El límite de memoria (128 MB, `23` §5b.2) y el de
 * consultas por turno (5) no se aplican aquí: el primero exige aislamiento
 * de proceso y el segundo es un contador a nivel de turno, no de un cálculo
 * individual — quedan para la fase de runtime (`WEB-D258`).
 */
export function runIsolatedCalculation<TRow, TResult>(
  input: IsolatedCalculationInput<TRow, TResult>,
): IsolatedCalculationResult<TResult> {
  if (input.filas.length > LIMITE_FILAS_CALCULO_AISLADO) {
    return {
      emitido: false,
      razon: "limite_de_filas",
      mensaje: `El calculo recibio ${input.filas.length} filas, sobre el tope de ${LIMITE_FILAS_CALCULO_AISLADO} (20b S6.2).`,
    };
  }

  const inicio = ahoraMs();
  let resultado: TResult;
  try {
    resultado = input.calcular(input.filas);
  } catch (error) {
    return {
      emitido: false,
      razon: "error_de_calculo",
      mensaje: error instanceof Error ? error.message : String(error),
    };
  }
  const tiempoMs = ahoraMs() - inicio;
  if (tiempoMs > LIMITE_TIEMPO_MS_CALCULO_AISLADO) {
    return {
      emitido: false,
      razon: "limite_de_tiempo",
      mensaje: `El calculo tomo ${tiempoMs.toFixed(0)}ms, sobre el tope de ${LIMITE_TIEMPO_MS_CALCULO_AISLADO}ms (23 S5b.2).`,
    };
  }

  const falloEspecifico = input.comprobarSanidad?.(resultado, input.filas) ?? null;
  const fallo = falloEspecifico ?? comprobarSanidadNumericaBasica(resultado);
  if (fallo) {
    return { emitido: false, razon: "fallo_de_sanidad", mensaje: fallo.message };
  }

  return {
    emitido: true,
    resultado,
    referencias: input.referencias,
    explicacion: input.explicacion,
    supuestos: input.supuestos ?? [],
    tiempoMs,
  };
}

function ahoraMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function comprobarSanidadNumericaBasica(resultado: unknown): SandboxSanityCheck | null {
  if (typeof resultado === "number" && (Number.isNaN(resultado) || !Number.isFinite(resultado))) {
    return { code: "valor_no_numerico", message: "El resultado calculado es NaN o infinito." };
  }
  return null;
}

// Comprobaciones de sanidad compositivas de `20b` §6.3, listas para pasar
// como `comprobarSanidad`. Genéricas: no conocen el dominio, solo comparan
// números/fechas ya calculados por quien llama.

export function comprobarSumaParcialNoSuperaTotal(
  parcial: number,
  total: number,
): SandboxSanityCheck | null {
  if (parcial > total) {
    return {
      code: "suma_excede_total",
      message: `La suma parcial (${parcial}) supera el total de su conjunto de entrada (${total}).`,
    };
  }
  return null;
}

export function comprobarConteoNoSuperaFilas(
  conteo: number,
  filas: number,
): SandboxSanityCheck | null {
  if (conteo > filas) {
    return {
      code: "conteo_excede_filas",
      message: `El conteo (${conteo}) supera las filas de entrada (${filas}).`,
    };
  }
  return null;
}

export function comprobarPorcentajeEnRango(
  porcentaje: number,
): SandboxSanityCheck | null {
  if (porcentaje < 0 || porcentaje > 100) {
    return {
      code: "porcentaje_fuera_de_rango",
      message: `El porcentaje (${porcentaje}) esta fuera del rango 0-100.`,
    };
  }
  return null;
}

export function comprobarFechaEnRangoDeEntrada(
  fecha: string,
  desde: string,
  hasta: string,
): SandboxSanityCheck | null {
  if (fecha < desde || fecha > hasta) {
    return {
      code: "fecha_fuera_de_rango",
      message: `La fecha ${fecha} cae fuera del rango de los datos de entrada (${desde}..${hasta}).`,
    };
  }
  return null;
}
