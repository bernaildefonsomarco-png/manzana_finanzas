export {
  STRUCTURE_ENTITIES,
  STRUCTURE_OPERATIONS,
  STRUCTURE_COMMAND_TYPES,
  DESTRUCTIVE_STRUCTURE_OPERATIONS,
  StructureCommandSchema,
  StructureCommandTypeSchema,
  CreateBoxPayloadSchema,
  UpdateBoxPayloadSchema,
  ArchiveBoxPayloadSchema,
  CreateGoalPayloadSchema,
  UpdateGoalPayloadSchema,
  GoalLifecyclePayloadSchema,
  CreateBudgetPayloadSchema,
  UpdateBudgetPayloadSchema,
  BudgetLifecyclePayloadSchema,
  CreateRecurringPayloadSchema,
  UpdateRecurringPayloadSchema,
  RecurringLifecyclePayloadSchema,
  CreateAccountPayloadSchema,
  UpdateAccountPayloadSchema,
  AccountLifecyclePayloadSchema,
  commandTypeFor,
  entityForCommandType,
  isDestructiveStructureOperation,
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
  entityArticle,
  entityLabel,
  isStructureCommandText,
  parseStructureCommandText,
  type ParsedStructureCommand,
  type StructureProposal,
} from "./structure-proposal";

export { describeStructureLoss } from "./structure-consequences";

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

export { executeStructureCommand } from "./structure-executor";
export type { StructureExecutionResult } from "./structure-execution-result";

export {
  STRUCTURE_CONFIRMATION_TTL_MS,
  lapsedStructureResolution,
  maybeResolveStructure,
  readStoredStructureProposal,
  resolveAwaitingStructure,
  type AwaitingStructureResolution,
  type StructureResolutionResult,
} from "./structure-resolution";
