"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Brain,
  Check,
  Clock3,
  Download,
  EyeOff,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { useDiscreetMode } from "@/shared/privacy/discreet-mode-context";
import { ApiClientError } from "@/features/movements/movements-api";
import { Button } from "@/ui/primitivas/button";
import { FieldShell, Input } from "@/ui/primitivas/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { Switch } from "@/ui/primitivas/switch";
import type { Profile } from "@/shared/types/domain";
import {
  disconnectGmail,
  deleteGmailInstitutionSource,
  deleteUserAccount,
  downloadUserDataExport,
  getDashboardNudgePreferences,
  getGmailHistory,
  getGmailStatus,
  getLearningSnapshot,
  getProfileSettings,
  getWhatsAppNudgeConsent,
  startGmailOAuth,
  upsertGmailInstitutionSource,
  updateDashboardNudgePreference,
  updateGmailAiExtractionConsent,
  updateLearningPreferences,
  updateProfileSettings,
  updateWhatsAppNudgeConsent,
  manageLearningCandidate,
  manageLearningMemory,
  type DashboardNudgePreference,
  type DashboardNudgePreferenceType,
  type GmailStatus,
  type GmailHistoryItem,
  type GmailInstitutionSource,
  type LearningSnapshot,
  type WhatsAppNudgeConsent,
} from "./settings-api";

type SettingsScreenProps = {
  onSignOut?: () => void;
  onNavigate?: (view: AppView) => void;
};

type LoadState = "loading" | "ready" | "error";

