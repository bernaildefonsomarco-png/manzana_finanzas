"use client";

import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { invalidateForMutation, type MutationType } from "./invalidation";

type OptimisticMutationConfig<TVariables, TData> = {
  mutationFn: (variables: TVariables) => Promise<TData>;
  mutation: MutationType;
  mutationParams?: (variables: TVariables) => { debtId?: string } | undefined;
  /** Aplica el cambio optimista a la caché y devuelve cómo revertirlo. */
  applyOptimistic?: (queryClient: QueryClient, variables: TVariables) => (() => void) | void;
};

/**
 * Secuencia estándar de `17` §3: aplicar de forma optimista, enviar, y al
 * terminar **reconciliar con la respuesta real** (nunca antes) o revertir.
 * Solo tras `onSuccess` la mutación queda `isSuccess`, así que un texto
 * condicionado a `mutation.isSuccess` no puede decir "Registrado" antes de
 * que el Core confirme (`AC-EXP-06`). Solo invalida las claves de su fila en
 * `17` §2.3, nunca la caché completa (`AC-ARQ-06`, `AC-PAT-02`).
 */
export function useOptimisticMutation<TVariables, TData>(
  config: OptimisticMutationConfig<TVariables, TData>
): UseMutationResult<TData, unknown, TVariables, { rollback?: () => void }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: config.mutationFn,
    onMutate: async (variables) => {
      const rollback = config.applyOptimistic?.(queryClient, variables) ?? undefined;
      return { rollback };
    },
    onError: (_error, _variables, context) => {
      context?.rollback?.();
    },
    onSuccess: async (_data, variables) => {
      await invalidateForMutation(queryClient, config.mutation, config.mutationParams?.(variables));
    },
  });
}
