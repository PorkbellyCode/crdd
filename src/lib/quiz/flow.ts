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

/**
 * 화면이 보고 있는 지점 — 클라이언트가 제출과 함께 보내는 fence.
 *   index    — 보고 있는 문항 번호
 *   attempts — 그 문항에서 화면에 쌓여 있는 시도 수 (QuizView.questions[index].attempts.length)
 *   stage    — 보고 있는 단계 (보내면 같이 검사한다)
 * attempts는 제출마다 반드시 1 늘어나므로, 같은 문항 안에서 단계가 넘어간 경합까지 잡아낸다.
 */
export interface ProgressFence {
  index: number;
  attempts: number;
  stage?: QuizStage;
}

const STAGES: readonly string[] = ["first", "hint", "explanation"];

export function isQuizStage(value: unknown): value is QuizStage {
  return typeof value === "string" && STAGES.includes(value);
}

/**
 * 요청 바디에서 fence를 읽는다. 한 조각이라도 빠지거나 형식이 틀리면 null —
 * 모르는 지점에서 온 제출은 채점하지 않는다(fail closed).
 */
export function readFence(body: unknown): ProgressFence | null {
  if (typeof body !== "object" || body === null) return null;
  const { index, attempts, stage } = body as { index?: unknown; attempts?: unknown; stage?: unknown };
  if (!Number.isInteger(index) || (index as number) < 0) return null;
  if (!Number.isInteger(attempts) || (attempts as number) < 0) return null;
  if (stage !== undefined && !isQuizStage(stage)) return null;
  return { index: index as number, attempts: attempts as number, stage: stage as QuizStage | undefined };
}

/**
 * 화면이 서버의 현재 진행 상태와 같은 지점을 보고 있는가.
 * 다르면 채점을 거절해야 한다 — 단계가 몰래 넘어간 뒤 채점되면
 * 공개하지 않은 힌트·설명만큼 점수 상한이 깎인다.
 */
export function matchesProgress(progress: QuestionProgress[], fence: ProgressFence): boolean {
  const index = currentIndex(progress);
  if (index < 0 || fence.index !== index) return false;
  const current = progress[index];
  if (!current) return false;
  if (fence.attempts !== current.attempts.length) return false;
  if (fence.stage !== undefined && fence.stage !== current.stage) return false;
  return true;
}
