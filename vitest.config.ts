import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const alias = { "@": path.resolve(__dirname, "./src") };

// tests/rls/ necesita una base de datos real, *.api-smoke.test.ts necesita
// una API de pago real, y tests/e2e/*.spec.ts son de Playwright, no de
// Vitest (su `test` no es compatible): los tres viven fuera de la suite por
// defecto (WEB-D158, AC-PRUEBA-07, AC-PRUEBA-09, AC-PRUEBA-10).
const EXCLUDE_COMUN = [
  "**/node_modules/**",
  "**/.next/**",
  "tests/rls/**",
  "tests/e2e/**",
  "**/*.api-smoke.test.ts",
];

// Los ficheros que importan React Testing Library necesitan un DOM real:
// las pantallas de src/features/, el catálogo de primitivas de src/ui/
// (16 §10), el proveedor único de modo discreto/tema de src/shared/privacy/
// y, desde W-07, los patrones compartidos de obtención de datos y
// formularios de src/shared/data/ y src/shared/forms/ (montan componentes de
// prueba con hooks de React). El resto (core/, agents/, data/, workers/,
// tests/lint, tests/corpus) prueba lógica pura. Separar los dos en
// proyectos evita pagar el arranque de jsdom en los ficheros que no lo
// necesitan — es la mayor parte de los 254s originales (`51` §11.1) — y
// deja `npm test` por debajo de 120s (`AC-PRUEBA-11`).
const PATRON_DOM = [
  "src/features/**/*.test.tsx",
  "src/ui/**/*.test.tsx",
  "src/shared/privacy/**/*.test.tsx",
  "src/shared/data/**/*.test.tsx",
  "src/shared/forms/**/*.test.tsx",
  // `W-17`: el asistente vive fuera de `features/` (`WEB-D164`) pero sus
  // componentes montan hooks de React igual que los de arriba. `*` en vez
  // de `(app)` literal: los parentesis son sintaxis de extglob para el
  // matcher de globs y un `(app)` sin escapar nunca hace match.
  "src/app/*/asistente/**/*.test.tsx",
];

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**"],
      exclude: ["src/**/*.test.*", "src/test/**"],
    },
    projects: [
      {
        plugins: [react()],
        test: {
          name: "unidad",
          environment: "node",
          globals: true,
          include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
          exclude: [...EXCLUDE_COMUN, ...PATRON_DOM],
        },
        resolve: { alias },
      },
      {
        plugins: [react()],
        test: {
          name: "dom",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
          include: PATRON_DOM,
          exclude: EXCLUDE_COMUN,
        },
        resolve: { alias },
      },
    ],
  },
  resolve: { alias },
});
