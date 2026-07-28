"use client";

import { useForm, type FieldValues, type UseFormProps } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType, z } from "zod";

/**
 * Envoltorio único de formularios para toda la app (`12` §2, `17` §5): un
 * esquema Zod compartido con el servidor, validación al salir del campo
 * (`mode: "onBlur"`, `17` §5.1 regla 3, no en cada tecla) y errores que se
 * limpian al corregir (`reValidateMode: "onChange"`, regla implícita en la
 * misma sección).
 *
 * Los `as never`/`as unknown` internos existen porque los tipos de
 * `@hookform/resolvers/zod` fijan el `input` del esquema a `FieldValues`, y
 * un `ZodType<T>` genérico no lo declara así — es una limitación de los
 * tipos de la librería, no del esquema en sí; el `resolver` sigue validando
 * en tiempo de ejecución con el esquema real que se le pasa, verificado por
 * `use-zod-form.test.tsx`.
 */
export function useZodForm<TSchema extends ZodType>(
  schema: TSchema,
  options?: Omit<UseFormProps<z.infer<TSchema> & FieldValues>, "resolver">
) {
  return useForm<z.infer<TSchema> & FieldValues>({
    mode: "onBlur",
    reValidateMode: "onChange",
    ...options,
    resolver: zodResolver(schema as never) as unknown as UseFormProps<
      z.infer<TSchema> & FieldValues
    >["resolver"],
  });
}
