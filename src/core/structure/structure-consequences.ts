import type { StructureEntity } from "./structure-commands";

/**
 * `RUL-ESTR-05`: lo que el usuario pierde al cerrar cada estructura, dicho
 * antes de tocar nada y siempre con las mismas palabras.
 *
 * Este texto **no lo redacta el modelo**. Una confirmacion destructiva vale lo
 * que valga el entendimiento de lo que se va a perder, y el modelo puede
 * suavizarlo, omitirlo o inventarlo. Aqui esta escrito una vez, es
 * deterministico y se antepone a la pregunta del turno.
 *
 * Cada frase describe la consecuencia **real** de la operacion, verificada
 * contra el ejecutor:
 *
 *  - **caja**: `softDeleteBox` mas un `asignacion_interna` de salida, igual que
 *    `DELETE /api/v1/boxes/[id]`. El dinero no desaparece: vuelve a lo libre de
 *    su cuenta, y por tanto vuelve a ser gastable.
 *  - **cuenta**: `archiveBoxesForAccount` mas `softDeleteAccount`, igual que
 *    `DELETE /api/v1/accounts/[id]`. Los movimientos se conservan, el saldo se
 *    queda contabilizado en la cuenta archivada y esta deja de sumar al total.
 *    Las cajas de esa cuenta se archivan en cascada.
 *  - **meta** / **presupuesto**: `archive` del RPC correspondiente, que marca
 *    `deleted_at` y deja de mostrarlo. El historial no se borra.
 *  - **recurrente**: `cancelRecurringRule`, que deja de generar ocurrencias
 *    futuras. Lo ya pagado sigue en el historial.
 */
const QUE_SE_PIERDE: Record<StructureEntity, string> = {
  caja:
    "Ojo con esto: al cerrar la caja, el dinero que tiene apartado vuelve a tu saldo libre y deja de estar protegido, así que se puede gastar. La caja deja de aparecer, aunque el historial de movimientos se conserva.",
  cuenta:
    "Ojo con esto: al archivar la cuenta, sus cajas se archivan también y la cuenta deja de sumar a tu total. No se borra nada: los movimientos y el saldo se conservan, y la puedes restaurar después.",
  meta:
    "Ojo con esto: al cerrar la meta dejas de seguir su avance y desaparece de tus metas. Lo que hayas juntado en su caja no se toca.",
  presupuesto:
    "Ojo con esto: al cerrar el presupuesto dejas de tener ese límite de referencia y desaparece del periodo. Tus gastos y tu saldo no cambian.",
  recurrente:
    "Ojo con esto: al cancelar el pago recurrente dejo de avisarte y de esperar sus próximos cobros. Lo ya pagado se conserva, pero si vuelve a cobrarte, ya no lo voy a estar esperando.",
};

/** Frase deterministica de lo que se pierde al cerrar esta estructura. */
export function describeStructureLoss(entity: StructureEntity): string {
  return QUE_SE_PIERDE[entity];
}
