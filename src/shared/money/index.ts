import type { Currency, Money, MoneyAmount } from "@/shared/schemas/money";

/**
 * Convierte una cantidad en soles (decimal) a centavos (entero).
 * Ejemplo: toCents(12.50) → 1250
 */
export function toCents(amount: number): MoneyAmount {
  return Math.round(amount * 100);
}

/**
 * Convierte centavos (entero) a soles (decimal).
 * Ejemplo: fromCents(1250) → 12.5
 */
export function fromCents(cents: MoneyAmount): number {
  return cents / 100;
}

/**
 * Formatea un monto en centavos como string para mostrar en UI.
 * Ejemplo: formatMoney(1250) → "S/12.50"
 *          formatMoney(1250, { showDecimals: false }) → "S/12"
 */
export function formatMoney(
  cents: MoneyAmount,
  options: {
    currency?: Currency;
    showDecimals?: boolean;
    showCurrencySymbol?: boolean;
  } = {}
): string {
  const {
    currency = "PEN",
    showDecimals = true,
    showCurrencySymbol = true,
  } = options;

  const value = fromCents(cents);
  const prefix = currency === "PEN" ? "S/" : "$";
  const symbol = showCurrencySymbol ? prefix : "";

  if (!showDecimals && cents % 100 === 0) {
    return `${symbol}${value.toFixed(0)}`;
  }

  return `${symbol}${value.toFixed(2)}`;
}

/**
 * Suma dos montos en centavos del mismo tipo.
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(
      `No se pueden sumar monedas distintas: ${a.currency} y ${b.currency}`
    );
  }
  return { amount: a.amount + b.amount, currency: a.currency };
}

/**
 * Resta b de a (ambos en la misma moneda).
 * Devuelve el resultado sin importar el signo — el negativo indica déficit.
 */
export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(
      `No se pueden restar monedas distintas: ${a.currency} y ${b.currency}`
    );
  }
  return { amount: a.amount - b.amount, currency: a.currency };
}

/** Crea un objeto Money en PEN desde centavos. */
export function pen(cents: MoneyAmount): Money {
  return { amount: cents, currency: "PEN" };
}
