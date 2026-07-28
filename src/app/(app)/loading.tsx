import { SkeletonCard } from "@/ui/primitivas/states";

// Esqueleto genérico de sección (`10` §7, `12` §9): cada segmento puede
// reemplazarlo por uno con la forma real de su contenido; este es el que
// hereda cualquier ruta de `(app)` que no declare el suyo.
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6" aria-busy="true">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
