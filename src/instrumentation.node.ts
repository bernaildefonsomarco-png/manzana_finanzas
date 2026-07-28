// La mitad de `instrumentation.ts` que solo existe en el runtime Node
// (`process.exit`). Separada a su propio fichero e importada solo de forma
// dinámica desde `register()` — si `process.exit` queda en el fichero
// `instrumentation.ts` de nivel superior, el analizador de compatibilidad
// de Next.js lo marca como incompatible con el runtime Edge aunque nunca se
// alcance ahí en tiempo de ejecución (medido: el aviso aparece en
// `next build` y en `next dev` con el guard `NEXT_RUNTIME` puesto). Este
// patrón —módulo Node aparte, importado dinámicamente— es el que
// `node_modules/next/dist/docs/.../instrumentation.md` documenta para este
// caso exacto.

import { verificarArranqueSeguro } from "@/instrumentation-check";

export function ejecutarGateDeArranque(): void {
  try {
    verificarArranqueSeguro();
  } catch (error) {
    // Medido en `next start` real (LIVE, W-02): lanzar aquí no evita que el
    // proceso siga vivo — Next.js ya ha enlazado el puerto y cada petición
    // responde 500, pero el proceso no termina por sí solo. Para que "no
    // arranca" sea literal y no solo "todo falla", se fuerza la salida.
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
