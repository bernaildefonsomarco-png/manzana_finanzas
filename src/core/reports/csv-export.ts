// RUL-REP-10: formato del CSV especificado para que no haya que adivinar.

const CSV_COLUMNS = [
  "fecha",
  "tipo",
  "descripcion",
  "monto",
  "moneda",
  "categoria",
  "subcategoria",
  "cuenta",
  "caja",
  "etiquetas",
  "origen",
  "estado",
  "id_movimiento",
] as const;

export type CsvMovementRow = {
  fecha: string; // ISO 8601, AAAA-MM-DD
  tipo: string;
  descripcion: string | null;
  monto: number; // con signo: negativo = salida, positivo = entrada
  moneda: string;
  categoria: string | null;
  subcategoria: string | null;
  cuenta: string | null;
  caja: string | null;
  etiquetas: string[];
  origen: string;
  estado: string;
  id_movimiento: string;
};

function escapeCsvField(value: string): string {
  // RFC 4180: comillas dobles, duplicadas para escapar.
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const BOM = "﻿";
const CRLF = "\r\n";

export function buildMovementsCsv(rows: CsvMovementRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const lines = rows.map((row) =>
    [
      row.fecha,
      row.tipo,
      row.descripcion ?? "",
      row.monto.toFixed(2),
      row.moneda,
      row.categoria ?? "",
      row.subcategoria ?? "",
      row.cuenta ?? "",
      row.caja ?? "",
      row.etiquetas.join("|"),
      row.origen,
      row.estado,
      row.id_movimiento,
    ]
      .map((field) => escapeCsvField(String(field)))
      .join(","),
  );
  return BOM + [header, ...lines].join(CRLF) + CRLF;
}

export function exportFileName(kind: "movimientos" | "datos_completos", from?: string, to?: string): string {
  if (kind === "datos_completos") return "manzana-todos-mis-datos.json";
  if (from && to) return `manzana-movimientos-${from}-a-${to}.csv`;
  return "manzana-movimientos.csv";
}
