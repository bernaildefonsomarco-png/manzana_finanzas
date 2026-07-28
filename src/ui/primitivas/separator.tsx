import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type SeparatorProps = HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
  /** Puramente visual (la mayoría de los casos): sin rol semántico,
   * `aria-hidden`. Cuando además separa secciones de contenido con
   * significado propio, pasar `decorative={false}` para exponer
   * `role="separator"`. */
  decorative?: boolean;
};

export function Separator({
  orientation = "horizontal",
  decorative = true,
  className,
  ...props
}: SeparatorProps) {
  return (
    <div
      role={decorative ? undefined : "separator"}
      aria-hidden={decorative || undefined}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
      {...props}
    />
  );
}
