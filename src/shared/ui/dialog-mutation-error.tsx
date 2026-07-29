import { ApiClientError } from "@/shared/api/http-client";

/** Mensaje de error de mutacion, repetido en todos los dialogos con formulario. */
export function DialogMutationError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-error">
      {error instanceof ApiClientError
        ? error.message
        : "No pude completar la accion. Intenta otra vez en un momento."}
    </p>
  );
}
