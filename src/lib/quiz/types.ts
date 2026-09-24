import type { AnswerOutcome } from "@/lib/crdd/types";

export type QuizLevel = "awareness" | "understanding" | "reasoning";

/** 서버에만 있는 문항 원본 — rubric·힌트·설명 포함 */
export interface QuizQuestion {
  level: QuizLevel;
  question: string;
  codeExcerpt: { file: string; startLine: number; endLine: number; code: string };
  /** 정답에 반드시 포함돼야 하는 핵심 포인트. 채점 기준이 세션마다 흔들리지 않게 */
  rubric: string[];
  /** "모르겠어요"를 눌렀을 때 쓰는 기본 힌트 — 정답이 아니라 볼 곳을 가리킨다 */
  hint: string;
  /** 힌트 뒤에도 막혔을 때 쓰는 기본 설명 — 이 단계부터는 정답이 드러나도 된다 */
  explanation: string;
}

/**
 * 문항의 진행 단계 (프로젝트 문서 "CRDD 오답 처리와 학습 루프 설계"의 단계적 공개).
 *   first       — 첫 시도
 *   hint        — 놓친 포인트를 보여준 뒤 재시도
 *   explanation — 설명을 보여준 뒤, 자기 말로 다시 설명
 */
export type QuizStage = "first" | "hint" | "explanation";

export interface QuizAttempt {
  stage: QuizStage;
  /** 빈 문자열이면 "모르겠어요" */
  answer: string;
  passed: boolean;
  feedback: string;
  at: string;
}

export interface QuestionProgress {
  stage: QuizStage;
  attempts: QuizAttempt[];
  outcome: AnswerOutcome | null;
  /** 채점기가 이 답변에 맞춰 만든 힌트/설명. 없으면 문항의 기본값을 쓴다 */
  hint: string | null;
  explanation: string | null;
}

export interface QuizResult {
  outcomes: AnswerOutcome[];
  debtBefore: number | null;
  debtAfter: number;
}

/** 화면으로 나가는 형태 — 단계에 맞게 걸러져 있다 */
export interface QuizView {
  id: string;
  conceptName: string;
  commit: string;
  status: "active" | "done";
  current: number;
  total: number;
  questions: {
    level: QuizLevel;
    question: string;
    codeExcerpt: QuizQuestion["codeExcerpt"];
    stage: QuizStage;
    outcome: AnswerOutcome | null;
    attempts: QuizAttempt[];
    /** stage가 hint 이상일 때만 */
    hint: string | null;
    /** stage가 explanation이거나 문항이 끝났을 때만 */
    explanation: string | null;
    /** 문항이 끝난 뒤에만 */
    rubric: string[] | null;
  }[];
  result: QuizResult | null;
  /** 분석 화면으로 돌아갈 때 쓰는 작업 id가 아니라 분석 id */
  analysisId: string;
}
