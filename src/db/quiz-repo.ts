/**
 * 퀴즈 세션 저장·조회.
 */
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { quizzes } from "./schema";
import type { QuestionProgress, QuizQuestion, QuizResult } from "@/lib/quiz/types";

const nowSec = () => Math.floor(Date.now() / 1000);

export async function createQuiz(input: {
  userId: string;
  projectId: string;
  analysisId: string;
  conceptKey: string;
  conceptName: string;
  commit: string;
  model: string;
  questions: QuizQuestion[];
  progress: QuestionProgress[];
}): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(quizzes).values({
    id,
    userId: input.userId,
    projectId: input.projectId,
    analysisId: input.analysisId,
    conceptKey: input.conceptKey,
    conceptName: input.conceptName,
    commit: input.commit,
    model: input.model,
    questionsJson: JSON.stringify(input.questions),
    progressJson: JSON.stringify(input.progress),
  });
  return id;
}

export async function getQuiz(id: string) {
  const rows = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    status: row.status as "active" | "done",
    questions: JSON.parse(row.questionsJson) as QuizQuestion[],
    progress: JSON.parse(row.progressJson) as QuestionProgress[],
    result: row.resultJson ? (JSON.parse(row.resultJson) as QuizResult) : null,
  };
}

export type StoredQuiz = NonNullable<Awaited<ReturnType<typeof getQuiz>>>;

/** 진행 저장 — 이미 끝난 퀴즈는 건드리지 않는다 */
export async function saveQuizProgress(id: string, progress: QuestionProgress[]): Promise<boolean> {
  const updated = await db
    .update(quizzes)
    .set({ progressJson: JSON.stringify(progress) })
    .where(and(eq(quizzes.id, id), eq(quizzes.status, "active")))
    .returning({ id: quizzes.id });
  return updated.length > 0;
}

/**
 * 마지막 문항이 끝나면 퀴즈를 닫는다. 요청이 겹쳐도 한 번만 닫히도록
 * status=active일 때만 바꾸고, 실제로 닫았는지를 돌려준다.
 */
export async function closeQuiz(id: string, progress: QuestionProgress[]): Promise<boolean> {
  const updated = await db
    .update(quizzes)
    .set({ status: "done", progressJson: JSON.stringify(progress), finishedAt: nowSec() })
    .where(and(eq(quizzes.id, id), eq(quizzes.status, "active")))
    .returning({ id: quizzes.id });
  return updated.length > 0;
}

export async function saveQuizResult(id: string, result: QuizResult) {
  await db.update(quizzes).set({ resultJson: JSON.stringify(result) }).where(eq(quizzes.id, id));
}
