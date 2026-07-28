// Proyecto separado para los cuatro `*.api-smoke.test.ts` (`WEB-D158`,
// `AC-PRUEBA-07`): consumen una API de pago real. No viven en `npm test`;
// viven en `npm run test:smoke:agents` o en su script individual. El gate
// `RUN_*_SMOKE` dentro de cada fichero sigue existiendo como salvaguarda de
// coste, no como el mecanismo de separación — eso ya lo hace este proyecto.
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.api-smoke.test.ts"],
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
