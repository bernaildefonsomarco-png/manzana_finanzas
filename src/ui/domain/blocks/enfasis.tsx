import type { ReactNode } from "react";

/**
 * El modelo marca enfasis con asteriscos —`**asi**` en markdown, `*asi*` al
 * estilo del canal de mensajeria— y WhatsApp los normaliza en su propio
 * adaptador (`normalizeWhatsAppFormatting`). La web no tenia equivalente, asi
 * que los mostraba crudos: el usuario leia `Una **meta** es un objetivo` y
 * `cree la caja *Carro*`.
 *
 * Se resuelve en la capa de presentacion, que es de quien es el problema: el
 * bloque `texto` sigue siendo texto y cada canal decide como se ve. No se
 * interpreta markdown completo —ni enlaces, ni codigo, ni listas— porque el
 * vocabulario de bloques (`21` §5) ya es la estructura de la respuesta; esto
 * solo cubre el enfasis, que es lo unico que el modelo emite en linea.
 *
 * Sin `dangerouslySetInnerHTML`: se construyen nodos, asi que un texto con
 * forma de etiqueta nunca se interpreta como marcado.
 */
const ENFASIS = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;

export function conEnfasis(text: string): ReactNode {
  const partes = text.split(ENFASIS);
  if (partes.length === 1) return text;

  return partes.map((parte, indice) => {
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      return <strong key={indice}>{parte.slice(2, -2)}</strong>;
    }
    if (parte.startsWith("*") && parte.endsWith("*") && parte.length > 2) {
      return <strong key={indice}>{parte.slice(1, -1)}</strong>;
    }
    return parte;
  });
}
