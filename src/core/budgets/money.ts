export function moneyToCents(value: number, field = "monto"): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${field} debe ser finito.`);
  }
  return Math.round(value * 100);
}

export function centsToMoney(value: number): number {
  return value / 100;
}

export function requirePositiveMoney(value: number, field = "monto"): number {
  const cents = moneyToCents(value, field);
  if (cents <= 0) {
    throw new Error(`${field} debe ser mayor que cero.`);
  }
  return cents;
}

export function requireNonNegativeMoney(
  value: number,
  field = "monto"
): number {
  const cents = moneyToCents(value, field);
  if (cents < 0) {
    throw new Error(`${field} no puede ser negativo.`);
  }
  return cents;
}
