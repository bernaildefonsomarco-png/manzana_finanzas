// Entorno de las pruebas de aislamiento RLS (`WEB-D156`, `51` §8).
//
// Contra una base de datos de prueba real — el stack local de Supabase
// (`supabase start`), nunca contra producción. Las claves de aquí abajo son
// las claves de demostración fijas que el CLI de Supabase usa para *todo*
// proyecto local: no son secretas, no sirven fuera de `127.0.0.1`, y están
// documentadas públicamente por Supabase. Se pueden sobreescribir por
// variable de entorno si el runner de CI expone otras.

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const RLS_API_URL = process.env.RLS_TEST_SUPABASE_URL ?? "http://127.0.0.1:55321";
const RLS_ANON_KEY =
  process.env.RLS_TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const RLS_SERVICE_ROLE_KEY =
  process.env.RLS_TEST_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const RUN_ID = `rls_${Date.now()}_${randomUUID().slice(0, 8)}`;
const PASSWORD = "Rls-Test-2026!Aa";

export const admin: SupabaseClient = createClient(RLS_API_URL, RLS_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface UsuarioDePrueba {
  id: string;
  email: string;
  client: SupabaseClient;
}

const usuariosCreados: string[] = [];

/** Crea un usuario confirmado y devuelve un cliente autenticado como él. */
export async function crearUsuarioDePrueba(sufijo: string): Promise<UsuarioDePrueba> {
  const email = `${RUN_ID}-${sufijo}@manzana.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`No pude crear el usuario de prueba ${sufijo}: ${error?.message}`);
  }
  usuariosCreados.push(data.user.id);

  const client = createClient(RLS_API_URL, RLS_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) {
    throw new Error(`No pude iniciar sesión como ${sufijo}: ${signInError.message}`);
  }

  return { id: data.user.id, email, client };
}

/** Borra los usuarios creados en esta ejecución (cascada limpia sus filas por FK). */
export async function limpiarUsuariosDePrueba(): Promise<void> {
  for (const id of usuariosCreados.splice(0)) {
    await admin.auth.admin.deleteUser(id).catch(() => {
      // Best-effort: si ya no existe, no hay nada que limpiar.
    });
  }
}

export { RUN_ID };
