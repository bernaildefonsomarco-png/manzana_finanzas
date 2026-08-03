// Los cuatro grados de degradación (`23` §7, `W-16`). Determinista: dado el
// estado real del modelo y del Core, decide qué grado corresponde y qué le
// corresponde a ese grado — nunca una respuesta peor presentada como normal
// (`23` §2 principio 4).

export const DEGRADATION_GRADES = [
  "normal",
  "lento",
  "sin_modelo",
  "solo_lectura",
] as const;
export type DegradationGrade = (typeof DEGRADATION_GRADES)[number];

export type DegradationSignal = {
  /** El modelo no está disponible o la llamada falló. */
  modeloNoDisponible: boolean;
  /** El modelo respondió, pero tardó más de lo previsto (`23` §5). */
  modeloTardando: boolean;
  /** El Core rechaza escrituras, o hay una incidencia declarada. */
  coreRechazaEscrituras: boolean;
};

export type DegradationDecision = {
  grado: DegradationGrade;
  /** Puede el turno proponer acciones que requieran confirmación. */
  puedeProponerAcciones: boolean;
  /** Debe ofrecerse una vía manual concreta (no genérica) para lo que se intentaba. */
  debeOfrecerViaManualConcreta: boolean;
  /** `20b`/`22`: en ningún grado degradado se inventa una respuesta. */
  puedeInventarRespuesta: false;
};

/**
 * `AC-RT-07`: con el modelo caído la app sigue usable y el asistente lo
 * declara con una vía manual concreta. `sin_modelo` es el grado más severo
 * — sin él no hay conversación posible, ni siquiera de solo lectura — y por
 * eso tiene prioridad sobre `solo_lectura`, que sí conserva la capacidad de
 * consultar y explicar (`WEB-D261`).
 */
export function determinarGradoDeDegradacion(
  signal: DegradationSignal,
): DegradationDecision {
  if (signal.modeloNoDisponible) {
    return {
      grado: "sin_modelo",
      puedeProponerAcciones: false,
      debeOfrecerViaManualConcreta: true,
      puedeInventarRespuesta: false,
    };
  }
  if (signal.coreRechazaEscrituras) {
    return {
      grado: "solo_lectura",
      puedeProponerAcciones: false,
      debeOfrecerViaManualConcreta: false,
      puedeInventarRespuesta: false,
    };
  }
  if (signal.modeloTardando) {
    return {
      grado: "lento",
      puedeProponerAcciones: true,
      debeOfrecerViaManualConcreta: false,
      puedeInventarRespuesta: false,
    };
  }
  return {
    grado: "normal",
    puedeProponerAcciones: true,
    debeOfrecerViaManualConcreta: false,
    puedeInventarRespuesta: false,
  };
}
