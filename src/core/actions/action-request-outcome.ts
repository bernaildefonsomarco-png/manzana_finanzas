/**
 * `WEB-D298`: que paso con la intencion de accion que el ejecutivo entendio.
 *
 * Existe porque `null` estaba diciendo dos cosas incompatibles a la vez, y esa
 * es la raiz de que varias puertas del motor se vieran iguales desde afuera:
 *
 *  - "este turno no pedia nada de esto" — silencio correcto, el turno sigue su
 *    camino y contesta lo que venia a contestar;
 *  - "lo pedia y no se pudo" — silencio **incorrecto**: la persona se queda
 *    creyendo que ocurrio algo que no ocurrio.
 *
 * Desde el lado del que llama, los dos eran `null`. Nombrarlos separa el
 * silencio legitimo del que hay que eliminar, y es lo que permite que cada
 * rama decida sin adivinar: seguir, preguntar, o admitir el limite con su via
 * manual (`ERR-ASI-01`).
 *
 * La duda tiene su propio caso a proposito: no es un fallo —no hay nada roto—
 * pero tampoco es silencio. `40` §3 pide preguntar de mas antes que actuar de
 * mas, y una pregunta solo se puede hacer si el tipo la deja expresar.
 */
export type ActionRequestOutcome<TCommand> =
  /** Este turno no pedia esta accion. El silencio aqui es la respuesta correcta. */
  | { kind: "not_requested" }
  /** Orden tipada y ejecutable. */
  | { kind: "ready"; command: TCommand }
  /**
   * Se entendio que pedia algo, pero falta un dato para hacerlo bien. Se
   * pregunta con las palabras del propio modelo, que es quien declaro la duda.
   */
  | { kind: "needs_clarification"; question: string }
  /**
   * Se entendio que pedia algo y este turno no lo puede hacer. `reason` es para
   * el registro, no para la persona: el texto que ella lee lo compone el
   * planificador de respuesta, con su via manual.
   */
  | { kind: "unavailable"; reason: string };

/** Atajo legible para el caso mas comun. */
export const NOT_REQUESTED = { kind: "not_requested" } as const;
