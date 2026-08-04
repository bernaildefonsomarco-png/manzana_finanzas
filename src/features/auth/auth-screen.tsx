"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/data/supabase/client";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { FieldShell, Input } from "@/ui/primitivas/field";
import { isKnownInternalRoute } from "@/shared/routing/known-routes";
import {
  mapAuthErrorCode,
  offlineAuthError,
  type MappedAuthError,
} from "@/core/auth/auth-error-mapping";

type AuthMode = "login" | "signup";

export function AuthScreen({
  initialMode = "login",
  redirectTo,
}: { initialMode?: AuthMode; redirectTo?: string } = {}) {
  const router = useRouter();
  // `10` §8 / `AC-NAV-07`: `redirigir` solo se sigue si es una ruta interna
  // conocida — nunca una URL externa, aunque venga de un enlace real.
  const safeRedirectTo =
    redirectTo && isKnownInternalRoute(redirectTo) ? redirectTo : "/inicio";
  // El modo lo decide la URL (`/entrar` o `/crear-cuenta`), no un estado
  // local: cambiar de pestaña navega de verdad (`AC-NAV-01`).
  const mode = initialMode;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<MappedAuthError | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // `43` §18: el foco entra en el error tras un envío fallido, para que
    // `aria-live="assertive"` lo anuncie y quien navega por teclado lo vea.
    if (error) errorRef.current?.focus();
  }, [error]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const allowed = await checkAuthAttempt(mode === "login" ? "sign_in" : "sign_up", email);
      if (!allowed.allowed) {
        setError(
          mapAuthErrorCode("over_request_rate_limit", {
            mode,
            retryAfterSeconds: allowed.retryAfterSeconds,
          }),
        );
        return;
      }

      const supabase = createClient();

      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        await recordClientAuthEvent();
        router.push(safeRedirectTo);
        router.refresh();
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName.trim() || null,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        await recordClientAuthEvent();
        router.push(safeRedirectTo);
        router.refresh();
        return;
      }

      setMessage(
        "Cuenta creada. Revisa tu correo para confirmar el acceso — puedes seguir usando Manzana mientras tanto."
      );
    } catch (thrown) {
      setError(toMappedAuthError(thrown, mode));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8 text-text">
      <div className="w-full max-w-[440px]">
        <section className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand font-heading text-lg font-semibold text-text-inverse shadow-sm">
            M
          </div>
          <p className="font-heading text-xl font-semibold text-brand">Manzana</p>
          <h1 className="mt-7 font-heading text-2xl font-semibold leading-tight tracking-normal text-text">
            Hola, bienvenido/a
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">
            Entra para revisar tu dinero con calma. Nada pendiente toca tus saldos
            sin tu confirmación.
          </p>
        </section>

        <Card elevated className="p-4 sm:p-5">
          <div className="flex rounded-lg bg-bg-surface p-1">
            <button
              type="button"
              className={tabClass(mode === "login")}
              aria-current={mode === "login" ? "page" : undefined}
              onClick={() => router.push("/entrar")}
            >
              Entrar
            </button>
            <button
              type="button"
              className={tabClass(mode === "signup")}
              aria-current={mode === "signup" ? "page" : undefined}
              onClick={() => router.push("/crear-cuenta")}
            >
              Crear cuenta
            </button>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            {mode === "signup" ? (
              <FieldShell label="Nombre" htmlFor="display-name">
                <Input
                  id="display-name"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Como quieres que te llame Manzana"
                />
              </FieldShell>
            ) : null}

            <FieldShell label="Correo" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value.trim().toLowerCase())}
                placeholder="tu@email.com"
                required
              />
            </FieldShell>

            <div className="space-y-2">
              <FieldShell label="Contraseña" htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  maxLength={200}
                  required
                />
              </FieldShell>
              {mode === "login" ? (
                <button
                  type="button"
                  className="text-sm font-medium text-text-brand hover:text-brand-hover"
                  onClick={() => router.push(email ? `/recuperar-clave?correo=${encodeURIComponent(email)}` : "/recuperar-clave")}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              ) : null}
            </div>

            {error ? (
              <div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                aria-live="assertive"
                className="space-y-2 rounded-md border border-error-subtle bg-error-subtle px-3 py-2 text-sm text-error outline-none"
              >
                <p>{error.message}</p>
                {error.actions.includes("reenviar") ? (
                  <button
                    type="button"
                    className="font-medium underline"
                    onClick={() => router.push(`/verificar?correo=${encodeURIComponent(email)}`)}
                  >
                    Reenviar verificación
                  </button>
                ) : null}
              </div>
            ) : null}

            {message ? (
              <p role="status" className="rounded-md border border-success-subtle bg-success-subtle px-3 py-2 text-sm text-success">
                {message}
              </p>
            ) : null}

            <Button className="w-full" type="submit" loading={loading}>
              {mode === "login" ? "Entrar a Manzana" : "Crear cuenta"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}

function tabClass(active: boolean) {
  return [
    "h-10 flex-1 rounded-md text-sm font-medium transition",
    active
      ? "bg-bg-surface-raised text-text shadow-xs"
      : "text-text-secondary hover:text-text",
  ].join(" ");
}

async function checkAuthAttempt(
  kind: "sign_in" | "sign_up",
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
    // El límite de intentos es protección contra abuso, no un gate de
    // seguridad (`RUL-AUTH-06`): si el chequeo mismo falla, no se bloquea.
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

async function recordClientAuthEvent(): Promise<void> {
  try {
    await fetch("/api/v1/auth/events", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "creada" }),
    });
  } catch {
    // Auditoría best-effort: no debe impedir que la sesión ya iniciada
    // navegue (`43` §15, no es memoria ni gobierna ningún comportamiento).
  }
}

function toMappedAuthError(thrown: unknown, mode: AuthMode): MappedAuthError {
  if (!navigator.onLine) return offlineAuthError();
  const code =
    thrown && typeof thrown === "object" && "code" in thrown
      ? String((thrown as { code?: unknown }).code)
      : undefined;
  return mapAuthErrorCode(code, { mode });
}
