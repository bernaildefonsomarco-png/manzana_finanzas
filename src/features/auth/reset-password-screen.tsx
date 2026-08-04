"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/data/supabase/client";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { FieldShell, Input } from "@/ui/primitivas/field";
import {
  mapAuthErrorCode,
  offlineAuthError,
  type MappedAuthError,
} from "@/core/auth/auth-error-mapping";

// `43` `SCR-AUTH-05` — llega aquí con sesión de recuperación ya establecida
// por `/auth/callback` (intercambio en servidor). `RUL-AUTH-07`: cambiar o
// recuperar la contraseña cierra las demás sesiones, y se dice.
export function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<MappedAuthError | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError({
        id: "ERR-AUTH-04",
        message: "Las dos contraseñas no coinciden.",
        actions: ["corregir"],
      });
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // `RUL-AUTH-07`: cierra las demás sesiones, nunca la actual.
      await supabase.auth.signOut({ scope: "others" });
      await fetch("/api/v1/auth/events", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "clave_recuperada" }),
      }).catch(() => undefined);

      setDone(true);
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

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8">
        <Card elevated className="w-full max-w-[440px] p-5 text-center">
          <p role="status" className="text-sm leading-6 text-text">
            Contraseña cambiada. Cerré las sesiones abiertas en otros dispositivos.
          </p>
          <Button className="mt-4 w-full" onClick={() => router.push("/inicio")}>
            Ir a Manzana
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8">
      <div className="w-full max-w-[440px]">
        <section className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-semibold text-text">Define tu contraseña nueva</h1>
        </section>
        <Card elevated className="p-4 sm:p-5">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <FieldShell label="Contraseña nueva" htmlFor="new-password">
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={200}
                required
              />
            </FieldShell>
            <FieldShell label="Repite la contraseña" htmlFor="confirm-password">
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                maxLength={200}
                required
              />
            </FieldShell>

            {error ? (
              <p role="alert" aria-live="assertive" className="rounded-md border border-error-subtle bg-error-subtle px-3 py-2 text-sm text-error">
                {error.message}
              </p>
            ) : null}

            <Button className="w-full" type="submit" loading={loading}>
              Guardar contraseña nueva
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
