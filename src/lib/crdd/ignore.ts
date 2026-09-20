/**
 * 분석에서 제외할 파일.
 *
 * 왜 중요한가: porklog 실측(2026-09-20)에서 기본 설정으로 Graphify를 돌리면
 * package.json이 코드처럼 파싱되어 커뮤니티 23개 중 7개가 "설정 파일 덩어리"가
 * 됐고, fan-in 1위도 package.json(178회)이었다. 제외하고 다시 돌리자
 * 547 노드 → 382 노드, 23 커뮤니티 → 15 커뮤니티가 되면서 전부 의미 있는
 * 묶음이 됐다.
 *
 * 점수 계산 시점의 tier 가중치(score.ts)와 목적이 겹치지만 적용 시점이 다르다.
 * 이 목록은 그래프를 만들기 전에 적용된다 — 클러스터링 자체를 깨끗하게 만든다.
 */

/** 분석 워커가 .graphifyignore로 써서 Graphify에 넘기는 내용 */
export const GRAPHIFY_IGNORE_LINES = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "tsconfig*.json",
  "components.json",
  "vercel.json",
  "*.config.ts",
  "*.config.js",
  "*.config.mjs",
  "*.config.cjs",
  "next-env.d.ts",
] as const;

export const GRAPHIFY_IGNORE_FILE = GRAPHIFY_IGNORE_LINES.join("\n") + "\n";

const NOISE_PATTERN =
  /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig[^/]*\.json|[^/]*\.config\.(ts|js|mjs|cjs)|next-env\.d\.ts|components\.json|vercel\.json|\.eslintrc[^/]*)$/;

const TEST_PATTERN =
  /(^|\/)(tests?|__tests__|__mocks__|e2e)\/|\.(test|spec)\.[tj]sx?$/;

/** 그래프에 들어가서는 안 되는 파일인지 (이미 만들어진 그래프를 후처리할 때 쓴다) */
export function isNoiseFile(path: string | null | undefined): boolean {
  if (!path) return false;
  return NOISE_PATTERN.test(path) || TEST_PATTERN.test(path);
}
