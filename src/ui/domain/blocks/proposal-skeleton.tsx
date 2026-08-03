import { Card } from "@/ui/primitivas/card";

/**
 * `RUL-ASI-13`: no se inventa contenido mientras `propuesta`/
 * `previsualizacion` esperan su pending item correlacionado.
 */
export function ProposalSkeleton({ title }: { title: string }) {
  return (
    <Card className="space-y-3 p-5" aria-busy="true">
      <p className="text-sm text-text">{title}</p>
      <div className="h-4 w-full animate-pulse rounded-sm bg-bg-surface" />
      <div className="h-4 w-2/3 animate-pulse rounded-sm bg-bg-surface" />
    </Card>
  );
}
