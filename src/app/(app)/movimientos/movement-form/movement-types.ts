import type { MovementType } from "@/shared/types/domain";
import { movementTypeLabels } from "@/features/movements/movement-view-model";

export type MovementFormGroup = "generic" | "debt_origination" | "debt_payment";

export const MOVEMENT_TYPE_GROUP: Record<MovementType, MovementFormGroup> = {
  gasto: "generic",
  ingreso: "generic",
  transferencia: "generic",
  asignacion_interna: "generic",
  ajuste: "generic",
  pago_recurrente: "generic",
  deuda_adquirida: "debt_origination",
  prestamo_dado: "debt_origination",
  prestamo_recibido: "debt_origination",
  pago_deuda: "debt_payment",
  devolucion_recibida: "debt_payment",
};

// Reusa las etiquetas ya rescatadas de la pantalla condenada (`WEB-D164`,
// `RUL-INV-01`): no se duplica el vocabulario de tipos dos veces.
export const MOVEMENT_TYPE_LABEL = movementTypeLabels;

// `26` §8 `SCR-MOV-03`: selector de tipo primero. Los tres primeros son los
// que hoy ya se guardaban (`C-05`); el resto es lo que este corte cierra.
export const MOVEMENT_TYPE_ORDER: MovementType[] = [
  "gasto",
  "ingreso",
  "transferencia",
  "asignacion_interna",
  "pago_deuda",
  "prestamo_dado",
  "prestamo_recibido",
  "devolucion_recibida",
  "deuda_adquirida",
  "pago_recurrente",
  "ajuste",
];

// `RUL-MOV-01`: los tipos con pantalla especializada pueden ofrecerla como
// atajo, nunca como unica via.
export const MOVEMENT_TYPE_SPECIALIZED_LINK: Partial<
  Record<MovementType, { href: string; label: string }>
> = {
  deuda_adquirida: { href: "/deudas", label: "¿Prefieres registrarlo desde Deudas?" },
  prestamo_dado: { href: "/deudas", label: "¿Prefieres registrarlo desde Deudas?" },
  prestamo_recibido: { href: "/deudas", label: "¿Prefieres registrarlo desde Deudas?" },
  pago_deuda: { href: "/deudas", label: "¿Prefieres registrarlo desde Deudas?" },
  devolucion_recibida: { href: "/deudas", label: "¿Prefieres registrarlo desde Deudas?" },
  pago_recurrente: {
    href: "/pagos-que-vienen",
    label: "¿Prefieres confirmarlo desde Pagos que vienen?",
  },
};
