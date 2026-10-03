import { NextResponse } from "next/server";
import { closeQuiz, getQuiz, saveQuizProgress, saveQuizResult } from "@/db/quiz-repo";
import { applyQuizScore } from "@/db/score-repo";
import { readLlmCredentials } from "@/lib/llm/request";
import { errorResponse, QuizError } from "@/lib/quiz/errors";
import { applyVerdict, isFinished, matchesProgress, readFence } from "@/lib/quiz/flow";
import { giveUpVerdict, gradeAnswer } from "@/lib/quiz/prompts";
import { toQuizView } from "@/lib/quiz/view";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ANSWER_CHARS = 4000;

const STALE = "화면이 최신이 아닙니다. 최신 상태로 맞췄으니 다시 확인해 주세요.";

/**
 * 답변 하나 채점 → 단계 진행.
 *
 * 화면이 보고 있는 지점(index·attempts·stage)을 함께 받아, 서버의 현재 진행 상태와
 * 다르면 채점하지 않고 409 + 최신 QuizView를 돌려준다. index만 보면 같은 문항 안에서
 * 단계가 넘어간 경합(채점이 끝나 stage=hint가 됐는데 화면은 아직 first)을 놓쳐,
 * 사용자가 힌트를 한 번도 못 본 채 점수 상한이 깎인다.
 *
 * 저장은 "읽은 progress가 그대로일 때만"(CAS) — 동시에 떠 있는 두 제출 중 하나만 남는다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as unknown;

    const quiz = await getQuiz(id);
    const userId = await getUserId();
    if (!quiz || quiz.userId !== userId) throw new QuizError("퀴즈를 찾을 수 없습니다", 404);
    if (quiz.status !== "active") {
      throw new QuizError("이미 끝난 퀴즈입니다", 409, toQuizView(quiz));
    }

    const fence = readFence(body);
    if (!fence || !matchesProgress(quiz.progress, fence)) {
      throw new QuizError(STALE, 409, toQuizView(quiz));
    }
    const index = fence.index;

    const { answer: rawAnswer, giveUp: rawGiveUp } = body as { answer?: unknown; giveUp?: unknown };
    const giveUp = rawGiveUp === true;
    const answer = typeof rawAnswer === "string" ? rawAnswer.trim() : "";
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
      // 닫기에 성공한 요청 하나만 점수를 반영한다 — 이력이 두 번 쌓이지 않게
      const closed = await closeQuiz(id, progress, quiz.progress);
      if (!closed) throw await staleError(id);
      const result = await applyQuizScore({ ...quiz, progress });
      await saveQuizResult(id, result);
      return NextResponse.json(toQuizView({ ...quiz, status: "done", progress, result }));
    }

    if (!(await saveQuizProgress(id, progress, quiz.progress))) throw await staleError(id);
    return NextResponse.json(toQuizView({ ...quiz, progress }));
  } catch (error) {
    return errorResponse(error, "채점하지 못했습니다");
  }
}

/**
 * 저장 경합에서 진 요청의 에러 — 이 답변은 버려지므로, 이긴 요청이 남긴
 * 최신 상태를 다시 읽어 함께 돌려준다. (이 요청이 들고 있던 progress는 이미 낡았다)
 */
async function staleError(id: string): Promise<QuizError> {
  const latest = await getQuiz(id);
  return new QuizError(STALE, 409, latest ? toQuizView(latest) : undefined);
}
