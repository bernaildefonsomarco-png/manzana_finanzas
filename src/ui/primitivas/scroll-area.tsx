import type { HTMLAttributes } from "react";
import { cn } from "./cn";

/** Contenedor con scroll propio, sin ocultar la barra en escritorio (a
 * diferencia de `.no-scrollbar`, que es para chips horizontales — aquí el
 * contenido puede exceder la altura y el usuario necesita ver que hay
 * más). Mantiene el desplazamiento por teclado nativo. */
export function ScrollArea({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      tabIndex={0}
      className={cn(
        "overflow-auto focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus",
        className
      )}
      {...props}
    />
  );
}
