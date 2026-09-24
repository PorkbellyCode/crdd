/**
 * 익명 기록 → 계정 병합 규칙 (순수 함수).
 *
 * 같은 concept에 양쪽 점수가 다 있으면 둘 중 하나를 고르지 않는다. 점수 공식 v2는
 * "지금까지의 모든 세션 합산"이므로, 이력을 합친 뒤 합계로 다시 계산하는 게 정의상
 * 맞는 값이다. 검증 시점은 더 최근에 퀴즈를 본 쪽을 따른다.
 */
import { scoreConcept } from "./score";

export interface ScoreRowLike {
  score: number;
  lastVerifiedCommit: string | null;
  lastQuizAt: number | null;
}

export function mergeScoreRows(
  account: ScoreRowLike,
  anonymous: ScoreRowLike,
  combinedHistory: { correct: number; total: number },
): ScoreRowLike {
  const latest = (anonymous.lastQuizAt ?? 0) > (account.lastQuizAt ?? 0) ? anonymous : account;
  const { score } = scoreConcept({
    priorCorrect: combinedHistory.correct,
    priorTotal: combinedHistory.total,
    outcomes: [],
  });
  return {
    score,
    lastVerifiedCommit: latest.lastVerifiedCommit,
    lastQuizAt: latest.lastQuizAt,
  };
}
