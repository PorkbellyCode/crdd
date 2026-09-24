/**
 * 문항 진행 상태 머신 — 순수 함수. 채점(LLM)과 저장(DB)은 여기 없다.
 *
 *   first ──틀림──▶ hint ──틀림──▶ explanation ──틀림──▶ unresolved (0.0)
 *     │맞음           │맞음              │맞음
 *     ▼               ▼                  ▼
 *  first_try(1.0)  after_hint(0.6)  after_explanation(0.3)
 *
 * "모르겠어요"는 틀린 답과 같게 한 단계 넘긴다. 재시도 횟수 상한은 단계당 1회 —
 * 같은 단계에서 여러 번 찍어 맞히는 걸 막는다.
 */
import type { AnswerOutcome } from "@/lib/crdd/types";
import type { QuestionProgress, QuizAttempt, QuizStage } from "./types";

const PASS_OUTCOME: Record<QuizStage, AnswerOutcome> = {
  first: "first_try",
  hint: "after_hint",
  explanation: "after_explanation",
};

const NEXT_STAGE: Record<QuizStage, QuizStage | null> = {
  first: "hint",
  hint: "explanation",
  explanation: null,
};

export function initialProgress(count: number): QuestionProgress[] {
  return Array.from({ length: count }, () => ({
    stage: "first" as const,
    attempts: [],
    outcome: null,
    hint: null,
    explanation: null,
  }));
}

/** 아직 결과가 없는 첫 문항. 모두 끝났으면 -1 */
export function currentIndex(progress: QuestionProgress[]): number {
  return progress.findIndex((p) => p.outcome === null);
}

export function isFinished(progress: QuestionProgress[]): boolean {
  return progress.length > 0 && currentIndex(progress) === -1;
}

export interface Verdict {
  passed: boolean;
  feedback: string;
  /** 채점기가 이 답변에 맞춰 만든 힌트 (틀렸을 때) */
  hint?: string | null;
  /** 채점기가 이 답변에 맞춰 만든 설명 (틀렸을 때) */
  explanation?: string | null;
}

export function applyVerdict(
  progress: QuestionProgress,
  answer: string,
  verdict: Verdict,
  at = new Date().toISOString(),
): QuestionProgress {
  if (progress.outcome !== null) {
    throw new Error("이미 끝난 문항입니다");
  }
  const attempt: QuizAttempt = {
    stage: progress.stage,
    answer,
    passed: verdict.passed,
    feedback: verdict.feedback,
    at,
  };
  const attempts = [...progress.attempts, attempt];

  if (verdict.passed) {
    return { ...progress, attempts, outcome: PASS_OUTCOME[progress.stage] };
  }

  const next = NEXT_STAGE[progress.stage];
  if (next === null) {
    return { ...progress, attempts, outcome: "unresolved" };
  }
  return {
    ...progress,
    attempts,
    stage: next,
    // 힌트는 hint 단계로 넘어갈 때, 설명은 explanation 단계로 넘어갈 때 채운다
    hint: next === "hint" ? (verdict.hint ?? null) : progress.hint,
    explanation: next === "explanation" ? (verdict.explanation ?? null) : progress.explanation,
  };
}
