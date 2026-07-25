import type {
  WhatsAppWindowState,
  WhatsAppWindowStatus,
} from "@/data/repositories/whatsapp-window.repository";

const HOUR_MS = 60 * 60 * 1000;
const WINDOW_DURATION_HOURS = 24;
const CLOSING_SOON_HOURS_REMAINING = 12;
const CONTINUATION_PROMPT_AFTER_HOURS = 12;
const FINAL_PROMPT_AFTER_HOURS = 20;

export type WhatsAppDeliveryIntent =
  | "direct_response"
  | "pending_confirmation"
  | "nudge"
  | "insight"
  | "reengagement";

export type WhatsAppDeliveryMode =
  | "freeform"
  | "interactive"
  | "template"
  | "app_only"
  | "blocked";

export type WhatsAppDeliveryPlan = {
  mode: WhatsAppDeliveryMode;
  windowStatus: WhatsAppWindowStatus;
  hoursUntilClose: number | null;
  requiresPaidTemplate: boolean;
  reason:
    | "user_initiated_response"
    | "window_open"
    | "window_closed_template_allowed"
    | "no_actionable_value"
    | "whatsapp_opt_in_missing"
    | "quiet_hours"
    | "sensitive_copy_not_prepared"
    | "paid_template_cap_reached";
};

export type WhatsAppContinuationMilestone =
  | "continuation_12h"
  | "final_20h";

export type WhatsAppDeliveryPlanningInput = {
  state: WhatsAppWindowState | null;
  intent: WhatsAppDeliveryIntent;
  hasActionableValue: boolean;
  userInitiatedResponse?: boolean;
  preferInteractive?: boolean;
  whatsappOptIn?: boolean;
  quietHoursActive?: boolean;
  isSensitive?: boolean;
  discreetCopyPrepared?: boolean;
  maxPaidTemplatesPerDay?: number;
  maxPaidTemplatesPerMonth?: number;
  now?: Date;
};

export type WhatsAppContinuationPromptInput = {
  state: WhatsAppWindowState | null;
  hasActionableValue: boolean;
  quietHoursActive?: boolean;
  allowOptional20hPrompt?: boolean;
  allowSecondPromptAfterContinuation?: boolean;
  now?: Date;
};

export function planWhatsAppDelivery(
  input: WhatsAppDeliveryPlanningInput
): WhatsAppDeliveryPlan {
  const now = input.now ?? new Date();
  const windowStatus = resolveWhatsAppWindowStatus(input.state, now);
  const hoursUntilClose = getHoursUntilWindowClose(input.state, now);
  const preferInteractive = Boolean(input.preferInteractive);

  if (input.userInitiatedResponse) {
    return {
      mode: preferInteractive ? "interactive" : "freeform",
      windowStatus: "open",
      hoursUntilClose: WINDOW_DURATION_HOURS,
      requiresPaidTemplate: false,
      reason: "user_initiated_response",
    };
  }

  if (input.quietHoursActive) {
    return blockedPlan(windowStatus, hoursUntilClose, "quiet_hours");
  }

  if (windowStatus === "open" || windowStatus === "closing_soon") {
    return {
      mode: preferInteractive ? "interactive" : "freeform",
      windowStatus,
      hoursUntilClose,
      requiresPaidTemplate: false,
      reason: "window_open",
    };
  }

  if (!input.hasActionableValue) {
    return appOnlyPlan(windowStatus, hoursUntilClose, "no_actionable_value");
  }

  if (!input.whatsappOptIn) {
    return appOnlyPlan(windowStatus, hoursUntilClose, "whatsapp_opt_in_missing");
  }

  if (input.isSensitive && !input.discreetCopyPrepared) {
    return blockedPlan(
      windowStatus,
      hoursUntilClose,
      "sensitive_copy_not_prepared"
    );
  }

  if (paidTemplateCapReached(input)) {
    return appOnlyPlan(windowStatus, hoursUntilClose, "paid_template_cap_reached");
  }

  return {
    mode: "template",
    windowStatus,
    hoursUntilClose,
    requiresPaidTemplate: true,
    reason: "window_closed_template_allowed",
  };
}

export function getContinuationPromptMilestone(
  input: WhatsAppContinuationPromptInput
): WhatsAppContinuationMilestone | null {
  const state = input.state;
  if (!state || !state.last_user_message_at) return null;
  if (!input.hasActionableValue || input.quietHoursActive) return null;

  const now = input.now ?? new Date();
  const status = resolveWhatsAppWindowStatus(state, now);
  if (status === "closed") return null;

  const hoursSinceLastUserMessage = getHoursSince(
    state.last_user_message_at,
    now
  );

  if (
    hoursSinceLastUserMessage >= FINAL_PROMPT_AFTER_HOURS &&
    input.allowOptional20hPrompt &&
    !state.last_window_final_prompt_at &&
    (!state.last_window_continuation_prompt_at ||
      input.allowSecondPromptAfterContinuation)
  ) {
    return "final_20h";
  }

  if (
    hoursSinceLastUserMessage >= CONTINUATION_PROMPT_AFTER_HOURS &&
    hoursSinceLastUserMessage < FINAL_PROMPT_AFTER_HOURS &&
    !state.last_window_continuation_prompt_at
  ) {
    return "continuation_12h";
  }

  return null;
}

export function resolveWhatsAppWindowStatus(
  state: WhatsAppWindowState | null,
  now: Date = new Date()
): WhatsAppWindowStatus {
  if (!state?.window_expires_at) return "closed";

  const hoursUntilClose = getHoursUntilWindowClose(state, now);
  if (hoursUntilClose === null || hoursUntilClose <= 0) return "closed";
  if (hoursUntilClose <= CLOSING_SOON_HOURS_REMAINING) return "closing_soon";
  return "open";
}

export function getHoursUntilWindowClose(
  state: WhatsAppWindowState | null,
  now: Date = new Date()
): number | null {
  if (!state?.window_expires_at) return null;
  return (
    (new Date(state.window_expires_at).getTime() - now.getTime()) / HOUR_MS
  );
}

export function buildWindowExpiresAt(receivedAt: string | Date): string {
  const date = typeof receivedAt === "string" ? new Date(receivedAt) : receivedAt;
  return new Date(date.getTime() + WINDOW_DURATION_HOURS * HOUR_MS).toISOString();
}

function paidTemplateCapReached(input: WhatsAppDeliveryPlanningInput): boolean {
  const state = input.state;
  if (!state) return false;

  const dailyCap = input.maxPaidTemplatesPerDay ?? 2;
  const monthlyCap = input.maxPaidTemplatesPerMonth ?? 20;

  return (
    state.paid_templates_today >= dailyCap ||
    state.paid_templates_this_month >= monthlyCap
  );
}

function appOnlyPlan(
  windowStatus: WhatsAppWindowStatus,
  hoursUntilClose: number | null,
  reason: WhatsAppDeliveryPlan["reason"]
): WhatsAppDeliveryPlan {
  return {
    mode: "app_only",
    windowStatus,
    hoursUntilClose,
    requiresPaidTemplate: false,
    reason,
  };
}

function blockedPlan(
  windowStatus: WhatsAppWindowStatus,
  hoursUntilClose: number | null,
  reason: WhatsAppDeliveryPlan["reason"]
): WhatsAppDeliveryPlan {
  return {
    mode: "blocked",
    windowStatus,
    hoursUntilClose,
    requiresPaidTemplate: false,
    reason,
  };
}

function getHoursSince(date: string, now: Date): number {
  return (now.getTime() - new Date(date).getTime()) / HOUR_MS;
}
