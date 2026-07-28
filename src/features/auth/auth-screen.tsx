"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, MessageCircle, Sparkles } from "lucide-react";
import { createClient } from "@/data/supabase/client";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { FieldShell, Input } from "@/ui/primitivas/field";

type AuthMode = "login" | "signup";

export function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName.trim() || null,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        router.refresh();
        return;
      }

      setMessage(
        "Cuenta creada. Revisa tu correo para confirmar el acceso si Supabase lo solicita."
      );
    } catch (error) {
      setError(toAuthErrorMessage(error, mode));
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
              onClick={() => setMode("login")}
            >
              Entrar
            </button>
            <button
              type="button"
              className={tabClass(mode === "signup")}
              onClick={() => setMode("signup")}
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
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                required
              />
            </FieldShell>

            <FieldShell label="Contraseña" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </FieldShell>

            {error ? (
              <p className="rounded-md border border-error-subtle bg-error-subtle px-3 py-2 text-sm text-error">
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="rounded-md border border-success-subtle bg-success-subtle px-3 py-2 text-sm text-success">
                {message}
              </p>
            ) : null}

            <Button className="w-full" type="submit" loading={loading}>
              {mode === "login" ? "Entrar a Manzana" : "Crear cuenta"}
            </Button>
          </form>
        </Card>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <TrustPill icon={<MessageCircle className="h-4 w-4" />} text="WhatsApp primero" />
          <TrustPill icon={<LockKeyhole className="h-4 w-4" />} text="Sesión protegida" />
          <TrustPill icon={<Sparkles className="h-4 w-4" />} text="Core financiero" />
        </div>

        <p className="mx-auto mt-6 max-w-xs text-center text-xs leading-5 text-text-muted">
          Acceso privado para construir tu V1. Las integraciones finales se activan por corte.
        </p>
      </div>
    </main>
  );
}

function TrustPill({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-bg-surface-raised px-3 py-2 text-sm leading-tight text-text-secondary shadow-xs">
      <span className="text-text-brand">{icon}</span>
      <span>{text}</span>
    </div>
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

export function toAuthErrorMessage(
  error: unknown,
  mode: AuthMode,
): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : "";
  if (
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  ) {
    return "El correo o la contraseña no coinciden. Revísalos o crea una cuenta si aún no tienes una.";
  }
  if (message.includes("email not confirmed")) {
    return "Aún falta confirmar tu correo. Revisa tu bandeja y vuelve a intentarlo.";
  }
  if (
    message.includes("user already registered") ||
    message.includes("already been registered")
  ) {
    return "Ese correo ya tiene una cuenta. Prueba entrar con tu contraseña.";
  }
  if (message.includes("password") && message.includes("weak")) {
    return "Elige una contraseña más segura, de al menos 8 caracteres.";
  }
  if (
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return "Hubo demasiados intentos seguidos. Espera un momento y prueba otra vez.";
  }
  return mode === "login"
    ? "No pude iniciar sesión ahora. Tus datos están a salvo; inténtalo nuevamente."
    : "No pude crear la cuenta ahora. Inténtalo nuevamente.";
}
