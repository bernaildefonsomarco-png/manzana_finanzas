"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider as TanstackQueryClientProvider,
} from "@tanstack/react-query";

/**
 * Proveedor único de caché de servidor para toda la app (`12` §7, `17` §2).
 * `staleTime` no es cero: recargar el listado completo tras cada mutación
 * está prohibido (`17` §2.1 regla 5), y una caché que se considera obsoleta
 * al instante fuerza justo esa recarga. Se invalida por clave con
 * `invalidateForMutation`, no por tiempo.
 */
export function QueryClientProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <TanstackQueryClientProvider client={queryClient}>{children}</TanstackQueryClientProvider>
  );
}
