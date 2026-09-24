/**
 * concept의 영속 키.
 *
 * Graphify의 커뮤니티 번호는 재분석할 때마다 다시 매겨진다 — 크기순 정렬이라
 * 파일 하나만 늘어도 7번이 6번이 될 수 있다. 그래서 점수를 communityId에 붙이면
 * 재분석 뒤 엉뚱한 concept에 점수가 붙는다.
 *
 * 규칙:
 *   - 처음 생긴 concept의 키 = `c<communityId>-<파일 집합 해시 8자리>`
 *   - 재분석 때는 직전 concept들과 파일 집합의 Jaccard 유사도로 짝을 짓는다.
 *     유사도가 MATCH_THRESHOLD 이상인 쌍을 높은 순으로 1:1 배정하고,
 *     짝을 못 찾은 커뮤니티만 새 키를 받는다.
 *   - 키는 한 번 정해지면 바뀌지 않는다. 파일이 조금 바뀌어도 점수 이력이 이어진다.
 */
import { createHash } from "node:crypto";

export const MATCH_THRESHOLD = 0.5;

export function filesHash(files: string[]): string {
  return createHash("sha1").update([...files].sort().join("\n")).digest("hex").slice(0, 8);
}

export function newConceptKey(communityId: number, files: string[]): string {
  return `c${communityId}-${filesHash(files)}`;
}

export function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  let shared = 0;
  for (const item of setA) if (setB.has(item)) shared++;
  return shared / (setA.size + setB.size - shared);
}

export interface KnownConcept {
  key: string;
  files: string[];
}

export interface NextConcept {
  communityId: number;
  files: string[];
}

/** 새 분석의 communityId → 영속 키 */
export function assignConceptKeys(
  previous: KnownConcept[],
  next: NextConcept[],
): Map<number, string> {
  const pairs: { communityId: number; key: string; similarity: number }[] = [];
  for (const concept of next) {
    for (const known of previous) {
      const similarity = jaccard(concept.files, known.files);
      if (similarity >= MATCH_THRESHOLD) {
        pairs.push({ communityId: concept.communityId, key: known.key, similarity });
      }
    }
  }
  // 유사도 높은 쌍부터 1:1로 확정한다 (동률이면 communityId 작은 쪽 — 결정론적)
  pairs.sort((a, b) => b.similarity - a.similarity || a.communityId - b.communityId);

  const result = new Map<number, string>();
  const usedKeys = new Set<string>();
  for (const pair of pairs) {
    if (result.has(pair.communityId) || usedKeys.has(pair.key)) continue;
    result.set(pair.communityId, pair.key);
    usedKeys.add(pair.key);
  }

  for (const concept of next) {
    if (result.has(concept.communityId)) continue;
    let key = newConceptKey(concept.communityId, concept.files);
    // 이미 쓰인 키와 우연히 겹치면(같은 번호 + 같은 파일 집합이 과거에 따로 있었던 경우) 접미사
    for (let n = 2; usedKeys.has(key) || previous.some((p) => p.key === key); n++) {
      key = `${newConceptKey(concept.communityId, concept.files)}-${n}`;
    }
    result.set(concept.communityId, key);
    usedKeys.add(key);
  }
  return result;
}
