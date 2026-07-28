// Puerto de entrada y salida entre el nucleo y cualquier canal (21 S3-S7).
// Unico fichero de src/core/ que puede nombrar un canal concreto: WEB-D170,
// WEB-D171 lo eximen de sin-canal-en-el-nucleo (AC-INV-04) porque es el
// puerto mismo, no un fichero de negocio que conoce su canal.

// "dashboard" es el nombre que ya usan 28+ ficheros y una restriccion CHECK
// en la base de datos para "no WhatsApp" — 21 dice "la web" en prosa, pero
// no fija un literal de codigo, y renombrarlo a "web" exigiria una migracion
// de esquema fuera del alcance de esta auditoria (D-01). El puerto se alinea
// con el vocabulario que ya existe en vez de crear uno competidor.
export const CHANNELS = ["whatsapp", "dashboard"] as const;
export type Channel = (typeof CHANNELS)[number];

export type TurnAttachment = {
  kind: string;
  url: string;
};

export type TurnConfirmation = {
  commandId: string;
  accepted: boolean;
};

export type TurnContext = {
  where: string | null;
  filters: Record<string, unknown> | null;
  selected: string | null;
  visible: string[];
};

// canal esta aqui "solo para el registro, nunca para decidir" (21 S3).
export type TurnInput = {
  actor: "user";
  text: string | null;
  choice: string | null;
  confirmation: TurnConfirmation | null;
  attachments: TurnAttachment[];
  context: TurnContext;
  channel: Channel;
};

export type EvidenceReference = {
  kind: string;
  id: string;
};

export type BlockOption = {
  id: string;
  label: string;
};

// Vocabulario de 21 S5. kind es el discriminador; el resto de campos varia
// por bloque.
export type Block =
  | { kind: "texto"; text: string }
  | {
      kind: "cifra";
      text: string;
      amount: number;
      currency: "PEN" | "USD";
      references: EvidenceReference[];
    }
  | {
      kind: "lista";
      text: string;
      items: Array<{ label: string; references: EvidenceReference[] }>;
    }
  | { kind: "pregunta"; text: string; options: BlockOption[] }
  | {
      kind: "propuesta";
      text: string;
      commandId: string;
      options: BlockOption[];
    }
  | {
      kind: "previsualizacion";
      text: string;
      count: number;
      sample: string[];
      exclusions: string[];
    }
  | {
      kind: "hallazgo";
      text: string;
      level: "afirmacion" | "impresion";
      references: EvidenceReference[];
    }
  | {
      kind: "mostrar";
      what: "movimientos" | "deuda" | "presupuesto" | "pago" | "descubrimiento" | "reporte";
      which: string | null;
      filters: Record<string, unknown> | null;
      reason: string;
    }
  | { kind: "accion"; text: string; commandId: string }
  | { kind: "limite"; text: string; manualPath: string | null };

// Resultado generico de presentar un turno por el canal que corresponda:
// un adaptador de canal (WhatsApp, web) lo rellena; el nucleo solo lee estos
// campos para su propia telemetria, nunca decide con ellos (21 S6).
export type PresentedTurn = {
  text: string | null;
  deliveryMode: string | null;
  interactiveOptionCount: number | null;
  sendStatus: "sent" | "not_sent" | "failed" | "not_applicable";
  sendReason: string;
  idempotent: boolean;
  providerMessageId: string | null;
  errorCode: string | null;
  enhancement: {
    status: string;
    reason: string;
    confidence: number | null;
    provider: string | null;
    model: string | null;
    latencyMs: number | null;
    safetyFlags: string[];
    styleActive: boolean;
    styleScope: string | null;
    styleAdherence: string | null;
    styleBlockedReasons: string[];
    attemptCount: number;
  };
};

/**
 * 21 S5 regla 1 y 2: un bloque `cifra` sin referencias, o `propuesta` sin
 * comando ejecutable, no es valido y no llega a ningun presentador
 * (AC-CANAL-03, AC-CANAL-04).
 */
export function verifyBlocks(blocks: Block[]): Block[] {
  return blocks.filter((block) => {
    if (block.kind === "cifra") return block.references.length > 0;
    if (block.kind === "propuesta") return block.commandId.trim().length > 0;
    return true;
  });
}
