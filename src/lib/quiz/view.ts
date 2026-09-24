/**
 * 저장된 퀴즈 → 화면으로 내보낼 형태.
 *
 * rubric·힌트·설명은 단계에 맞게만 연다. 이 함수를 거치지 않고 questionsJson을
 * 그대로 내보내면 정답이 브라우저로 새어 나간다.
 */
import type { QuestionProgress, QuizQuestion, QuizResult, QuizView } from "./types";
import { currentIndex } from "./flow";

export function toQuizView(quiz: {
  id: string;
  analysisId: string;
  conceptName: string;
  commit: string;
  status: "active" | "done";
  questions: QuizQuestion[];
  progress: QuestionProgress[];
  result: QuizResult | null;
}): QuizView {
  return {
    id: quiz.id,
    analysisId: quiz.analysisId,
    conceptName: quiz.conceptName,
    commit: quiz.commit.slice(0, 8),
    status: quiz.status,
    current: currentIndex(quiz.progress),
    total: quiz.questions.length,
    result: quiz.result,
    questions: quiz.questions.map((question, i) => {
      const progress = quiz.progress[i]!;
      const finished = progress.outcome !== null;
      const inHint = progress.stage !== "first";
      const inExplanation = progress.stage === "explanation";
      return {
        level: question.level,
        question: question.question,
        codeExcerpt: question.codeExcerpt,
        stage: progress.stage,
        outcome: progress.outcome,
        attempts: progress.attempts,
        hint: inHint ? (progress.hint ?? question.hint) : null,
        explanation: inExplanation || finished ? (progress.explanation ?? question.explanation) : null,
        rubric: finished ? question.rubric : null,
      };
    }),
  };
}
