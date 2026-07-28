import type { HTMLAttributes } from "react";

/** Contenido presente para lectores de pantalla pero invisible en
 * pantalla — nunca `display:none` (`16` §4.2). */
export function VisuallyHidden(props: HTMLAttributes<HTMLSpanElement>) {
  return <span className="sr-only" {...props} />;
}
