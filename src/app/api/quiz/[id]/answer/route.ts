import { NextResponse } from "next/server";
import { closeQuiz, getQuiz, saveQuizProgress } from "@/db/quiz-repo";
import { readLlmCredentials } from "@/lib/llm/request";
import { errorResponse, QuizError } from "@/lib/quiz/errors";
import { applyVerdict, currentIndex, isFinished } from "@/lib/quiz/flow";
import { giveUpVerdict, gradeAnswer } from "@/lib/quiz/prompts";
import { toQuizView } from "@/lib/quiz/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ANSWER_CHARS = 4000;

/**
 * 답변 하나 채점 → 단계 진행.
 * index를 함께 받아, 화면이 보고 있는 문항과 서버의 현재 문항이 다르면 거절한다
 * (중복 제출·새로고침 경합 방지).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      index?: unknown;
      answer?: unknown;
      giveUp?: unknown;
    } | null;

    const quiz = await getQuiz(id);
    const userId = "local";
    if (!quiz || quiz.userId !== userId) throw new QuizError("퀴즈를 찾을 수 없습니다", 404);
    if (quiz.status !== "active") throw new QuizError("이미 끝난 퀴즈입니다", 409);

    const index = currentIndex(quiz.progress);
    if (body?.index !== index) throw new QuizError("화면이 최신이 아닙니다. 새로고침해 주세요.", 409);

    const giveUp = body.giveUp === true;
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";
    if (!giveUp && !answer) throw new QuizError("답변을 입력하거나 '모르겠어요'를 눌러 주세요", 400);
    if (answer.length > MAX_ANSWER_CHARS) {
      throw new QuizError(`답변은 ${MAX_ANSWER_CHARS}자 이내로 써 주세요`, 400);
    }

    const question = quiz.questions[index]!;
    const current = quiz.progress[index]!;
    const verdict = giveUp
      ? giveUpVerdict(question)
      : await gradeAnswer({
          ...readLlmCredentials(request),
          question,
          stage: current.stage,
          answer,
          previousHint: current.hint,
        });

    const progress = [...quiz.progress];
    progress[index] = applyVerdict(current, giveUp ? "" : answer, verdict);

    if (isFinished(progress)) {
      const closed = await closeQuiz(id, progress);
      if (!closed) throw new QuizError("이미 끝난 퀴즈입니다", 409);
      return NextResponse.json(toQuizView({ ...quiz, status: "done", progress }));
    }

    if (!(await saveQuizProgress(id, progress))) throw new QuizError("이미 끝난 퀴즈입니다", 409);
    return NextResponse.json(toQuizView({ ...quiz, progress }));
  } catch (error) {
    return errorResponse(error, "채점하지 못했습니다");
  }
}
