import { describe, expect, it } from "vitest";
import {
  applyInsightFeedbackPenalty,
  isInsightPastExpiry,
  isNarrationFactSafe,
  shouldSuppressInsightDraft,
} from "./insights.repository";
import type { InsightDraft } from "@/core/insights/insight-engine";
import type { InsightCandidate } from "@/shared/types/domain";

const draft: InsightDraft = {
  type: "comparative",
  fingerprint: "comparative:weekly:2026-07-12",
  periodStart: "2026-07-12",
  periodEnd: "2026-07-18",
  confidence: 0.9,
  qualityScore: 80,
  rankScore: 82,
  riskLevel: "low",
  title: "Esta semana tus gastos subieron",
  body: "El cambio es visible frente a los siete dias anteriores.",
  evidenceText: "S/120.00 frente a S/80.00 (+50%)",
  evidence: {},
  sourceFacts: {
    current_total: 120,
    baseline_total: 80,
    change_percent: 50,
  },
  sourceEntityIds: [],
  action: null,
  expiresAt: "2026-07-20T00:00:00.000Z",
  metadata: {},
};

describe("isNarrationFactSafe", () => {
  it("acepta copy que conserva exclusivamente hechos permitidos", () => {
    expect(
      isNarrationFactSafe(
        {
          title: "Tus gastos subieron esta semana",
          body: "El cambio fue de 50% frente al periodo anterior.",
          evidence_text: "S/120 frente a S/80",
          preserved_fact_keys: [
            "current_total",
            "baseline_total",
            "change_percent",
          ],
        },
        draft,
      ),
    ).toBe(true);
  });

  it("rechaza cifras inventadas por el narrador", () => {
    expect(
      isNarrationFactSafe(
        {
          title: "Tus gastos subieron",
          body: "Proyectamos que llegaras a S/900.",
          evidence_text: "S/120 frente a S/80",
          preserved_fact_keys: ["current_total", "baseline_total"],
        },
        draft,
      ),
    ).toBe(false);
  });

  it("rechaza claves de hechos que el motor no entrego", () => {
    expect(
      isNarrationFactSafe(
        {
          title: draft.title,
          body: draft.body,
          evidence_text: draft.evidenceText,
          preserved_fact_keys: ["merchant_name"],
        },
        draft,
      ),
    ).toBe(false);
  });
});

describe("insight feedback lifecycle", () => {
  const now = new Date("2026-07-18T17:00:00.000Z");

  it("expira por reloj solo cuando existe una fecha vencida", () => {
    expect(isInsightPastExpiry(feedbackCandidate({ expires_at: null }), now)).toBe(false);
    expect(
      isInsightPastExpiry(
        feedbackCandidate({ expires_at: "2026-07-18T16:59:59.000Z" }),
        now,
      ),
    ).toBe(true);
  });

  it("no revive un descubrimiento descartado con los mismos hechos", () => {
    expect(
      shouldSuppressInsightDraft(
        draft,
        [feedbackCandidate({ status: "dismissed" })],
        now,
      ),
    ).toBe(true);
  });

  it("permite una nueva version cuando los hechos cambiaron materialmente", () => {
    const changedDraft: InsightDraft = {
      ...draft,
      sourceFacts: { ...draft.sourceFacts, current_total: 170 },
    };
    expect(
      shouldSuppressInsightDraft(
        changedDraft,
        [feedbackCandidate({ status: "dismissed" })],
        now,
      ),
    ).toBe(false);
  });

  it("enfria ignorados recientes y penaliza descartes del mismo tipo", () => {
    const ignored = feedbackCandidate({ status: "ignored" });
    expect(shouldSuppressInsightDraft(draft, [ignored], now)).toBe(true);

    const first = feedbackCandidate({
      id: "insight-dismissed-1",
      fingerprint: "comparative:other:1",
      status: "dismissed",
    });
    const penalized = applyInsightFeedbackPenalty(draft, [first], now);
    expect(penalized.rankScore).toBe(70);
    expect(penalized.metadata).toMatchObject({ feedback_penalty: 12 });
  });

  it("suprime baja prioridad tras dos descartes del mismo tipo", () => {
    const feedback = [
      feedbackCandidate({
        id: "insight-dismissed-1",
        fingerprint: "comparative:other:1",
        status: "dismissed",
      }),
      feedbackCandidate({
        id: "insight-dismissed-2",
        fingerprint: "comparative:other:2",
        status: "dismissed",
      }),
    ];
    expect(shouldSuppressInsightDraft(draft, feedback, now)).toBe(true);
    expect(
      shouldSuppressInsightDraft({ ...draft, rankScore: 92 }, feedback, now),
    ).toBe(false);
  });
});

function feedbackCandidate(
  overrides: Partial<InsightCandidate> = {},
): InsightCandidate {
  return {
    id: "insight-feedback-1",
    user_id: "11111111-1111-4111-8111-111111111111",
    type: draft.type,
    fingerprint: draft.fingerprint,
    status: "dismissed",
    period_start: draft.periodStart,
    period_end: draft.periodEnd,
    confidence: draft.confidence,
    quality_score: draft.qualityScore,
    rank_score: draft.rankScore,
    risk_level: draft.riskLevel,
    title: draft.title,
    body: draft.body,
    evidence_text: draft.evidenceText,
    evidence: draft.evidence,
    source_facts: draft.sourceFacts,
    source_entity_ids: [],
    action: null,
    expires_at: null,
    narrated_at: null,
    displayed_at: null,
    outdated_at: null,
    metadata: {},
    created_at: "2026-07-18T12:00:00.000Z",
    updated_at: "2026-07-18T12:00:00.000Z",
    ...overrides,
  };
}
