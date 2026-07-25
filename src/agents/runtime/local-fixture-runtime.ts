import { LocalFixtureDataAgentRuntime } from "@/agents/data-agent/local-fixture-runtime";
import { LocalFixtureEmailExtractionAgentRuntime } from "@/agents/email-extraction-agent/local-fixture-runtime";
import { LocalFixtureConversationAgentRuntime } from "@/agents/conversation-agent/local-fixture-runtime";
import { LocalFixtureResponseAgentRuntime } from "@/agents/response-agent/local-fixture-runtime";
import { LocalFixtureOrchestrationPlanningAgentRuntime } from "@/agents/orchestration-planning-agent/local-fixture-runtime";
import { LocalFixtureLearningSignalAgentRuntime } from "@/agents/learning-signal-agent/local-fixture-runtime";
import { LocalFixtureRiskSignalAgentRuntime } from "@/agents/risk-signal-agent/local-fixture-runtime";
import { LocalFixtureDedupSignalAgentRuntime } from "@/agents/dedup-signal-agent/local-fixture-runtime";
import { LocalFixtureDisclosureExperienceAgentRuntime } from "@/agents/disclosure-experience-agent/local-fixture-runtime";
import { LocalFixtureRecurringSignalAgentRuntime } from "@/agents/recurring-signal-agent/local-fixture-runtime";
import { LocalFixtureNudgeExperienceAgentRuntime } from "@/agents/nudge-experience-agent/local-fixture-runtime";
import { LocalFixtureInsightExperienceAgentRuntime } from "@/agents/insight-experience-agent/local-fixture-runtime";
import { LocalFixtureInsightNarratorAgentRuntime } from "@/agents/insight-narrator-agent/local-fixture-runtime";
import { LocalFixtureConversationalExecutiveAgentRuntime } from "@/agents/conversational-executive-agent/local-fixture-runtime";
import {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "./types";

export class LocalFixtureAgentRuntime implements AgentRuntime {
  private readonly conversationalExecutiveAgent =
    new LocalFixtureConversationalExecutiveAgentRuntime();
  private readonly dataAgent = new LocalFixtureDataAgentRuntime();
  private readonly emailExtractionAgent =
    new LocalFixtureEmailExtractionAgentRuntime();
  private readonly conversationAgent = new LocalFixtureConversationAgentRuntime();
  private readonly responseAgent = new LocalFixtureResponseAgentRuntime();
  private readonly orchestrationPlanningAgent =
    new LocalFixtureOrchestrationPlanningAgentRuntime();
  private readonly learningSignalAgent =
    new LocalFixtureLearningSignalAgentRuntime();
  private readonly riskSignalAgent = new LocalFixtureRiskSignalAgentRuntime();
  private readonly dedupSignalAgent = new LocalFixtureDedupSignalAgentRuntime();
  private readonly disclosureExperienceAgent =
    new LocalFixtureDisclosureExperienceAgentRuntime();
  private readonly recurringSignalAgent =
    new LocalFixtureRecurringSignalAgentRuntime();
  private readonly nudgeExperienceAgent =
    new LocalFixtureNudgeExperienceAgentRuntime();
  private readonly insightExperienceAgent =
    new LocalFixtureInsightExperienceAgentRuntime();
  private readonly insightNarratorAgent =
    new LocalFixtureInsightNarratorAgentRuntime();

  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>
  ): Promise<AgentRuntimeResponse<TOutput>> {
    if (request.agent_name === "conversational_executive_agent") {
      return this.conversationalExecutiveAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    if (request.agent_name === "data_agent") {
      return this.dataAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    if (request.agent_name === "email_extraction_agent") {
      return this.emailExtractionAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    if (request.agent_name === "response_agent") {
      return this.responseAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    if (request.agent_name === "conversation_agent") {
      return this.conversationAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    if (request.agent_name === "orchestration_planning_agent") {
      return this.orchestrationPlanningAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    if (request.agent_name === "learning_signal_agent") {
      return this.learningSignalAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    if (request.agent_name === "risk_signal_agent") {
      return this.riskSignalAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    if (request.agent_name === "dedup_signal_agent") {
      return this.dedupSignalAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    if (request.agent_name === "disclosure_experience_agent") {
      return this.disclosureExperienceAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    if (request.agent_name === "recurring_signal_agent") {
      return this.recurringSignalAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    if (request.agent_name === "nudge_experience_agent") {
      return this.nudgeExperienceAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    if (request.agent_name === "insight_experience_agent") {
      return this.insightExperienceAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    if (request.agent_name === "insight_narrator_agent") {
      return this.insightNarratorAgent.run<TContext, TOutput>({
        ...request,
        provider: "local_fixture",
      });
    }

    throw new Error(
      `LocalFixtureAgentRuntime no soporta ${request.agent_name} todavia.`
    );
  }
}
