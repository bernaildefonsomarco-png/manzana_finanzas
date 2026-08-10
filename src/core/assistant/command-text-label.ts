/**
 * Etiqueta legible para los turnos que en realidad son el payload de un boton.
 *
 * Confirmar una propuesta manda `option.id`, que ya es el comando —
 * `corr:<accion>:<uuid>` para una correccion, `estr:<uuid>` para una
 * estructura— porque es el mismo payload que devuelve WhatsApp al pulsar y eso
 * deja un solo camino de resolucion para los dos canales. El costo era que la
 * conversacion mostraba al usuario diciendo
 * `estr:94411df8-74be-4365-9c9f-d84346a1c484`, que no es lo que hizo: pulso un
 * boton que decia "Si, crear meta".
 *
 * La etiqueta se deriva aqui, del propio comando, y no se acepta del cliente:
 * lo que se guarda como dicho por el usuario no puede depender de lo que el
 * navegador afirme que mostro. El comando crudo sigue viajando intacto al
 * motor —esto solo cambia lo que se guarda para leer— y tambien mejora el
 * historial que ve el modelo, que pasa a leer "Si, eliminar" en vez de un
 * identificador opaco.
 */
export function commandTextLabel(text: string): string | null {
  const normalized = text.trim();

  if (normalized === "corr:cancel") return "No cambiar";
  if (normalized === "estr:cancel") return "No, cancelar";

  if (normalized.startsWith("estr:")) return "Si, confirmar";

  if (!normalized.startsWith("corr:")) return null;

  switch (normalized.split(":")[1]) {
    case "delete":
      return "Si, eliminar";
    case "amount":
      return "Si, cambiar el monto";
    case "category":
      return "Si, cambiar la categoria";
    case "acct_origin":
    case "acct_destination":
      return "Si, cambiar la cuenta";
    case "loan_to":
    case "loan_from":
      return "Si, cambiar el prestamo";
    default:
      return "Si, confirmar";
  }
}
