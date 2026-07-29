// Envoltorio compartido del envelope `{ok,data,meta}`/`{ok,error,meta}` de
// `14_contratos_api_web.md` §3. Vivía duplicado dentro de cada
// `features/**/*-api.ts` condenado (`REEMPLAZAR`, `WEB-D164`); el código
// nuevo fuera de `features/` no debe importar de un árbol que va a
// desaparecer, así que este es el único lugar que lo declara para las
// pantallas de módulo que W-08 en adelante construye.

export type ApiResponse<T> =
  | {
      ok: true;
      data: T;
      meta: { trace_id: string };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
      meta: { trace_id: string };
    };

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly traceId: string | null,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null,
      payload.error.details
    );
  }

  return payload.data;
}

export function clientIdempotencyKey(action: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${action}:${random}`;
}
