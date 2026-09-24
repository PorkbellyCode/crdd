/**
 * 로그인 직후, 그 브라우저의 익명 기록(퀴즈·이력·점수)을 계정으로 옮긴다.
 * 로그인 전에 풀던 퀴즈가 사라지지 않게 하는 게 목적이다.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { history, quizzes, scores } from "./schema";
import { mergeScoreRows } from "@/lib/crdd/merge";

export async function mergeAnonymousRecords(anonymousId: string, accountId: string) {
  if (anonymousId === accountId) return { quizzes: 0, scores: 0 };

  return db.transaction(async (tx) => {
    const movedQuizzes = await tx
      .update(quizzes)
      .set({ userId: accountId })
      .where(eq(quizzes.userId, anonymousId))
      .returning({ id: quizzes.id });
    await tx.update(history).set({ userId: accountId }).where(eq(history.userId, anonymousId));

    const anonymousScores = await tx.select().from(scores).where(eq(scores.userId, anonymousId));
    for (const row of anonymousScores) {
      const [existing] = await tx
        .select()
        .from(scores)
        .where(
          and(
            eq(scores.userId, accountId),
            eq(scores.projectId, row.projectId),
            eq(scores.conceptKey, row.conceptKey),
          ),
        )
        .limit(1);

      if (!existing) {
        await tx.update(scores).set({ userId: accountId }).where(eq(scores.id, row.id));
        continue;
      }

      // 양쪽에 점수가 있으면 합친 이력(이미 계정으로 옮겨짐)으로 다시 계산한다
      const [sums] = await tx
        .select({
          correct: sql<number>`coalesce(sum(${history.correct}), 0)`,
          total: sql<number>`coalesce(sum(${history.total}), 0)`,
        })
        .from(history)
        .where(
          and(
            eq(history.userId, accountId),
            eq(history.projectId, row.projectId),
            eq(history.conceptKey, row.conceptKey),
          ),
        );
      const merged = mergeScoreRows(existing, row, {
        correct: Number(sums?.correct ?? 0),
        total: Number(sums?.total ?? 0),
      });
      await tx
        .update(scores)
        .set({ ...merged, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(scores.id, existing.id));
      await tx.delete(scores).where(eq(scores.id, row.id));
    }

    return { quizzes: movedQuizzes.length, scores: anonymousScores.length };
  });
}
