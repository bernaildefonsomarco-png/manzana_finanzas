// Los cuatro asertos de `51` §8 (`WEB-D156`), genéricos por tabla.

import type { SupabaseClient } from "@supabase/supabase-js";
import { expect } from "vitest";

/**
 * 1. El usuario que NO es dueño no lee la fila → cero filas, no un error.
 * 3. El usuario que NO es dueño no la actualiza → cero filas afectadas.
 * 2. El usuario que NO es dueño no puede crear una fila con `user_id` ajeno.
 *
 * `clienteIntruso` es el cliente autenticado de alguien que no es dueño de
 * `filaId`; `filaDueñoId` es el `user_id` real de la fila (para el intento
 * de inserción con `user_id` falsificado).
 */
export async function verificarAislamientoDeTabla(params: {
  tabla: string;
  clienteIntruso: SupabaseClient;
  filaId: string;
  filaDueñoId: string;
  filaParaInsertarFalsificada?: Record<string, unknown>;
}): Promise<void> {
  const { tabla, clienteIntruso, filaId, filaDueñoId, filaParaInsertarFalsificada } = params;

  // 1. Lectura: cero filas, no error.
  const lectura = await clienteIntruso.from(tabla).select("*").eq("id", filaId);
  expect(lectura.error, `${tabla}: la lectura de un intruso no debería dar error`).toBeNull();
  expect(lectura.data?.length ?? -1, `${tabla}: el intruso no debería ver la fila`).toBe(0);

  // 3. Actualización: cero filas afectadas — por RLS (filtrada en silencio)
  // o por ausencia de GRANT UPDATE a authenticated (rechazo directo). Las
  // dos son formas válidas de la misma garantía; solo es un fallo si la
  // actualización de verdad afectó una fila.
  const actualizacion = await clienteIntruso
    .from(tabla)
    .update({ metadata: { intento_de_intrusion: true } })
    .eq("id", filaId)
    .select("id");
  if (!actualizacion.error) {
    expect(actualizacion.data?.length ?? -1, `${tabla}: el intruso no debería poder actualizar la fila`).toBe(0);
  }

  // 2. Escritura con user_id ajeno (falsificado): rechazo.
  if (filaParaInsertarFalsificada) {
    const insercion = await clienteIntruso
      .from(tabla)
      .insert({ ...filaParaInsertarFalsificada, user_id: filaDueñoId });
    expect(insercion.error, `${tabla}: insertar con user_id ajeno debería rechazarse`).not.toBeNull();
  }
}

/** 4 (`AC-SEG-03`): el rol `authenticated` no puede insertar la fila en absoluto. */
export async function verificarEscrituraDirectaBloqueada(params: {
  tabla: string;
  cliente: SupabaseClient;
  fila: Record<string, unknown>;
}): Promise<void> {
  const { tabla, cliente, fila } = params;
  const resultado = await cliente.from(tabla).insert(fila);
  expect(resultado.error, `${tabla}: el rol authenticated no debería poder insertar directamente`).not.toBeNull();
}
