// Proyecto separado para las pruebas de aislamiento RLS (`WEB-D158`,
// `51` §10). Necesitan una base de datos real (el stack local de Supabase)
// y por eso no viven en `npm test`: viven en `npm run test:rls`.
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/rls/**/*.{test,spec}.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