export function SettingsScreen({ onSignOut, onNavigate }: SettingsScreenProps) {
  const {
    preferences: experiencePreferences,
    saving: savingExperience,
    updatePreferences: saveExperiencePreferences,
  } = useDiscreetMode();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nudgePreferences, setNudgePreferences] = useState<
    DashboardNudgePreference[]
  >([]);
  const [whatsappNudges, setWhatsappNudges] =
    useState<WhatsAppNudgeConsent | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [gmailHistory, setGmailHistory] = useState<GmailHistoryItem[]>([]);
  const [learning, setLearning] = useState<LearningSnapshot | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [savingNudgeType, setSavingNudgeType] =
    useState<DashboardNudgePreferenceType | null>(null);
  const [savingWhatsappNudges, setSavingWhatsappNudges] = useState(false);
  const [gmailWorking, setGmailWorking] = useState(false);
  const [learningWorking, setLearningWorking] = useState<string | null>(null);
  const [memoryCorrection, setMemoryCorrection] = useState<{
    id: string;
    summary: string;
  } | null>(null);
  const [gmailDisconnectConfirming, setGmailDisconnectConfirming] =
    useState<string | null>(null);
  const [emailSourceForm, setEmailSourceForm] = useState<{
    sourceId: string | null;
    institutionKey: string;
    connectionId: string;
    notificationSender: string;
  } | null>(null);
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoadState("loading");
      setError(null);

      try {
        const [nextProfile, nextNudgePreferences, nextWhatsappNudges, nextGmailStatus, nextGmailHistory, nextLearning] =
          await Promise.all([
            getProfileSettings(),
            getDashboardNudgePreferences(),
            getWhatsAppNudgeConsent(),
            getGmailStatus(),
            getGmailHistory().catch(() => []),
            getLearningSnapshot(),
          ]);
        if (!active) return;
        setProfile(nextProfile);
        setNudgePreferences(nextNudgePreferences);
        setWhatsappNudges(nextWhatsappNudges);
        setGmailStatus(nextGmailStatus);
        setGmailHistory(nextGmailHistory);
        setLearning(nextLearning);
        setPhone(nextProfile.phone_e164 ?? "");
        setDisplayName(nextProfile.display_name ?? "");
        setLoadState("ready");
        const emailResult = new URLSearchParams(window.location.search).get("email");
        if (emailResult === "connected") {
          setFeedback(
            "Gmail conectado. Los movimientos compatibles quedaran en Pendientes para tu confirmacion.",
          );
        } else if (emailResult === "error") {
          setError("No se pudo conectar Gmail. Puedes intentarlo nuevamente.");
        }
      } catch (nextError) {
        if (!active) return;
        setLoadState("error");
        setError(toSettingsError(nextError));
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  async function reload() {
    setLoadState("loading");
    setFeedback(null);
    setError(null);

    try {
      const [nextProfile, nextNudgePreferences, nextWhatsappNudges, nextGmailStatus, nextGmailHistory, nextLearning] =
        await Promise.all([
          getProfileSettings(),
          getDashboardNudgePreferences(),
          getWhatsAppNudgeConsent(),
          getGmailStatus(),
          getGmailHistory().catch(() => []),
          getLearningSnapshot(),
        ]);
      setProfile(nextProfile);
      setNudgePreferences(nextNudgePreferences);
      setWhatsappNudges(nextWhatsappNudges);
      setGmailStatus(nextGmailStatus);
      setGmailHistory(nextGmailHistory);
      setLearning(nextLearning);
      setPhone(nextProfile.phone_e164 ?? "");
      setDisplayName(nextProfile.display_name ?? "");
      setLoadState("ready");
    } catch (nextError) {
      setLoadState("error");
      setError(toSettingsError(nextError));
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);

    try {
      const nextProfile = await updateProfileSettings({
        display_name: displayName.trim() || null,
        phone_e164: phone.trim() || null,
      });
      setProfile(nextProfile);
      setPhone(nextProfile.phone_e164 ?? "");
      setDisplayName(nextProfile.display_name ?? "");
      setFeedback(
        nextProfile.phone_e164
          ? "WhatsApp vinculado. Desde ahora, los mensajes de ese numero entran a esta cuenta."
          : "Perfil actualizado."
      );
    } catch (nextError) {
      setError(toSettingsError(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function unlinkWhatsApp() {
    setUnlinking(true);
    setFeedback(null);
    setError(null);

    try {
      const nextProfile = await updateProfileSettings({ phone_e164: null });
      setProfile(nextProfile);
      setPhone("");
      setFeedback(
        "WhatsApp desvinculado. Los nuevos mensajes desde ese numero ya no se asociaran a esta cuenta."
      );
    } catch (nextError) {
      setError(toSettingsError(nextError));
    } finally {
      setUnlinking(false);
    }
  }

  async function updateReminder(
    nudgeType: DashboardNudgePreferenceType,
    enabled: boolean
  ) {
    setSavingNudgeType(nudgeType);
    setFeedback(null);
    setError(null);

    try {
      const nextPreferences = await updateDashboardNudgePreference(
        nudgeType,
        enabled
      );
      setNudgePreferences(nextPreferences);
      setFeedback(
        enabled
          ? "Recordatorio activado en Home."
          : "Recordatorio desactivado."
      );
    } catch (nextError) {
      setError(toSettingsError(nextError));
    } finally {
      setSavingNudgeType(null);
    }
  }

  async function saveWhatsAppNudges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!whatsappNudges) return;

    setSavingWhatsappNudges(true);
    setFeedback(null);
    setError(null);

    try {
      const nextConsent = await updateWhatsAppNudgeConsent({
        whatsapp_opt_in: whatsappNudges.whatsapp_opt_in,
        payment_due: whatsappNudges.payment_due,
        debt_due: whatsappNudges.debt_due,
        quiet_hours_start: whatsappNudges.quiet_hours_start,
        quiet_hours_end: whatsappNudges.quiet_hours_end,
      });
      setWhatsappNudges(nextConsent);
      setFeedback(
        nextConsent.whatsapp_opt_in
          ? "Avisos por WhatsApp activados con tus preferencias."
          : "Avisos proactivos por WhatsApp desactivados.",
      );
    } catch (nextError) {
      setError(toSettingsError(nextError));
    } finally {
      setSavingWhatsappNudges(false);
    }
  }

  async function updateExperience(
    patch: Partial<typeof experiencePreferences>,
  ) {
    setFeedback(null);
    setError(null);
    try {
      const next = await saveExperiencePreferences({
        ...experiencePreferences,
        ...patch,
      });
      setFeedback(
        next.discreet_mode_enabled
          ? "Modo discreto activo en todo el Dashboard."
          : "Preferencias de privacidad y resúmenes actualizadas.",
      );
    } catch (nextError) {
      setError(toSettingsError(nextError));
    }
  }

  async function connectGmail() {
    setGmailWorking(true);
    setFeedback(null);
    setError(null);
    try {
      const authorizationUrl = await startGmailOAuth();
      window.location.assign(authorizationUrl);
    } catch (nextError) {
      setError(toSettingsError(nextError));
      setGmailWorking(false);
    }
  }

  async function confirmDisconnectGmail(connectionId: string) {
    setGmailWorking(true);
    setFeedback(null);
    setError(null);
    try {
      await disconnectGmail(connectionId);
      const nextStatus = await getGmailStatus();
      setGmailStatus(nextStatus);
      setGmailDisconnectConfirming(null);
      setFeedback(
        "Gmail desconectado. Los Pendientes de email sin resolver fueron archivados; tus movimientos confirmados se conservaron.",
      );
    } catch (nextError) {
      setError(toSettingsError(nextError));
    } finally {
      setGmailWorking(false);
    }
  }

  async function toggleGmailAiExtractionConsent(
    connectionId: string,
    enabled: boolean,
  ) {
    if (!gmailStatus?.connections.some((item) => item.id === connectionId)) {
      return;
    }
    setGmailWorking(true);
    setFeedback(null);
    setError(null);
    try {
      const consent = await updateGmailAiExtractionConsent(
        connectionId,
        enabled,
      );
      setGmailStatus((current) =>
        current
          ? {
              ...current,
              connections: current.connections.map((connection) =>
                connection.id === connectionId
                  ? { ...connection, ai_extraction_consent: consent }
                  : connection,
              ),
              connection:
                current.connection?.id === connectionId
                  ? {
                      ...current.connection,
                      ai_extraction_consent: consent,
                    }
                  : current.connection,
            }
          : current,
      );
      setFeedback(
        enabled
          ? "Extraccion con IA activada para remitentes financieros verificados."
          : "Extraccion con IA desactivada.",
      );
    } catch (nextError) {
      setError(toSettingsError(nextError));
    } finally {
      setGmailWorking(false);
    }
  }

  async function saveEmailSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailSourceForm) return;
    setGmailWorking(true);
    setFeedback(null);
    setError(null);
    try {
      await upsertGmailInstitutionSource({
        institution_key: emailSourceForm.institutionKey,
        email_connection_id: emailSourceForm.connectionId,
        notification_sender: emailSourceForm.notificationSender.trim(),
      });
      setGmailStatus(await getGmailStatus());
      setEmailSourceForm(null);
      setFeedback(
        "Banco configurado. Si el remitente aun no esta verificado, se evaluara en modo sombra y no creara Pendientes.",
      );
    } catch (nextError) {
      setError(toSettingsError(nextError));
    } finally {
      setGmailWorking(false);
    }
  }

  async function removeEmailSource(source: GmailInstitutionSource) {
    setGmailWorking(true);
    setFeedback(null);
    setError(null);
    try {
      await deleteGmailInstitutionSource(source.id);
      setGmailStatus(await getGmailStatus());
      if (emailSourceForm?.sourceId === source.id) setEmailSourceForm(null);
      setFeedback(
        "Banco retirado. Sus Pendientes abiertos fueron archivados sin cambiar movimientos confirmados.",
      );
    } catch (nextError) {
      setError(toSettingsError(nextError));
    } finally {
      setGmailWorking(false);
    }
  }

  async function refreshLearning() {
    setLearning(await getLearningSnapshot());
  }

  async function saveLearningPreferences(
    patch: Partial<
      Pick<
        NonNullable<LearningSnapshot["preferences"]>,
        "enabled" | "allow_narrative_memory" | "allow_sensitive_memory"
      >
    >,
  ) {
    if (!learning) return;
    setLearningWorking("preferences");
    setFeedback(null);
    setError(null);
    try {
      const preferences = await updateLearningPreferences({
        enabled: patch.enabled ?? learning.preferences.enabled,
        allow_narrative_memory:
          patch.allow_narrative_memory ??
          learning.preferences.allow_narrative_memory,
        allow_sensitive_memory:
          patch.allow_sensitive_memory ??
          learning.preferences.allow_sensitive_memory,
      });
      setLearning((current) =>
        current ? { ...current, preferences } : current,
      );
      setFeedback(
        preferences.enabled
          ? "Preferencias de aprendizaje actualizadas."
          : "Aprendizaje suspendido. Los recuerdos dejaron de usarse.",
      );
    } catch (nextError) {
      setError(toSettingsError(nextError));
    } finally {
      setLearningWorking(null);
    }
  }

  async function actOnMemory(
    memoryId: string,
    action: "forget" | "correct" | "suspend" | "confirm",
    summary?: string,
  ) {
    setLearningWorking(`memory:${memoryId}`);
    setFeedback(null);
    setError(null);
    try {
      await manageLearningMemory({
        target: "memory",
        target_id: memoryId,
        action,
        summary,
        reason: `user_${action}_from_dashboard`,
      });
      await refreshLearning();
      setMemoryCorrection(null);
      setFeedback(
        action === "forget"
          ? "Recuerdo olvidado. Ya no se usara en conversaciones."
          : action === "correct"
            ? "Recuerdo corregido y reemplazado por tu version."
            : action === "confirm"
              ? "Recuerdo confirmado nuevamente."
              : "Recuerdo suspendido.",
      );
    } catch (nextError) {
      setError(toSettingsError(nextError));
    } finally {
      setLearningWorking(null);
    }
  }

  async function actOnCandidate(
    candidateId: string,
    action: "confirm" | "reject",
  ) {
    setLearningWorking(`candidate:${candidateId}`);
    setFeedback(null);
    setError(null);
    try {
      await manageLearningCandidate({
        target: "candidate",
        target_id: candidateId,
        action,
        reason: `user_${action}_from_dashboard`,
      });
      await refreshLearning();
      setFeedback(
        action === "confirm"
          ? "Aprendizaje confirmado. Ya puede usarse como contexto."
          : "Aprendizaje rechazado. No se guardara como recuerdo.",
      );
    } catch (nextError) {
      setError(toSettingsError(nextError));
    } finally {
      setLearningWorking(null);
    }
  }

  async function exportData() {
    setExportingData(true);
    setFeedback(null);
    setError(null);
    try {
      await downloadUserDataExport();
      setFeedback("Exportacion preparada y descargada en formato JSON.");
    } catch (nextError) {
      setError(toSettingsError(nextError));
    } finally {
      setExportingData(false);
    }
  }

  async function confirmAccountDeletion() {
    setDeletingAccount(true);
    setFeedback(null);
    setError(null);
    try {
      await deleteUserAccount(deleteConfirmation);
      setFeedback(
        "Cuenta eliminada. Gmail fue desconectado y los avisos quedaron detenidos.",
      );
      onSignOut?.();
    } catch (nextError) {
      setError(toSettingsError(nextError));
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <AppShell
      title="Configuracion"
      subtitle="Canales, privacidad y datos de tu cuenta."
      activeView="settings"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      primaryAction={
        <Button
          variant="secondary"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={() => void reload()}
          disabled={loadState === "loading"}
        >
          Actualizar
        </Button>
      }
    >
      <div className="mx-auto max-w-[920px] space-y-6 pb-10 pt-2 lg:pt-4">
        {loadState === "loading" ? (
          <LoadingBlock label="Cargando configuracion" />
        ) : loadState === "error" || !profile ? (
          <ErrorState
            title="No pude cargar Configuracion"
            description={error ?? "Intenta de nuevo en un momento."}
            onRetry={() => void reload()}
          />
        ) : (
          <>
            {feedback ? (
              <StatusMessage
                tone="success"
                message={feedback}
                onDismiss={() => setFeedback(null)}
              />
            ) : null}

            {error ? (
              <StatusMessage
                tone="error"
                message={error}
                onDismiss={() => setError(null)}
              />
            ) : null}

            <section className="rounded-lg border border-border bg-bg-surface-raised p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                  <EyeOff className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text">
                    Privacidad y experiencia
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                    Una sola preferencia protege montos en todas las pantallas.
                    Los mensajes proactivos requieren autorizaciones separadas.
                  </p>
                </div>
              </div>

              <div className="mt-5 divide-y divide-border rounded-lg border border-border bg-bg-surface px-4">
                <LearningSwitchRow
                  label="Modo discreto global"
                  description="Oculta montos y detalles financieros sensibles en Home, Mi Dinero, Movimientos, Pendientes, Deudas, Pagos que vienen y Descubrimientos."
                  checked={experiencePreferences.discreet_mode_enabled}
                  disabled={savingExperience}
                  onCheckedChange={(discreet_mode_enabled) =>
                    void updateExperience({ discreet_mode_enabled })
                  }
                />
                <LearningSwitchRow
                  label="Descubrimientos por WhatsApp"
                  description="Autoriza solo mensajes útiles de patrones, anomalías y progreso. No activa recordatorios de pagos o deudas."
                  checked={experiencePreferences.insights_whatsapp_opt_in}
                  disabled={savingExperience || !profile.phone_e164}
                  onCheckedChange={(insights_whatsapp_opt_in) =>
                    void updateExperience({ insights_whatsapp_opt_in })
                  }
                />
                <LearningSwitchRow
                  label="Resumen semanal"
                  description="Recibe un resumen sobrio de tu semana. Puedes elegir Dashboard o WhatsApp."
                  checked={experiencePreferences.weekly_summary_enabled}
                  disabled={savingExperience}
                  onCheckedChange={(weekly_summary_enabled) =>
                    void updateExperience({ weekly_summary_enabled })
                  }
                />
              </div>

              {experiencePreferences.weekly_summary_enabled ? (
                <div className="mt-4 max-w-sm">
                  <label
                    htmlFor="weekly-summary-channel"
                    className="mb-2 block text-sm font-medium text-text"
                  >
                    Canal del resumen
                  </label>
                  <select
                    id="weekly-summary-channel"
                    className="h-11 w-full rounded-lg border border-border bg-bg-surface px-3 text-sm text-text"
                    value={experiencePreferences.weekly_summary_channel}
                    disabled={savingExperience}
                    onChange={(event) =>
                      void updateExperience({
                        weekly_summary_channel: event.target.value as
                          | "dashboard"
                          | "whatsapp",
                      })
                    }
                  >
                    <option value="dashboard">Dashboard</option>
                    <option value="whatsapp" disabled={!profile.phone_e164}>
                      WhatsApp
                    </option>
                  </select>
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border border-border bg-bg-surface-raised p-5 shadow-xs">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">
                      WhatsApp principal
                    </p>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-text-secondary">
                      Vincula el numero desde el que le escribes a Manzana. Asi
                      lo que registres por WhatsApp aparece en este Dashboard.
                    </p>
                  </div>
                </div>
                <WhatsAppStatus phone={profile.phone_e164} />
              </div>

              <form className="mt-6 space-y-5" onSubmit={saveProfile}>
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldShell
                    label="Nombre visible"
                    htmlFor="display-name"
                    hint="Lo usamos para personalizar la experiencia, no para calculos financieros."
                  >
                    <Input
                      id="display-name"
                      value={displayName}
                      placeholder="Marco"
                      onChange={(event) => setDisplayName(event.target.value)}
                    />
                  </FieldShell>

                  <FieldShell
                    label="Numero de WhatsApp"
                    htmlFor="whatsapp-phone"
                    hint="Incluye codigo de pais. Ejemplo: +51928377977."
                  >
                    <Input
                      id="whatsapp-phone"
                      value={phone}
                      inputMode="tel"
                      placeholder="+51928377977"
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </FieldShell>
                </div>

                <div className="rounded-lg border border-brand-subtle bg-brand-subtle/45 px-4 py-3 text-sm leading-6 text-text-secondary">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <p>
                      Esto solo conecta el canal con tu usuario. No confirma
                      pendientes, no mueve saldos y no cambia movimientos
                      anteriores.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
                  {profile.phone_e164 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      icon={<Unlink className="h-4 w-4" />}
                      loading={unlinking}
                      onClick={() => void unlinkWhatsApp()}
                    >
                      Desvincular
                    </Button>
                  ) : null}
                  <Button
                    type="submit"
                    loading={saving}
                    icon={<Smartphone className="h-4 w-4" />}
                  >
                    Guardar vinculo
                  </Button>
                </div>
              </form>
            </section>

            {gmailStatus ? (
              <section className="rounded-lg border border-border bg-bg-surface-raised p-5 shadow-xs">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-text">
                        Correos bancarios
                      </h2>
                      <p className="mt-1 max-w-xl text-sm leading-6 text-text-secondary">
                        Conecta los Gmail donde recibes notificaciones y elige
                        que correo usa cada banco. Cada hallazgo queda en
                        Pendientes; nunca crea movimientos ni cambia saldos por
                        si solo.
                      </p>
                    </div>
                  </div>
                  <GmailConnectionBadge status={gmailStatus} />
                </div>

                <div className="mt-5 rounded-lg border border-brand-subtle bg-brand-subtle/45 px-4 py-3 text-sm leading-6 text-text-secondary">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <p>
                      Primero se filtra por el buzon y remitente exactos que
                      configuraste. Luego se exige DKIM/DMARC. Solo entonces un
                      agente especializado puede extraer datos de forma
                      transitoria; no decide ni registra operaciones y el
                      cuerpo no se guarda en Manzana.
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-text">
                        Buzones Gmail conectados
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-text-muted">
                        Puedes usar un Gmail distinto para cada banco.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      icon={<Plus className="h-4 w-4" />}
                      loading={gmailWorking}
                      disabled={!gmailStatus.configured}
                      onClick={() => void connectGmail()}
                    >
                      Conectar otro Gmail
                    </Button>
                  </div>

                  {gmailStatus.connections.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {gmailStatus.connections.map((connection) => (
                        <div
                          key={connection.id}
                          className="rounded-lg border border-border bg-bg-surface p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-text">
                                {connection.email_address}
                              </p>
                              <p className="mt-1 text-xs text-text-muted">
                                {connection.watch_status === "active"
                                  ? "Escucha activa"
                                  : "Requiere revisar la conexion"}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              icon={<Unlink className="h-4 w-4" />}
                              disabled={gmailWorking}
                              onClick={() =>
                                setGmailDisconnectConfirming(connection.id)
                              }
                            >
                              Desconectar
                            </Button>
                          </div>

                          <div className="mt-3 flex items-start justify-between gap-4 border-t border-border pt-3">
                            <div>
                              <p className="text-sm font-medium text-text">
                                Extraccion bancaria con IA
                              </p>
                              <p className="mt-1 max-w-xl text-xs leading-5 text-text-muted">
                                Solo remitentes configurados y autenticados
                                llegan al agente. Puedes retirar este permiso
                                por buzon.
                              </p>
                            </div>
                            <Switch
                              aria-label={`Permitir extraccion bancaria con IA en ${connection.email_address}`}
                              checked={
                                connection.ai_extraction_consent.enabled
                              }
                              disabled={gmailWorking}
                              onCheckedChange={(enabled) =>
                                void toggleGmailAiExtractionConsent(
                                  connection.id,
                                  enabled,
                                )
                              }
                            />
                          </div>

                          {gmailDisconnectConfirming === connection.id ? (
                            <div className="mt-3 rounded-lg border border-warning-subtle bg-warning-subtle p-3 text-sm leading-6 text-text-secondary">
                              <p className="font-semibold text-text">
                                ¿Desconectar {connection.email_address}?
                              </p>
                              <p className="mt-1">
                                Solo se archivaran los Pendientes nacidos en
                                este buzon. Los otros Gmail y los movimientos
                                confirmados se conservan.
                              </p>
                              <div className="mt-3 flex justify-end gap-3">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  disabled={gmailWorking}
                                  onClick={() =>
                                    setGmailDisconnectConfirming(null)
                                  }
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  loading={gmailWorking}
                                  onClick={() =>
                                    void confirmDisconnectGmail(connection.id)
                                  }
                                >
                                  Confirmar desconexion
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-text-secondary">
                      Conecta al menos un Gmail antes de asignar bancos.
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-border pt-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-text">
                        Bancos y remitentes
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-text-muted">
                        Elige el Gmail receptor y el correo exacto que envia
                        las notificaciones de cada banco.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      icon={<Plus className="h-4 w-4" />}
                      disabled={
                        gmailWorking || gmailStatus.connections.length === 0
                      }
                      onClick={() =>
                        setEmailSourceForm({
                          sourceId: null,
                          institutionKey:
                            gmailStatus.institutions.find(
                              (institution) =>
                                !gmailStatus.sources.some(
                                  (source) =>
                                    source.institution_key ===
                                    institution.institution_key,
                                ),
                            )?.institution_key ??
                            gmailStatus.institutions[0]?.institution_key ??
                            "",
                          connectionId:
                            gmailStatus.connections[0]?.id ?? "",
                          notificationSender: "",
                        })
                      }
                    >
                      Agregar banco
                    </Button>
                  </div>

                  {gmailStatus.sources.length > 0 ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {gmailStatus.sources.map((source) => {
                        const institution = gmailStatus.institutions.find(
                          (item) =>
                            item.institution_key === source.institution_key,
                        );
                        const connection = gmailStatus.connections.find(
                          (item) =>
                            item.id === source.email_connection_id,
                        );
                        return (
                          <div
                            key={source.id}
                            className="rounded-lg border border-border bg-bg-surface p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-text">
                                  {institution?.display_name ??
                                    formatInstitution(
                                      source.institution_key,
                                    )}
                                </p>
                                <p className="mt-1 text-xs text-text-muted">
                                  {connection?.email_address ??
                                    "Buzon desconectado"}
                                </p>
                              </div>
                              <EmailSourceBadge source={source} />
                            </div>
                            <p className="mt-3 break-all text-xs text-text-secondary">
                              Remitente: {source.notification_sender}
                            </p>
                            <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
                              <Button
                                type="button"
                                variant="ghost"
                                icon={<Trash2 className="h-4 w-4" />}
                                disabled={gmailWorking}
                                onClick={() =>
                                  void removeEmailSource(source)
                                }
                              >
                                Quitar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                icon={<Pencil className="h-4 w-4" />}
                                disabled={gmailWorking}
                                onClick={() =>
                                  setEmailSourceForm({
                                    sourceId: source.id,
                                    institutionKey:
                                      source.institution_key,
                                    connectionId:
                                      source.email_connection_id,
                                    notificationSender:
                                      source.notification_sender,
                                  })
                                }
                              >
                                Cambiar
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-text-secondary">
                      Aun no has indicado que bancos notifican a cada Gmail.
                    </div>
                  )}

                  {emailSourceForm ? (
                    <form
                      className="mt-4 rounded-lg border border-brand-subtle bg-brand-subtle/25 p-4"
                      onSubmit={saveEmailSource}
                    >
                      <div className="grid gap-4 md:grid-cols-3">
                        <FieldShell label="Banco o app" htmlFor="email-bank">
                          <select
                            id="email-bank"
                            className="h-11 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text outline-none focus:border-brand"
                            value={emailSourceForm.institutionKey}
                            disabled={
                              gmailWorking ||
                              emailSourceForm.sourceId !== null
                            }
                            onChange={(event) =>
                              setEmailSourceForm((current) =>
                                current
                                  ? {
                                      ...current,
                                      institutionKey: event.target.value,
                                    }
                                  : current,
                              )
                            }
                          >
                            {gmailStatus.institutions.map((institution) => (
                              <option
                                key={institution.institution_key}
                                value={institution.institution_key}
                                disabled={gmailStatus.sources.some(
                                  (source) =>
                                    source.institution_key ===
                                      institution.institution_key &&
                                    source.id !== emailSourceForm.sourceId,
                                )}
                              >
                                {institution.display_name}
                              </option>
                            ))}
                          </select>
                        </FieldShell>
                        <FieldShell
                          label="Gmail que recibe el aviso"
                          htmlFor="email-bank-mailbox"
                        >
                          <select
                            id="email-bank-mailbox"
                            className="h-11 w-full rounded-md border border-border bg-bg-surface px-3 text-sm text-text outline-none focus:border-brand"
                            value={emailSourceForm.connectionId}
                            disabled={gmailWorking}
                            onChange={(event) =>
                              setEmailSourceForm((current) =>
                                current
                                  ? {
                                      ...current,
                                      connectionId: event.target.value,
                                    }
                                  : current,
                              )
                            }
                          >
                            {gmailStatus.connections.map((connection) => (
                              <option
                                key={connection.id}
                                value={connection.id}
                              >
                                {connection.email_address}
                              </option>
                            ))}
                          </select>
                        </FieldShell>
                        <FieldShell
                          label="Correo remitente del banco"
                          htmlFor="email-bank-sender"
                          hint="Ejemplo: notificaciones@banco.com.pe"
                        >
                          <Input
                            id="email-bank-sender"
                            type="email"
                            value={emailSourceForm.notificationSender}
                            disabled={gmailWorking}
                            placeholder="notificaciones@banco.com.pe"
                            onChange={(event) =>
                              setEmailSourceForm((current) =>
                                current
                                  ? {
                                      ...current,
                                      notificationSender:
                                        event.target.value,
                                    }
                                  : current,
                              )
                            }
                          />
                        </FieldShell>
                      </div>
                      <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2 text-xs leading-5 text-text-secondary">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                        <p>
                          Guardar un remitente no lo aprueba. Hasta que
                          coincida con una identidad institucional verificada,
                          se analiza en sombra y no crea Pendientes.
                        </p>
                      </div>
                      <div className="mt-4 flex justify-end gap-3">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={gmailWorking}
                          onClick={() => setEmailSourceForm(null)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          loading={gmailWorking}
                          disabled={
                            !emailSourceForm.institutionKey ||
                            !emailSourceForm.connectionId ||
                            !emailSourceForm.notificationSender.trim()
                          }
                        >
                          Guardar banco
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </div>

                {gmailHistory.length > 0 ? (
                  <div className="mt-5 rounded-lg border border-border bg-bg-surface p-4">
                    <h3 className="text-sm font-semibold text-text">
                      Actividad reciente
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-text-muted">
                      Solo mostramos estado, institucion y fecha. No guardamos
                      ni exponemos el cuerpo del correo.
                    </p>
                    <ul className="mt-3 divide-y divide-border">
                      {gmailHistory.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-4 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium text-text">
                              {formatInstitution(item.institution_key)}
                            </p>
                            <p className="text-xs text-text-muted">
                              {new Intl.DateTimeFormat("es-PE", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(item.received_at))}
                            </p>
                          </div>
                          <span className="rounded-full bg-bg-surface-raised px-2.5 py-1 text-xs text-text-secondary">
                            {formatEmailCaptureStatus(item)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {whatsappNudges ? (
              <section className="rounded-lg border border-border bg-bg-surface-raised p-5 shadow-xs">
                <form onSubmit={saveWhatsAppNudges}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-success-subtle text-success">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-text">
                          Avisos por WhatsApp
                        </h2>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-text-secondary">
                          Autoriza a Manzana a escribirte cuando haya algo útil
                          que elegiste recibir. Puedes retirarlo en cualquier momento.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={whatsappNudges.whatsapp_opt_in}
                      disabled={!profile.phone_e164 || savingWhatsappNudges}
                      aria-label={`${whatsappNudges.whatsapp_opt_in ? "Desactivar" : "Activar"} avisos por WhatsApp`}
                      onCheckedChange={(checked) =>
                        setWhatsappNudges((current) =>
                          current
                            ? { ...current, whatsapp_opt_in: checked }
                            : current,
                        )
                      }
                    />
                  </div>

                  {!profile.phone_e164 ? (
                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning-subtle bg-warning-subtle px-4 py-3 text-sm leading-6 text-text-secondary">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      <p>Vincula primero tu número de WhatsApp para activar estos avisos.</p>
                    </div>
                  ) : null}

                  <div className="mt-5 divide-y divide-border border-y border-border">
                    <ReminderPreferenceRow
                      label="Pagos que vienen"
                      description="Avisos de pagos próximos o vencidos que ya registraste."
                      checked={whatsappNudges.payment_due}
                      saving={savingWhatsappNudges}
                      disabled={!whatsappNudges.whatsapp_opt_in}
                      onCheckedChange={(checked) =>
                        setWhatsappNudges((current) =>
                          current ? { ...current, payment_due: checked } : current,
                        )
                      }
                    />
                    <ReminderPreferenceRow
                      label="Cuotas de deuda por WhatsApp"
                      description="Avisos de cuotas próximas, con lenguaje discreto y sin cobranza."
                      checked={whatsappNudges.debt_due}
                      saving={savingWhatsappNudges}
                      disabled={!whatsappNudges.whatsapp_opt_in}
                      onCheckedChange={(checked) =>
                        setWhatsappNudges((current) =>
                          current ? { ...current, debt_due: checked } : current,
                        )
                      }
                    />
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-brand" />
                      <p className="text-sm font-semibold text-text">Horario silencioso</p>
                    </div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <FieldShell label="Desde" htmlFor="quiet-hours-start">
                        <Input
                          id="quiet-hours-start"
                          type="time"
                          value={whatsappNudges.quiet_hours_start}
                          disabled={savingWhatsappNudges}
                          onChange={(event) =>
                            setWhatsappNudges((current) =>
                              current
                                ? { ...current, quiet_hours_start: event.target.value }
                                : current,
                            )
                          }
                        />
                      </FieldShell>
                      <FieldShell label="Hasta" htmlFor="quiet-hours-end">
                        <Input
                          id="quiet-hours-end"
                          type="time"
                          value={whatsappNudges.quiet_hours_end}
                          disabled={savingWhatsappNudges}
                          onChange={(event) =>
                            setWhatsappNudges((current) =>
                              current
                                ? { ...current, quiet_hours_end: event.target.value }
                                : current,
                            )
                          }
                        />
                      </FieldShell>
                    </div>
                  </div>

                  <div className="mt-5 flex items-start gap-2 rounded-lg border border-brand-subtle bg-brand-subtle/45 px-4 py-3 text-sm leading-6 text-text-secondary">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <p>
                      Guardar esta opción autoriza mensajes iniciados por Manzana
                      solo para los tipos marcados. Cada aviso también respeta
                      frecuencia, horario, privacidad y relevancia.
                    </p>
                  </div>

                  <div className="mt-5 flex justify-end border-t border-border pt-4">
                    <Button
                      type="submit"
                      loading={savingWhatsappNudges}
                      disabled={!profile.phone_e164}
                      icon={<Check className="h-4 w-4" />}
                    >
                      {whatsappNudges.whatsapp_opt_in
                        ? "Guardar autorización"
                        : "Guardar y desactivar"}
                    </Button>
                  </div>
                </form>
              </section>
            ) : null}

            <section className="rounded-lg border border-border bg-bg-surface-raised p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-warning-subtle text-warning">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text">
                    Recordatorios
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Elige que avisos quieres ver dentro de Home.
                  </p>
                </div>
              </div>

              <div className="mt-5 divide-y divide-border">
                <ReminderPreferenceRow
                  label="Pagos que vienen"
                  description="Pagos esperados proximos o vencidos."
                  checked={isNudgePreferenceEnabled(
                    nudgePreferences,
                    "payment_due"
                  )}
                  saving={savingNudgeType === "payment_due"}
                  onCheckedChange={(enabled) =>
                    void updateReminder("payment_due", enabled)
                  }
                />
                <ReminderPreferenceRow
                  label="Cuotas de deuda"
                  description="La cuota o el cobro abierto que requiere atencion primero."
                  checked={isNudgePreferenceEnabled(
                    nudgePreferences,
                    "debt_due"
                  )}
                  saving={savingNudgeType === "debt_due"}
                  onCheckedChange={(enabled) =>
                    void updateReminder("debt_due", enabled)
                  }
                />
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-bg-surface px-4 py-3 text-sm leading-6 text-text-secondary">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <p>
                  Estos controles no envian mensajes por WhatsApp y no cambian
                  movimientos, deudas ni saldos.
                </p>
              </div>
            </section>

            {learning ? (
              <section className="rounded-lg border border-border bg-bg-surface-raised p-5 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text">
                      Aprendizaje y memoria
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                      Manzana solo convierte evidencia confirmada en recuerdos.
                      Puedes ver por que existen, corregirlos u olvidarlos. Un
                      recuerdo aporta contexto: nunca autoriza movimientos,
                      pagos ni cambios de saldo.
                    </p>
                  </div>
                </div>

                <div className="mt-5 divide-y divide-border rounded-lg border border-border bg-bg-surface px-4">
                  <LearningSwitchRow
                    label="Usar aprendizaje"
                    description="Si lo apagas, los recuerdos confirmados dejan de entrar en las conversaciones."
                    checked={learning.preferences.enabled}
                    disabled={learningWorking === "preferences"}
                    onCheckedChange={(enabled) =>
                      void saveLearningPreferences({ enabled })
                    }
                  />
                  <LearningSwitchRow
                    label="Contexto narrativo"
                    description="Permite recordar contexto personal no financiero cuando existe evidencia válida."
                    checked={learning.preferences.allow_narrative_memory}
                    disabled={
                      learningWorking === "preferences" ||
                      !learning.preferences.enabled
                    }
                    onCheckedChange={(allow_narrative_memory) =>
                      void saveLearningPreferences({
                        allow_narrative_memory,
                      })
                    }
                  />
                  <LearningSwitchRow
                    label="Información sensible"
                    description="Nunca se guarda por inferencia: cada recuerdo sensible exige tu confirmación explícita."
                    checked={learning.preferences.allow_sensitive_memory}
                    disabled={
                      learningWorking === "preferences" ||
                      !learning.preferences.enabled
                    }
                    onCheckedChange={(allow_sensitive_memory) =>
                      void saveLearningPreferences({
                        allow_sensitive_memory,
                      })
                    }
                  />
                </div>

                {learning.candidates.length > 0 ? (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-text">
                      Por decidir
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-text-muted">
                      Estas señales todavía no son recuerdos confirmados.
                    </p>
                    <div className="mt-3 space-y-3">
                      {learning.candidates.map((candidate) => (
                        <article
                          key={candidate.id}
                          className="rounded-lg border border-warning-subtle bg-warning-subtle/25 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-text">
                                {candidate.proposal_summary}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-text-muted">
                                {learningKindLabel(candidate.kind)} ·{" "}
                                {candidate.sensitivity === "sensitive"
                                  ? "Información sensible"
                                  : "Información general"}{" "}
                                · {candidate.positive_evidence_count}{" "}
                                {candidate.positive_evidence_count === 1
                                  ? "evidencia"
                                  : "evidencias"}
                                {candidate.negative_evidence_count > 0
                                  ? ` · ${candidate.negative_evidence_count} en contra`
                                  : ""}
                              </p>
                            </div>
                            <LearningStatusBadge status={candidate.status} />
                          </div>
                          <p className="mt-2 text-xs leading-5 text-text-secondary">
                            Fuente: {learningSourceLabel(candidate.basis)}.
                          </p>
                          {candidate.sensitivity === "sensitive" &&
                          !learning.preferences.allow_sensitive_memory ? (
                            <p className="mt-2 text-xs leading-5 text-warning">
                              Activa “Información sensible” arriba antes de
                              confirmar este recuerdo.
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={
                                learningWorking ===
                                `candidate:${candidate.id}`
                              }
                              onClick={() =>
                                void actOnCandidate(candidate.id, "reject")
                              }
                            >
                              No recordar
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              loading={
                                learningWorking ===
                                `candidate:${candidate.id}`
                              }
                              disabled={
                                candidate.sensitivity === "sensitive" &&
                                !learning.preferences.allow_sensitive_memory
                              }
                              onClick={() =>
                                void actOnCandidate(candidate.id, "confirm")
                              }
                            >
                              Confirmar recuerdo
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-text">
                    Lo que Manzana recuerda
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    Incluye recuerdos activos e historial de los suspendidos,
                    sustituidos u olvidados.
                  </p>
                  {learning.memories.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {learning.memories.map((memory) => {
                        const working =
                          learningWorking === `memory:${memory.id}`;
                        const editable = ["confirmed", "suspended"].includes(
                          memory.lifecycle_status,
                        );
                        return (
                          <article
                            key={memory.id}
                            className="rounded-lg border border-border bg-bg-surface p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-text">
                                  {memory.summary}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-text-muted">
                                  {learningKindLabel(memory.kind)} ·{" "}
                                  {memory.positive_evidence_count}{" "}
                                  {memory.positive_evidence_count === 1
                                    ? "evidencia a favor"
                                    : "evidencias a favor"}
                                  {memory.negative_evidence_count > 0
                                    ? ` · ${memory.negative_evidence_count} en contra`
                                    : ""}
                                </p>
                              </div>
                              <LearningStatusBadge
                                status={memory.lifecycle_status}
                              />
                            </div>
                            <p className="mt-2 text-xs leading-5 text-text-secondary">
                              Por qué:{" "}
                              {memory.explanation ??
                                learningSourceLabel(memory.evidence_source)}
                            </p>
                            {memory.valid_until ? (
                              <p className="mt-1 text-xs text-text-muted">
                                Vigente hasta{" "}
                                {new Date(memory.valid_until).toLocaleDateString(
                                  "es-PE",
                                )}
                                .
                              </p>
                            ) : null}

                            {memoryCorrection?.id === memory.id ? (
                              <div className="mt-3 rounded-lg border border-brand-subtle bg-brand-subtle/35 p-3">
                                <FieldShell
                                  label="Tu versión correcta"
                                  htmlFor={`memory-correction-${memory.id}`}
                                >
                                  <Input
                                    id={`memory-correction-${memory.id}`}
                                    value={memoryCorrection.summary}
                                    disabled={working}
                                    onChange={(event) =>
                                      setMemoryCorrection({
                                        id: memory.id,
                                        summary: event.target.value,
                                      })
                                    }
                                  />
                                </FieldShell>
                                <div className="mt-3 flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={working}
                                    onClick={() => setMemoryCorrection(null)}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    loading={working}
                                    disabled={
                                      memoryCorrection.summary.trim().length < 3
                                    }
                                    onClick={() =>
                                      void actOnMemory(
                                        memory.id,
                                        "correct",
                                        memoryCorrection.summary.trim(),
                                      )
                                    }
                                  >
                                    Guardar corrección
                                  </Button>
                                </div>
                              </div>
                            ) : editable ? (
                              <div className="mt-3 flex flex-wrap justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  disabled={working}
                                  onClick={() =>
                                    setMemoryCorrection({
                                      id: memory.id,
                                      summary: memory.summary,
                                    })
                                  }
                                >
                                  Corregir
                                </Button>
                                {memory.lifecycle_status === "suspended" ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    loading={working}
                                    onClick={() =>
                                      void actOnMemory(memory.id, "confirm")
                                    }
                                  >
                                    Confirmar de nuevo
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  loading={working}
                                  onClick={() =>
                                    void actOnMemory(memory.id, "forget")
                                  }
                                >
                                  Olvidar
                                </Button>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm leading-6 text-text-secondary">
                      Aún no hay recuerdos permanentes. Una conversación
                      aislada nunca se guarda como aprendizaje estable.
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2">
              <InfoCard
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Pendientes protegidos"
                copy="Si algo llega por WhatsApp con baja confianza, queda por revisar antes de afectar tus saldos."
              />
              <InfoCard
                icon={<MessageCircle className="h-5 w-5" />}
                title="Canal principal"
                copy="WhatsApp sigue siendo la entrada rapida. El Dashboard sirve para revisar, corregir y entender."
              />
            </section>

            <section className="rounded-lg border border-border bg-bg-surface-raised p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text">
                    Tus datos
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Descarga una copia legible de tus datos o elimina la cuenta.
                    La exportacion no incluye tokens, secretos ni datos internos
                    de seguridad.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Download className="h-4 w-4" />}
                  loading={exportingData}
                  onClick={() => void exportData()}
                >
                  Exportar datos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => setDeleteConfirming(true)}
                >
                  Eliminar cuenta
                </Button>
              </div>

              {deleteConfirming ? (
                <div className="mt-4 rounded-lg border border-danger-subtle bg-danger-subtle/35 p-4 text-sm leading-6 text-text-secondary">
                  <p className="font-semibold text-text">
                    Esta accion es permanente
                  </p>
                  <p className="mt-1">
                    Se desconectara Gmail, se detendran los avisos y se
                    eliminaran tu cuenta y datos financieros. Escribe
                    <strong className="mx-1 text-text">
                      ELIMINAR MI CUENTA
                    </strong>
                    para continuar.
                  </p>
                  <div className="mt-3">
                    <FieldShell
                      label="Confirmacion"
                      htmlFor="delete-account-confirmation"
                    >
                      <Input
                        id="delete-account-confirmation"
                        value={deleteConfirmation}
                        disabled={deletingAccount}
                        autoComplete="off"
                        onChange={(event) =>
                          setDeleteConfirmation(event.target.value)
                        }
                      />
                    </FieldShell>
                  </div>
                  <div className="mt-3 flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={deletingAccount}
                      onClick={() => {
                        setDeleteConfirming(false);
                        setDeleteConfirmation("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      loading={deletingAccount}
                      disabled={deleteConfirmation !== "ELIMINAR MI CUENTA"}
                      onClick={() => void confirmAccountDeletion()}
                    >
                      Eliminar definitivamente
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>

            {!profile.phone_e164 ? (
              <EmptyState
                icon={<Smartphone className="h-5 w-5" />}
                title="Aun no hay WhatsApp vinculado"
                description="Guarda tu numero personal aqui y prueba enviando un mensaje a Manzana. Desde ese momento el Dashboard y WhatsApp hablaran del mismo usuario."
              />
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}

function ReminderPreferenceRow({
  label,
  description,
  checked,
  saving,
  disabled = false,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  saving: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-20 items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        disabled={saving || disabled}
        aria-label={`${checked ? "Desactivar" : "Activar"} ${label}`}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function LearningSwitchRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-20 items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={`${checked ? "Desactivar" : "Activar"} ${label}`}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function LearningStatusBadge({ status }: { status: string }) {
  const active = status === "confirmed" || status === "accepted";
  const attention =
    status === "pending_confirmation" ||
    status === "observed" ||
    status === "suspended";
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium ${
        active
          ? "border-success-subtle bg-success-subtle text-text"
          : attention
            ? "border-warning-subtle bg-warning-subtle text-text"
            : "border-border bg-bg-surface text-text-muted"
      }`}
    >
      {learningStatusLabel(status)}
    </span>
  );
}

function learningStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    observed: "Observado",
    pending_confirmation: "Por confirmar",
    accepted: "Aceptado",
    confirmed: "Confirmado",
    suspended: "Suspendido",
    revoked: "Olvidado",
    expired: "Expirado",
    superseded: "Sustituido",
    rejected: "Rechazado",
  };
  return labels[status] ?? status;
}

function learningKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    preference: "Preferencia",
    alias: "Alias",
    person_context: "Contexto personal",
    correction_pattern: "Patrón de clasificación",
    narrative_fact: "Contexto temporal",
  };
  return labels[kind] ?? "Recuerdo";
}

function learningSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    explicit_user_statement: "lo indicaste explícitamente",
    confirmed_correction: "una corrección que confirmaste",
    confirmed_movement: "movimientos confirmados y repetidos",
    repeated_behavior: "un patrón repetido con evidencia",
    explicit_feedback: "una corrección directa del recuerdo",
  };
  return labels[source] ?? "evidencia trazable";
}

function WhatsAppStatus({ phone }: { phone: string | null }) {
  if (!phone) {
    return (
      <span className="inline-flex h-9 items-center gap-2 rounded-full border border-warning-subtle bg-warning-subtle px-3 text-sm font-medium text-text">
        <AlertTriangle className="h-4 w-4 text-warning" />
        Sin vincular
      </span>
    );
  }

  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-full border border-success-subtle bg-success-subtle px-3 text-sm font-medium text-text">
      <Check className="h-4 w-4 text-success" />
      {phone}
    </span>
  );
}

function formatInstitution(value: string | null): string {
  if (!value) return "Institución por identificar";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function formatEmailCaptureStatus(item: GmailHistoryItem): string {
  if (item.pending_status === "user_confirmed") return "Confirmado";
  if (item.pending_status === "discarded") return "Rechazado";
  if (item.pending_status === "archived") return "Archivado";
  if (item.pending_status) return "En Pendientes";
  if (item.parsed_status === "deduplicated") return "Ya registrado";
  if (item.parsed_status === "parse_failed") return "No compatible";
  if (item.parse_mode === "generic_fallback") return "Revisar formato";
  return "Procesado";
}

function GmailConnectionBadge({ status }: { status: GmailStatus }) {
  if (status.connections.length > 0) {
    return (
      <span className="inline-flex h-9 items-center gap-2 rounded-full border border-success-subtle bg-success-subtle px-3 text-sm font-medium text-text">
        <Check className="h-4 w-4 text-success" />
        {status.connections.length === 1
          ? status.connections[0].email_address
          : `${status.connections.length} Gmail conectados`}
      </span>
    );
  }

  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-full border border-warning-subtle bg-warning-subtle px-3 text-sm font-medium text-text">
      <AlertTriangle className="h-4 w-4 text-warning" />
      {status.configured ? "Sin conectar" : "No configurado"}
    </span>
  );
}

function EmailSourceBadge({
  source,
}: {
  source: GmailInstitutionSource;
}) {
  const active =
    source.status === "active" &&
    source.verification_status === "verified";
  return (
    <span
      className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium ${
        active
          ? "border-success-subtle bg-success-subtle text-text"
          : "border-warning-subtle bg-warning-subtle text-text"
      }`}
    >
      {active ? "Activo" : "En verificacion"}
    </span>
  );
}

function InfoCard({
  icon,
  title,
  copy,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-surface-raised p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-surface text-brand">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-text">{title}</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{copy}</p>
        </div>
      </div>
    </div>
  );
}

function StatusMessage({
  tone,
  message,
  onDismiss,
}: {
  tone: "success" | "error";
  message: string;
  onDismiss: () => void;
}) {
  const isSuccess = tone === "success";

  return (
    <div
      className={
        isSuccess
          ? "flex items-start gap-2 rounded-lg border border-success-subtle bg-success-subtle/60 px-4 py-3 text-sm text-text-secondary"
          : "flex items-start gap-2 rounded-lg border border-error-subtle bg-error-subtle px-4 py-3 text-sm text-text-secondary"
      }
    >
      {isSuccess ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
      )}
      <span>{message}</span>
      <button
        type="button"
        className="ml-auto text-text-muted hover:text-text"
        aria-label="Cerrar mensaje"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function toSettingsError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return "No pude guardar la configuracion. Intenta de nuevo.";
}

function isNudgePreferenceEnabled(
  preferences: DashboardNudgePreference[],
  nudgeType: DashboardNudgePreferenceType
): boolean {
  return (
    preferences.find((preference) => preference.nudge_type === nudgeType)
      ?.enabled ?? true
  );
}
