import type { ReminderKind } from "@/shared/types/domain";

// `46` `SCR-MAIL-02` — etiquetas visibles para "sigues recibiendo: …" tras
// una baja de un solo clic. Mismo texto que
// `src/features/reminders/reminder-preferences-screen.tsx` usa en
// configuración, para que el usuario reconozca el mismo nombre en los dos
// sitios.
export const REMINDER_LABELS: Record<ReminderKind, string> = {
  pago_proximo: "Pagos que vienen",
  pago_vencido: "Pagos vencidos",
  cuota_proxima: "Cuotas de deudas",
  cuota_vencida: "Cuotas vencidas",
  presupuesto_umbral: "Presupuesto en su límite",
  pendientes_acumulados: "Pendientes acumulados",
  sin_registrar: "Cuando no registras nada",
  correo_desconectado: "Cuando algo deja de funcionar",
  descarga_lista: "Tu descarga está lista",
  confirmar_hecho: "Confirmar un hecho detectado",
};
