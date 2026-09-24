import { describe, expect, test } from "bun:test";
import { applyVerdict, initialProgress } from "./flow";
import type { QuizQuestion } from "./types";
import { toQuizView } from "./view";

const question: QuizQuestion = {
  level: "understanding",
  question: "Q?",
  codeExcerpt: { file: "a.ts", startLine: 1, endLine: 2, code: "x" },
  rubric: ["SECRET_POINT"],
  hint: "DEFAULT_HINT",
  explanation: "DEFAULT_EXPLANATION",
};

const base = {
  id: "q",
  analysisId: "a",
  conceptName: "C",
  commit: "0123456789abcdef",
  status: "active" as const,
  questions: [question],
  result: null,
};

describe("toQuizView — 단계별 공개", () => {
  test("첫 시도 전에는 rubric·힌트·설명이 없다", () => {
    const view = toQuizView({ ...base, progress: initialProgress(1) });
    const json = JSON.stringify(view);
    expect(json).not.toContain("SECRET_POINT");
    expect(json).not.toContain("DEFAULT_HINT");
    expect(json).not.toContain("DEFAULT_EXPLANATION");
    expect(view.commit).toBe("01234567");
  });

  test("힌트 단계에서는 힌트만, 설명 단계에서 설명까지", () => {
    const [p] = initialProgress(1);
    const hinted = applyVerdict(p!, "a", { passed: false, feedback: "f", hint: "TAILORED_HINT", explanation: "TAILORED_EXPL" });
    const view = toQuizView({ ...base, progress: [hinted] });
    expect(view.questions[0]!.hint).toBe("TAILORED_HINT");
    expect(view.questions[0]!.explanation).toBeNull();
    expect(view.questions[0]!.rubric).toBeNull();

    const explained = applyVerdict(hinted, "b", { passed: false, feedback: "f", explanation: "TAILORED_EXPL" });
    expect(toQuizView({ ...base, progress: [explained] }).questions[0]!.explanation).toBe("TAILORED_EXPL");
  });

  test("끝난 문항은 rubric과 해설을 연다", () => {
    const [p] = initialProgress(1);
    const done = applyVerdict(p!, "a", { passed: true, feedback: "f" });
    const view = toQuizView({ ...base, progress: [done] });
    expect(view.questions[0]!.rubric).toEqual(["SECRET_POINT"]);
    expect(view.questions[0]!.explanation).toBe("DEFAULT_EXPLANATION");
    expect(view.current).toBe(-1);
  });
});
