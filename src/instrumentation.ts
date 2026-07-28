// Gate de arranque para `AC-RT-01` y `AC-REU-06` (ver `instrumentation-check.ts`).
//
// `register()` se ejecuta una sola vez al iniciar el servidor y debe
// completar antes de que atienda peticiones (convención de Next.js 16,
// `node_modules/next/dist/docs/.../instrumentation.md`). La lógica que usa
// `process.exit` vive en `instrumentation.node.ts`, importada solo de forma
// dinámica: mantenerla aquí arriba hace que Next la marque como
// incompatible con el runtime Edge, aunque el guard de abajo garantice que
// nunca se alcanza ahí.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ejecutarGateDeArranque } = await import("./instrumentation.node");
  ejecutarGateDeArranque();
}
