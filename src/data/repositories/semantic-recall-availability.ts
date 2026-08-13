import { logger } from "@/shared/telemetry/logger";

/**
 * Una migracion de recuperacion semantica y el codigo que la usa se despliegan
 * por separado, y en cualquier orden. Este modulo es lo que permite que el
 * codigo nuevo conviva con la base vieja sin romperse: pregunta una vez, se
 * anota que la funcion no existe, deja de preguntar por un rato y vuelve a
 * intentarlo despues.
 *
 * Degradar es seguro **porque un ranking semantico no autoriza nada**: solo
 * decide cuales de los datos que el llamador ya podia leer se miran primero.
 * Quien lo use tiene que conservar esa propiedad.
 *
 * Vive suelto y no dentro de un repositorio porque ya hay dos recuperaciones
 * semanticas con exactamente la misma logica de disponibilidad —la memoria
 * confirmada (`070`) y el hilo del asistente (`077`)— y cada una necesita su
 * propio estado, no uno compartido: que falte una funcion no dice nada sobre
 * la otra.
 */

/**
 * El `absent` caduca. Sin esto, un proceso que arranco un minuto antes de que
 * la migracion se aplicara —o antes de que PostgREST recargara su cache de
 * esquema— se quedaria degradado hasta que lo reciclaran. Reintentar cada tanto
 * cuesta una llamada fallida; no reintentar cuesta la funcionalidad entera.
 */
const RETRY_MS = 10 * 60 * 1000;

export type SemanticRecallAvailability = {
  /** `false` solo mientras dure la ventana de espera tras un fallo por ausencia. */
  isAvailable(): boolean;
  /** La funcion respondio: se limpia cualquier marca de ausencia. */
  markPresent(): void;
  /**
   * Clasifica el error. Devuelve `true` si era "la migracion no esta aplicada"
   * —y en ese caso deja anotada la ausencia—, `false` si era cualquier otro
   * fallo, que el llamador debe registrar por su cuenta.
   */
  markAbsentIfMissing(error: unknown): boolean;
  /** Solo para pruebas: vuelve a preguntar si la recuperacion semantica existe. */
  reset(): void;
};

export function createSemanticRecallAvailability(input: {
  /** Funcion RPC que aparece en el error cuando la migracion falta. */
  functionName: string;
  /** Archivo de migracion, para que el aviso diga que hay que aplicar. */
  migration: string;
}): SemanticRecallAvailability {
  let state: "unknown" | "present" | "absent" = "unknown";
  let disabledAt = 0;

  return {
    isAvailable() {
      if (state !== "absent") return true;
      return Date.now() - disabledAt >= RETRY_MS;
    },
    markPresent() {
      state = "present";
      disabledAt = 0;
    },
    markAbsentIfMissing(error: unknown) {
      if (!isMissingSemanticRecallError(error, input.functionName)) return false;
      if (state !== "absent") {
        logger.warn("semantic_recall.unavailable", {
          error,
          function: input.functionName,
          migration: input.migration,
        });
      }
      state = "absent";
      disabledAt = Date.now();
      return true;
    },
    reset() {
      state = "unknown";
      disabledAt = 0;
    },
  };
}

/**
 * `PGRST202` (la funcion no esta en la cache de esquema), `42883` (funcion
 * inexistente) y `42703`/`PGRST204` (la columna `embedding` no existe) son las
 * formas en que PostgREST responde cuando la migracion todavia no corrio. Un
 * falso positivo solo degrada la recuperacion: nunca escribe de mas ni expone
 * nada que el llamador no pudiera leer igual.
 */
export function isMissingSemanticRecallError(
  error: unknown,
  functionName: string,
): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const code = typeof record.code === "string" ? record.code : "";
  if (
    code === "PGRST202" ||
    code === "PGRST204" ||
    code === "42883" ||
    code === "42703" ||
    code === "42704"
  ) {
    return true;
  }

  const text = [record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  if (
    !text.includes(functionName.toLowerCase()) &&
    !text.includes("embedding") &&
    !text.includes("vector")
  ) {
    return false;
  }
  return (
    text.includes("does not exist") ||
    text.includes("schema cache") ||
    text.includes("could not find") ||
    text.includes("unknown")
  );
}
