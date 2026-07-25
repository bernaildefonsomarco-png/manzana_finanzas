import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { OutboxHandler } from "@/workers/outbox/outbox-publisher";
import { createDebtLifecycleHandler } from "./handlers/debt-lifecycle-handler";
import { createEmailPendingWhatsAppHandler } from "./handlers/email-pending-whatsapp-handler";
import { createGmailIngestionHandler } from "./handlers/gmail-ingestion-handler";
import { createInsightLifecycleHandler } from "./handlers/insight-lifecycle-handler";
import { createLearningEvidenceHandler } from "./handlers/learning-evidence-handler";
import { createOnboardingActivationHandler } from "./handlers/onboarding-activation-handler";
import { createWhatsAppOrchestrationHandler } from "./handlers/whatsapp-orchestration-handler";

type Client = SupabaseClient<Database>;

export function createDefaultOutboxHandlers(client: Client): OutboxHandler[] {
  return [
    createWhatsAppOrchestrationHandler(client),
    createGmailIngestionHandler(client),
    createEmailPendingWhatsAppHandler(client),
    createDebtLifecycleHandler(client),
    createInsightLifecycleHandler(client),
    createLearningEvidenceHandler(client),
    createOnboardingActivationHandler(client),
  ];
}
