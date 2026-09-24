/**
 * 퀴즈 결과 → concept 점수.
 *
 * 점수 공식 v2(누적 + 스무딩, src/lib/crdd/score.ts): 이 사용자가 이 concept에서
 * 지금까지 본 모든 세션의 가중 정답·문항 수를 합산한 뒤 이번 결과를 더한다.
 * 그래서 history는 지우면 안 된다.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { history, scores } from "./schema";
import { scoreConcept } from "@/lib/crdd/score";
import type { AnswerOutcome } from "@/lib/crdd/types";
import type { QuestionProgress, QuizResult } from "@/lib/quiz/types";

export async function applyQuizScore(quiz: {
  id: string;
  userId: string;
  projectId: string;
  conceptKey: string;
  commit: string;
  progress: QuestionProgress[];
}): Promise<QuizResult> {
  const outcomes = quiz.progress.map((p) => p.outcome ?? "unresolved") as AnswerOutcome[];
  const where = and(
    eq(history.userId, quiz.userId),
    eq(history.projectId, quiz.projectId),
    eq(history.conceptKey, quiz.conceptKey),
  );

  const [prior] = await db
    .select({
      correct: sql<number>`coalesce(sum(${history.correct}), 0)`,
      total: sql<number>`coalesce(sum(${history.total}), 0)`,
    })
    .from(history)
    .where(where);

  const [existing] = await db
    .select()
    .from(scores)
    .where(
      and(
        eq(scores.userId, quiz.userId),
        eq(scores.projectId, quiz.projectId),
        eq(scores.conceptKey, quiz.conceptKey),
      ),
    )
    .limit(1);
  const before = existing?.lastQuizAt ? existing.score : null;

  const scored = scoreConcept({
    priorCorrect: Number(prior?.correct ?? 0),
    priorTotal: Number(prior?.total ?? 0),
    outcomes,
  });
  const at = Math.floor(Date.now() / 1000);

  await db.insert(history).values({
    id: crypto.randomUUID(),
    userId: quiz.userId,
    projectId: quiz.projectId,
    conceptKey: quiz.conceptKey,
    quizId: quiz.id,
    commit: quiz.commit,
    outcomesJson: JSON.stringify(outcomes),
    correct: scored.correct,
    total: scored.total,
    scoreBefore: before ?? 0,
    scoreAfter: scored.score,
  });

  await db
    .insert(scores)
    .values({
      id: crypto.randomUUID(),
      userId: quiz.userId,
      projectId: quiz.projectId,
      conceptKey: quiz.conceptKey,
      score: scored.score,
      lastVerifiedCommit: quiz.commit,
      lastQuizAt: at,
    })
    .onConflictDoUpdate({
      target: [scores.userId, scores.projectId, scores.conceptKey],
      set: { score: scored.score, lastVerifiedCommit: quiz.commit, lastQuizAt: at, updatedAt: at },
    });

  return {
    outcomes,
    debtBefore: before === null ? null : 100 - before,
    debtAfter: scored.debtRatio,
  };
}
