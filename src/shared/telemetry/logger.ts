/**
 * Logger estructurado base para Manzana.
 *
 * Reglas:
 * - No loguear montos, comercios ni personas en texto plano.
 * - No loguear tokens OAuth ni credenciales.
 * - Usar trace_id en cada operación financiera o de agente.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = {
  trace_id?: string;
  user_id?: string;
  operation?: string;
  [key: string]: unknown;
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  const env = process.env.APP_ENV ?? "local";
  if (env === "production" || env === "staging") return "info";
  return "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getMinLevel()];
}

function formatEntry(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    env: process.env.APP_ENV ?? "local",
    ...context,
  };
  return JSON.stringify(entry);
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const line = formatEntry(level, message, context);

  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(message: string, context?: LogContext) {
    emit("debug", message, context);
  },
  info(message: string, context?: LogContext) {
    emit("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    emit("warn", message, context);
  },
  error(message: string, context?: LogContext & { error?: unknown }) {
    const { error, ...rest } = context ?? {};
    const errorInfo =
      error instanceof Error
        ? { error_message: error.message, error_name: error.name }
        : error != null
        ? { error_raw: String(error) }
        : {};

    emit("error", message, { ...rest, ...errorInfo });
  },
};

/** Crea un logger hijo con contexto pre-inyectado. */
export function createLogger(baseContext: LogContext) {
  return {
    debug(message: string, ctx?: LogContext) {
      logger.debug(message, { ...baseContext, ...ctx });
    },
    info(message: string, ctx?: LogContext) {
      logger.info(message, { ...baseContext, ...ctx });
    },
    warn(message: string, ctx?: LogContext) {
      logger.warn(message, { ...baseContext, ...ctx });
    },
    error(message: string, ctx?: LogContext & { error?: unknown }) {
      logger.error(message, { ...baseContext, ...ctx });
    },
  };
}
