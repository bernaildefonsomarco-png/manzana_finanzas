/**
 * `40` §7.1: los cuatro comandos de dinero entre cuentas y cajas exigen
 * "efecto previo" en su tarjeta de confirmacion. Este texto no lo redacta el
 * modelo — es deterministico y se antepone a la pregunta del turno, mismo
 * contrato que `debt-action-consequences.ts`.
 *
 * `freeBalanceAfter`/`boxBalanceAfter` llegan en `null` cuando el llamador no
 * cargo el saldo (por ejemplo, en un test que no lo necesita): la frase se
 * degrada sin el, en vez de mostrar un numero inventado.
 */

export function describeTransferConsequence(input: {
  fromAccountName: string;
  toAccountName: string;
  amount: number;
  currency: "PEN" | "USD";
  freeBalanceAfter: number | null;
}): string {
  const cifra = formatMoneyActionAmount(input.amount, input.currency);
  const resto =
    input.freeBalanceAfter !== null
      ? ` ${input.fromAccountName} quedará con ${formatMoneyActionAmount(
          input.freeBalanceAfter,
          input.currency,
        )} libres.`
      : "";
  return `Vas a transferir ${cifra} de ${input.fromAccountName} a ${input.toAccountName}.${resto}`;
}

export function describeSeparateToBoxConsequence(input: {
  boxName: string;
  accountName: string;
  amount: number;
  currency: "PEN" | "USD";
  freeBalanceAfter: number | null;
}): string {
  const cifra = formatMoneyActionAmount(input.amount, input.currency);
  const resto =
    input.freeBalanceAfter !== null
      ? ` Te van a quedar ${formatMoneyActionAmount(
          input.freeBalanceAfter,
          input.currency,
        )} libres en ${input.accountName}.`
      : "";
  return `Vas a separar ${cifra} en ${input.boxName}.${resto}`;
}

export function describeReleaseFromBoxConsequence(input: {
  boxName: string;
  accountName: string;
  amount: number;
  currency: "PEN" | "USD";
  boxBalanceAfter: number;
}): string {
  const cifra = formatMoneyActionAmount(input.amount, input.currency);
  return `Vas a devolver ${cifra} de la caja ${input.boxName} a tu libre en ${input.accountName}. La caja quedará con ${formatMoneyActionAmount(input.boxBalanceAfter, input.currency)}.`;
}

export function describeMoveBoxToBoxConsequence(input: {
  originBoxName: string;
  destinationBoxName: string;
  amount: number;
  currency: "PEN" | "USD";
  originBoxBalanceAfter: number;
}): string {
  const cifra = formatMoneyActionAmount(input.amount, input.currency);
  return `Vas a mover ${cifra} de ${input.originBoxName} a ${input.destinationBoxName}. ${input.originBoxName} quedará con ${formatMoneyActionAmount(input.originBoxBalanceAfter, input.currency)}.`;
}

export function formatMoneyActionAmount(
  amount: number,
  currency: "PEN" | "USD",
): string {
  const symbol = currency === "USD" ? "$" : "S/";
  return `${symbol}${amount.toFixed(2)}`;
}
