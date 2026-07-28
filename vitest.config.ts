import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    // tests/rls/ necesita una base de datos real: vive en su propio proyecto
    // de Vitest (npm run test:rls), nunca en la suite por defecto (WEB-D158,
    // AC-PRUEBA-10).
    exclude: ["**/node_modules/**", "**/.next/**", "tests/rls/**"],
    coverage: {
      reporter: ["text", "json-summary"],
      include: ["src/core/**", "src/shared/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
