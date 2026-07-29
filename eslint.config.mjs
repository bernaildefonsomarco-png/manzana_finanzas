import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `const { omitir, ...resto } = obj` es la forma idiomatica de quitar una
      // propiedad: la variable se declara precisamente para no usarla.
      // Y un argumento con prefijo `_` es una firma que hay que respetar.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Estado en tiempo de ejecucion del CLI de Supabase local (secretos y
    // artefactos regenerados por `supabase start`/`db reset`), no codigo
    // fuente — nunca debe entrar al lint.
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
