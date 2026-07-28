// Lista de rutas conocidas de `10` §3.2, para validar el parámetro
// `redirigir` (`10` §8, `AC-NAV-07`): solo acepta destinos internos
// conocidos, nunca una URL absoluta — así se evita una redirección abierta.
const KNOWN_ROUTE_PREFIXES = [
  "/inicio",
  "/movimientos",
  "/pendientes",
  "/mi-dinero",
  "/presupuestos",
  "/deudas",
  "/pagos-que-vienen",
  "/descubrimientos",
  "/reportes",
  "/proyecciones",
  "/asistente",
  "/buscar",
  "/configuracion",
  "/recordatorios",
  "/bienvenida",
];

/**
 * `true` solo si `value` es una ruta interna conocida: empieza con `/`
 * (no `//`, que el navegador trata como protocolo-relativo), no contiene un
 * esquema (`https:`, `javascript:`) y su primer segmento está en la lista.
 */
export function isKnownInternalRoute(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  return KNOWN_ROUTE_PREFIXES.some(
    (prefix) => value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`)
  );
}
