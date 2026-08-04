"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/data/supabase/client";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { FieldShell, Input } from "@/ui/primitivas/field";
import {
  mapAuthErrorCode,
  offlineAuthError,
  type MappedAuthError,
} from "@/core/auth/auth-error-mapping";

// `43` `SCR-AUTH-04` — `RUL-AUTH-01`: nunca se revela si el correo tiene
// cuenta. La respuesta de éxito es siempre el mismo texto, exista o no la
// cuenta (`AC-AUTH-04`) — `resetPasswordForEmail` de Supabase ya no
// distingue por diseño, así que basta con no introducir esa distinción
// aquí encima.
export function RecoverPasswordScreen({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<MappedAuthError | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const attempt = await checkAuthAttempt("password_reset", email);
      if (!attempt.allowed) {
        setError(
          mapAuthErrorCode("over_request_rate_limit", {
            mode: "recovery",
            retryAfterSeconds: attempt.retryAfterSeconds,
          }),
        );
        return;
      }

      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=%2Frestablecer-clave`,
      });

      // Supabase nunca devuelve "ese correo no existe" para este endpoint
      // — es la mitad de `RUL-AUTH-01` que el proveedor ya cumple. Un error
      // aquí es un problema real (límite, red, servicio), y sí se muestra;
      // no distingue cuentas, así que mostrarlo no viola la regla.
      if (resetError) throw resetError;
      setSent(true);
    } catch (thrown) {
      const code =
        thrown && typeof thrown === "object" && "code" in thrown
          ? String((thrown as { code?: unknown }).code)
          : undefined;
      setError(!navigator.onLine ? offlineAuthError() : mapAuthErrorCode(code, { mode: "recovery" }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8">
      <div className="w-full max-w-[440px]">
        <section className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-semibold text-text">Recuperar tu contraseña</h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Escribe tu correo y te mando un enlace para elegir una contraseña nueva.
          </p>
        </section>

        <Card elevated className="p-4 sm:p-5">
          {sent ? (
            <div role="status" className="space-y-4 text-center">
              <p className="text-sm leading-6 text-text">
                Si ese correo tiene una cuenta, te mandé el enlace. Revisa tu bandeja y el spam.
              </p>
              <Link
                href="/entrar"
                className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-bg-surface-raised px-5 text-sm font-medium text-text hover:bg-bg-surface"
              >
                Volver a entrar
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <FieldShell label="Correo" htmlFor="recover-email">
                <Input
                  id="recover-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value.trim().toLowerCase())}
                  required
                />
              </FieldShell>

              {error ? (
                <p role="alert" aria-live="assertive" className="rounded-md border border-error-subtle bg-error-subtle px-3 py-2 text-sm text-error">
                  {error.message}
                </p>
              ) : null}

              <Button className="w-full" type="submit" loading={loading}>
                Mandar enlace
              </Button>
              <Link href="/entrar" className="block text-center text-sm font-medium text-text-brand hover:text-brand-hover">
                Volver a entrar
              </Link>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}

async function checkAuthAttempt(
  kind: "password_reset",
  email: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  try {
    const response = await fetch("/api/v1/auth/attempt", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, email }),
    });
    const payload = (await response.json()) as {
      ok: boolean;
      data?: { allowed: boolean; retry_after_seconds: number };
    };
    if (!payload.ok || !payload.data) return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: payload.data.allowed, retryAfterSeconds: payload.data.retry_after_seconds };
  } catch {
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
