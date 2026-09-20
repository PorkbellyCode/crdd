/**
 * 점수 코어 — crdd-mcp의 src/index.ts에서 옮겨온 순수 함수들.
 *
 * 웹앱과 MCP가 공유해야 하는 유일한 로직이라 파일 접근·DB와 완전히 분리해 둔다.
 * 설계 근거는 프로젝트 문서 참조:
 *   - 배점 차등: "CRDD 오답 처리와 학습 루프 설계"
 *   - 누적+스무딩: "CRDD 이해도 점수 유지 설계"
 *   - tier 가중치: "CRDD 파일 가중치 설계"
 */
import type { AnswerOutcome } from "./types";

// ---------------------------------------------------------------------------
// 배점 차등
//
// 첫 시도 정답과 설명을 읽고 맞힌 정답을 같은 점수로 처리하면, 추이 숫자가
// 이해도가 아니라 "설명을 몇 번 읽었는가"를 반영하게 되어 지표가 무의미해진다.
// ---------------------------------------------------------------------------
export const OUTCOME_WEIGHTS: Record<AnswerOutcome, number> = {
  first_try: 1,
  after_hint: 0.6,
  after_explanation: 0.3,
  unresolved: 0,
};

// ---------------------------------------------------------------------------
// 누적 + 스무딩
//
// 퀴즈 한 번 잘 봤다고 concept 점수가 즉시 100점이 되지 않도록, 지금까지의
// 모든 세션을 합산한 뒤 가상의 "아직 확인되지 않은" 문항을 total에 얹는다.
// ---------------------------------------------------------------------------
export const SCORE_SMOOTHING_PSEUDO_TOTAL = 4;
export const SCORE_SMOOTHING_PSEUDO_CORRECT = 0;

export interface ScoreInput {
  /** 이 concept에 대해 과거 세션들에서 쌓인 가중 정답 합 */
  priorCorrect: number;
  /** 과거 세션들의 문항 수 합 */
  priorTotal: number;
  /** 이번 세션 결과 */
  outcomes: AnswerOutcome[];
}

export interface ScoreResult {
  correct: number;
  total: number;
  score: number;
  debtRatio: number;
}

export function scoreConcept({ priorCorrect, priorTotal, outcomes }: ScoreInput): ScoreResult {
  const correct = outcomes.reduce((sum, outcome) => sum + OUTCOME_WEIGHTS[outcome], 0);
  const total = outcomes.length;

  const smoothedCorrect = priorCorrect + correct + SCORE_SMOOTHING_PSEUDO_CORRECT;
  const smoothedTotal = priorTotal + total + SCORE_SMOOTHING_PSEUDO_TOTAL;
  const score = smoothedTotal === 0 ? 0 : Math.round((smoothedCorrect / smoothedTotal) * 100);

  return { correct, total, score, debtRatio: 100 - score };
}

// ---------------------------------------------------------------------------
// 파일 tier
// ---------------------------------------------------------------------------
export type FileTier = "peripheral" | "normal";

export const TIER_WEIGHTS: Record<FileTier, number> = {
  peripheral: 0.3,
  normal: 1,
};

const PERIPHERAL_DIR_NAMES = new Set([
  "test",
  "tests",
  "__tests__",
  "__mocks__",
  "docs",
  "doc",
  "examples",
  "example",
  ".github",
]);

const PERIPHERAL_FILE_PATTERNS = [
  /\.config\.[cm]?[jt]sx?$/i,
  /^tsconfig(\..+)?\.json$/i,
  /^package(-lock)?\.json$/i,
  /^pnpm-lock\.yaml$/i,
  /^yarn\.lock$/i,
  /^components\.json$/i,
  /^vercel\.json$/i,
  /^\.eslintrc/i,
  /^\.prettierrc/i,
  /^vitest\.config/i,
  /^jest\.config/i,
  /^README(\.[a-z0-9]+)?$/i,
  /^CHANGELOG(\.[a-z0-9]+)?$/i,
  /^LICENSE(\.[a-z0-9]+)?$/i,
  /\.md$/i,
];

/** 경로만 보고 tier를 판정한다 (fan-in 없이도 계산 가능) */
export function getFileTier(relativePath: string): FileTier {
  const segments = relativePath.split("/");
  const fileName = segments[segments.length - 1] ?? relativePath;
  const dirSegments = segments.slice(0, -1);

  if (dirSegments.some((segment) => PERIPHERAL_DIR_NAMES.has(segment))) return "peripheral";
  if (PERIPHERAL_FILE_PATTERNS.some((pattern) => pattern.test(fileName))) return "peripheral";
  return "normal";
}

/** concept 가중치 = 매핑된 파일들의 tier 가중치 합 (없으면 normal 하나로 취급) */
export function conceptWeight(files: string[]): number {
  const sum = files.reduce((total, file) => total + TIER_WEIGHTS[getFileTier(file)], 0);
  return sum > 0 ? sum : 1;
}

// ---------------------------------------------------------------------------
// Overall
//
// 화면에는 부채비율만 노출한다. score/overall은 내부 계산용으로만 존재한다.
// ---------------------------------------------------------------------------
export interface ConceptScoreInput {
  files: string[];
  /** 아직 퀴즈를 보지 않은 concept은 null — 콜드 스타트 */
  score: number | null;
}

export function overallDebtRatio(concepts: ConceptScoreInput[]): number {
  let weighted = 0;
  let weightSum = 0;
  for (const concept of concepts) {
    const weight = conceptWeight(concept.files);
    weighted += (concept.score ?? 0) * weight;
    weightSum += weight;
  }
  if (weightSum === 0) return 100;
  return 100 - Math.round(weighted / weightSum);
}

/** 마지막 검증 이후 파일이 바뀌었는지 — 해시 스냅샷 비교 (git diff를 쓰지 않는다) */
export function staleFiles(
  files: string[],
  verified: Record<string, string>,
  current: Record<string, string>,
): string[] {
  return files.filter((file) => verified[file] !== current[file]);
}
