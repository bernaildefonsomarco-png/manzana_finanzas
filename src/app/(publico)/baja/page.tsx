import { Card } from "@/ui/primitivas/card";
import { UnsubscribeAllButton } from "@/features/email-outbox/unsubscribe-all-button";
import { verifyUnsubscribeToken } from "@/core/email-outbox/unsubscribe-token";
import { REMINDER_LABELS } from "@/core/email-outbox/reminder-labels";
import { getReminderPreferences, setReminderPreference } from "@/data/repositories/reminders.repository";
import { createServiceClient } from "@/data/supabase/server";
import { REMINDER_KINDS, type ReminderKind } from "@/shared/types/domain";

// `46` `SCR-MAIL-02`/`RUL-MAIL-04` — baja en un clic, sin sesión. El token
// firmado (`src/core/email-outbox/unsubscribe-token.ts`) es lo único que
// autoriza esta escritura sin `getApiAuth`: solo puede dar de baja, nunca
// dar acceso a nada más (`46` §8).
export default async function BajaPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  if (!t) return <BajaError message="Ese enlace no es válido." />;

  const verified = verifyUnsubscribeToken(t);
  if (!verified.ok) {
    return (
      <BajaError
        message={
          verified.reason === "caducado"
            ? "Ese enlace ya caducó, pero puedes cambiarlo desde tu cuenta."
            : "Ese enlace no es válido."
        }
      />
    );
  }

  const { userId, type } = verified.payload;
  const client = createServiceClient();

  if (type !== "__all__") {
    await setReminderPreference(client, userId, {
      nudgeType: type as ReminderKind,
      channel: "email",
      enabled: false,
    });
  }

  const preferences = await getReminderPreferences(client, userId, [...REMINDER_KINDS]);
  const stillActive = preferences.filter((p) => p.channel === "email" && p.enabled);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8">
      <Card elevated className="w-full max-w-[480px] p-6">
        <p role="status" className="text-sm leading-6 text-text">
          {type === "__all__"
            ? "Ya no recibirás ningún aviso por correo."
            : `Listo. Dejaré de escribirte de "${REMINDER_LABELS[type as ReminderKind] ?? type}".`}
        </p>

        {type !== "__all__" ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-text">Sigues recibiendo:</p>
            {stillActive.length === 0 ? (
              <p className="mt-1 text-sm text-text-secondary">Nada más, por ahora.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                {stillActive.map((p) => (
                  <li key={p.nudge_type}>{REMINDER_LABELS[p.nudge_type as ReminderKind] ?? p.nudge_type}</li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <UnsubscribeAllButton token={t} />
            </div>
          </div>
        ) : null}
      </Card>
    </main>
  );
}

function BajaError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8">
      <Card elevated className="w-full max-w-[440px] p-6 text-center">
        <p role="alert" className="text-sm text-error">
          {message}
        </p>
      </Card>
    </main>
  );
}
