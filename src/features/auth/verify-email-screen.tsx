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

// `43` `SCR-AUTH-03` — `RUL-AUTH-03`: la cuenta se puede usar sin verificar,
// así que esta pantalla no bloquea nada; solo reenvía el enlace.
export function VerifyEmailScreen({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<MappedAuthError | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const attempt = await checkAuthAttempt(email);
      if (!attempt.allowed) {
        setError(
          mapAuthErrorCode("over_request_rate_limit", {
            mode: "resend",
            retryAfterSeconds: attempt.retryAfterSeconds,
          }),
        );
        return;
      }

      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
      if (resendError) throw resendError;
      setSent(true);
    } catch (thrown) {
      const code =
        thrown && typeof thrown === "object" && "code" in thrown
          ? String((thrown as { code?: unknown }).code)
          : undefined;
      setError(!navigator.onLine ? offlineAuthError() : mapAuthErrorCode(code, { mode: "resend" }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8">
      <div className="w-full max-w-[440px]">
        <section className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-semibold text-text">Confirma tu correo</h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Puedes seguir usando Manzana mientras tanto. Solo hace falta confirmar tu correo
            para conectar un buzón o recibir recordatorios.
          </p>
        </section>

        <Card elevated className="p-4 sm:p-5">
          {sent ? (
            <div role="status" className="space-y-4 text-center">
              <p className="text-sm leading-6 text-text">
                Te mandé el enlace de confirmación. Revisa tu bandeja y el spam.
              </p>
              <Link
                href="/inicio"
                className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-bg-surface-raised px-5 text-sm font-medium text-text hover:bg-bg-surface"
              >
                Ir a Manzana
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <FieldShell label="Correo" htmlFor="verify-email">
                <Input
                  id="verify-email"
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
                Reenviar confirmación
              </Button>
              <Link href="/inicio" className="block text-center text-sm font-medium text-text-brand hover:text-brand-hover">
                Ir a Manzana
              </Link>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}

async function checkAuthAttempt(
  email: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  try {
    const response = await fetch("/api/v1/auth/attempt", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "resend_verification", email }),
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
