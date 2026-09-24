import { describe, expect, test } from "bun:test";
import { mergeScoreRows } from "./merge";

describe("mergeScoreRows", () => {
  test("합친 이력으로 다시 계산하고, 최근 쪽의 검증 커밋을 따른다", () => {
    const merged = mergeScoreRows(
      { score: 20, lastVerifiedCommit: "old", lastQuizAt: 100 },
      { score: 43, lastVerifiedCommit: "new", lastQuizAt: 200 },
      // 계정 3문항 중 2 + 익명 3문항 중 3 = 6문항 중 5 → 5 / (6 + 4) = 50
      { correct: 5, total: 6 },
    );
    expect(merged).toEqual({ score: 50, lastVerifiedCommit: "new", lastQuizAt: 200 });
  });

  test("계정 쪽이 더 최근이면 계정 쪽 커밋 유지", () => {
    const merged = mergeScoreRows(
      { score: 0, lastVerifiedCommit: "acc", lastQuizAt: 300 },
      { score: 0, lastVerifiedCommit: "anon", lastQuizAt: 200 },
      { correct: 0, total: 3 },
    );
    expect(merged.lastVerifiedCommit).toBe("acc");
    expect(merged.score).toBe(0);
  });
});
