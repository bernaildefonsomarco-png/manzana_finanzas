import { z } from "zod";
import {
  CATEGORY_IDS,
  MOVEMENT_SOURCES,
  MOVEMENT_STATUSES,
  MOVEMENT_TYPES,
  PENDING_SOURCES,
  PENDING_STATUSES,
  PENDING_TYPES,
  RISK_LEVELS,
} from "@/shared/types/domain";

/** Moneda soportada. V1 opera en PEN; USD queda como base futura. */
export const CurrencySchema = z.enum(["PEN", "USD"]).default("PEN");
export type Currency = z.infer<typeof CurrencySchema>;

/**
 * Monto monetario en unidades menores para logica de dominio.
 * Ejemplo: S/12.50 -> 1250.
 */
export const MoneyAmountSchema = z
  .number()
  .int("El monto debe ser un numero entero en centavos")
  .nonnegative("El monto no puede ser negativo")
  .max(999_999_999_99, "Monto demasiado grande");

export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;

/** Monto con moneda. */
export const MoneySchema = z.object({
  amount: MoneyAmountSchema,
  currency: CurrencySchema,
});

export type Money = z.infer<typeof MoneySchema>;

/** Tipos de movimiento financiero. */
export const MovementTypeSchema = z.enum(MOVEMENT_TYPES);
export type MovementType = z.infer<typeof MovementTypeSchema>;

/** Estado de un movimiento: valores de 16_modelo_datos.md. */
export const MovementStatusSchema = z.enum(MOVEMENT_STATUSES);
export type MovementStatus = z.infer<typeof MovementStatusSchema>;

/** Estado de un pending item: valores de 16_modelo_datos.md. */
export const PendingStatusSchema = z.enum(PENDING_STATUSES);
export type PendingStatus = z.infer<typeof PendingStatusSchema>;

/** Fuente de un pending item antes de ser confirmado. */
export const PendingSourceSchema = z.enum(PENDING_SOURCES);
export type PendingSource = z.infer<typeof PendingSourceSchema>;

/** Tipo de pendiente dentro de la bandeja de revision. */
export const PendingTypeSchema = z.enum(PENDING_TYPES);
export type PendingType = z.infer<typeof PendingTypeSchema>;

/** Nivel de riesgo usado por policies y UI sensible. */
export const RiskLevelSchema = z.enum(RISK_LEVELS);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

/** Alias temporal para compatibilidad con imports existentes. */
export const PendingItemStatusSchema = PendingStatusSchema;
export type PendingItemStatus = PendingStatus;

/** Fuente de movimientos ya confirmados. */
export const MovementSourceSchema = z.enum(MOVEMENT_SOURCES);
export type MovementSource = z.infer<typeof MovementSourceSchema>;

export const CategoryIdSchema = z.enum(CATEGORY_IDS);
export type CategoryId = z.infer<typeof CategoryIdSchema>;

const NullableUuidSchema = z.string().uuid().nullable();

export function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}

/**
 * Monto decimal para movimientos persistidos en DB numeric(14,2).
 *
 * WEB-D197: solo "ajuste" puede ser negativo (el signo indica si el saldo
 * sube o baja); para el resto de tipos, `requireAmount` en
 * `balance-engine.ts` exige que sea mayor a cero. Este esquema solo
 * descarta cero y magnitudes/decimales invalidos, sin conocer el tipo.
 */
export const MovementDecimalAmountSchema = z
  .number()
  .finite()
  .refine((value) => value !== 0, "El monto no puede ser cero")
  .refine((value) => Math.abs(value) <= 999_999_999.99, "Monto demasiado grande")
  .refine(hasAtMostTwoDecimals, "El monto acepta maximo dos decimales");

export const MovementInputSchema = z.object({
  type: MovementTypeSchema,
  amount: MovementDecimalAmountSchema.nullable(),
  currency: CurrencySchema,
  occurred_at: z.string().datetime({ offset: true }),
  description: z.string().trim().min(1).max(280).nullable(),
  merchant: z.string().trim().min(1).max(160).nullable().default(null),
  category_id: CategoryIdSchema.nullable(),
  subcategory_id: NullableUuidSchema,
  account_origin_id: NullableUuidSchema,
  account_destination_id: NullableUuidSchema,
  box_origin_id: NullableUuidSchema,
  box_destination_id: NullableUuidSchema,
  related_person_id: NullableUuidSchema,
  debt_id: NullableUuidSchema,
  recurring_rule_id: NullableUuidSchema,
  recurring_occurrence_id: NullableUuidSchema.default(null),
  source: MovementSourceSchema,
  source_ref: z.string().trim().min(1).max(240).nullable(),
  confidence: z.number().min(0).max(1).nullable().default(null),
  requires_review: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type MovementInput = z.infer<typeof MovementInputSchema>;
