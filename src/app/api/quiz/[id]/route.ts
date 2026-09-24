import { NextResponse } from "next/server";
import { getQuiz } from "@/db/quiz-repo";
import { errorResponse, QuizError } from "@/lib/quiz/errors";
import { toQuizView } from "@/lib/quiz/view";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const quiz = await getQuiz(id);
    const userId = await getUserId();
    // 남의 퀴즈는 없는 것처럼 — 존재 여부도 알려주지 않는다
    if (!quiz || quiz.userId !== userId) throw new QuizError("퀴즈를 찾을 수 없습니다", 404);
    return NextResponse.json(toQuizView(quiz));
  } catch (error) {
    return errorResponse(error, "퀴즈를 불러오지 못했습니다");
  }
}
