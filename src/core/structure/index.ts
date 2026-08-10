export {
  STRUCTURE_ENTITIES,
  STRUCTURE_OPERATIONS,
  StructureCommandSchema,
  CreateBoxPayloadSchema,
  UpdateBoxPayloadSchema,
  CreateGoalPayloadSchema,
  UpdateGoalPayloadSchema,
  CreateBudgetPayloadSchema,
  UpdateBudgetPayloadSchema,
  entityForCommandType,
  operationForCommandType,
  type StructureCommand,
  type StructureCommandType,
  type StructureEntity,
  type StructureOperation,
} from "./structure-commands";

export {
  STRUCTURE_CANCEL_COMMAND_ID,
  StructureProposalSchema,
  buildStructureCommandFromProposal,
  buildStructureCommandText,
  entityLabel,
  isStructureCommandText,
  parseStructureCommandText,
  type ParsedStructureCommand,
  type StructureProposal,
} from "./structure-proposal";

export {
  composeStructureAmbiguityQuestion,
  readStructureIntent,
  structureProposalConflictsWithIntent,
  type StructureIntentReading,
} from "./structure-intent";

export {
  compileStructureProposal,
  type CompiledStructureProposal,
} from "./structure-proposal-compiler";

export {
  executeStructureCommand,
  type StructureExecutionResult,
} from "./structure-executor";

export {
  STRUCTURE_CONFIRMATION_TTL_MS,
  lapsedStructureResolution,
  maybeResolveStructure,
  readStoredStructureProposal,
  resolveAwaitingStructure,
  type AwaitingStructureResolution,
  type StructureResolutionResult,
} from "./structure-resolution";
