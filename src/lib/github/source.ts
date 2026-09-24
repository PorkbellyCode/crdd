/**
 * 퀴즈 출제용 코드 조회.
 *
 * 분석이 끝나면 clone을 지우므로(소스 미보관 원칙) 출제 시점에 코드를 다시
 * 가져와야 한다. public 레포만 받으니 raw.githubusercontent.com에서 커밋 SHA로
 * 고정된 파일만 받는다 — clone도, 인증도, API 레이트 리밋(시간당 60회)도 없다.
 * 커밋 SHA로 고정하므로 분석 이후 레포가 바뀌어도 그래프와 같은 시점의 코드를 본다.
 *
 * 받아온 코드는 LLM 요청에만 쓰고 저장하지 않는다.
 */
import { getFileTier } from "@/lib/crdd/score";

/** 파일 하나에서 LLM에 넘길 최대 글자 수 */
export const MAX_FILE_CHARS = 16_000;
/** 한 번 출제에 넘길 전체 코드 상한 */
export const MAX_TOTAL_CHARS = 48_000;
/** 한 번 출제에 가져올 최대 파일 수 */
export const MAX_FILES = 5;

const FETCH_TIMEOUT_MS = 10_000;

/** 시크릿이 담길 수 있는 파일은 가져오지 않는다 (crdd-mcp의 isSensitiveFile과 같은 발상) */
const SENSITIVE_PATTERNS = [
  /(^|\/)\.env(\..*)?$/i,
  /\.(pem|key|p12|pfx|keystore|jks)$/i,
  /(^|\/)id_(rsa|ed25519|ecdsa)(\.pub)?$/i,
  /(^|\/)(secrets?|credentials?)(\.[a-z]+)?$/i,
];

export function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(path));
}

export interface SourceFile {
  path: string;
  content: string;
  truncated: boolean;
}

export class SourceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SourceError";
  }
}

function rawUrl(repo: string, commit: string, path: string): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${repo}/${commit}/${encodedPath}`;
}

export async function fetchRepoFile(repo: string, commit: string, path: string): Promise<SourceFile> {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new SourceError("잘못된 레포 이름");
  if (!/^[0-9a-f]{7,40}$/.test(commit)) throw new SourceError("잘못된 커밋 SHA");
  if (path.includes("..") || path.startsWith("/")) throw new SourceError("잘못된 파일 경로");
  if (isSensitivePath(path)) throw new SourceError("시크릿이 담길 수 있는 파일이라 제외했습니다");

  const response = await fetch(rawUrl(repo, commit, path), {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new SourceError(`${path}를 가져오지 못했습니다 (HTTP ${response.status})`, response.status);
  }
  const text = await response.text();
  const truncated = text.length > MAX_FILE_CHARS;
  return { path, content: truncated ? text.slice(0, MAX_FILE_CHARS) : text, truncated };
}

/**
 * 출제에 쓸 파일 고르기 — 순수 함수.
 *   1) 대표 심볼(fan-in 상위)이 있는 파일을 그 순서대로
 *   2) 나머지 normal tier 파일
 *   3) peripheral(테스트·문서·설정)은 마지막
 */
export function selectQuizFiles(files: string[], topFiles: (string | null | undefined)[], limit = MAX_FILES): string[] {
  const candidates = files.filter((file) => !isSensitivePath(file));
  const inConcept = new Set(candidates);
  const ordered: string[] = [];
  const push = (file: string) => {
    if (inConcept.has(file) && !ordered.includes(file)) ordered.push(file);
  };
  for (const file of topFiles) if (file) push(file);
  for (const file of candidates) if (getFileTier(file) === "normal") push(file);
  for (const file of candidates) push(file);
  return ordered.slice(0, limit);
}

/** 고른 파일들을 가져온다. 개별 실패는 건너뛰고, 전체 글자 수 상한을 지킨다 */
export async function fetchQuizMaterial(
  repo: string,
  commit: string,
  paths: string[],
): Promise<SourceFile[]> {
  const settled = await Promise.allSettled(paths.map((path) => fetchRepoFile(repo, commit, path)));
  const result: SourceFile[] = [];
  let total = 0;
  for (const item of settled) {
    if (item.status !== "fulfilled") continue;
    const file = item.value;
    const room = MAX_TOTAL_CHARS - total;
    if (room <= 500) break;
    if (file.content.length > room) {
      result.push({ ...file, content: file.content.slice(0, room), truncated: true });
      total = MAX_TOTAL_CHARS;
    } else {
      result.push(file);
      total += file.content.length;
    }
  }
  return result;
}
