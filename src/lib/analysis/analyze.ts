/**
 * 분석 파이프라인 — public 레포 링크 하나로 Understanding Map까지.
 *
 *   clone --depth 1  →  .graphifyignore  →  graphify extract --code-only
 *   →  cluster-only --no-label  →  concept 이름  →  레이아웃  →  clone 삭제
 *
 * 원칙 (프로젝트 문서에서 확정):
 *   - 소스는 보관하지 않는다. 그래프와 파일 해시만 남긴다.
 *   - LLM을 부르지 않는다. graphify의 커뮤니티 명명(--no-label)도 건너뛴다.
 *   - 변경 감지는 git diff가 아니라 blob SHA 스냅샷 비교다.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { nameCommunities } from "@/lib/crdd/concepts";
import { GRAPHIFY_IGNORE_FILE } from "@/lib/crdd/ignore";
import { buildMapData } from "@/lib/crdd/map";
import type { Concept, GraphJson, MapData } from "@/lib/crdd/types";

export interface AnalysisResult {
  repo: string;
  commit: string;
  concepts: Concept[];
  map: MapData;
  /** 파일 경로 → blob SHA. 다음 분석 때 이 스냅샷과 비교해 stale을 판정한다 */
  fileHashes: Record<string, string>;
  timings: { clone: number; extract: number; layout: number };
}

export class AnalysisError extends Error {
  constructor(
    message: string,
    readonly step: string,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}

const REPO_PATTERN = /^[A-Za-z0-9_.-]+$/;
const CLONE_TIMEOUT_MS = 120_000;
const EXTRACT_TIMEOUT_MS = 300_000;

/** "github.com/owner/repo", "https://github.com/owner/repo.git", "owner/repo" 모두 허용 */
export function parseRepo(input: string): { owner: string; repo: string } {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const [owner, repo] = cleaned.split("/");
  if (!owner || !repo || !REPO_PATTERN.test(owner) || !REPO_PATTERN.test(repo)) {
    throw new AnalysisError(`레포 주소를 읽을 수 없습니다: ${input}`, "parse");
  }
  return { owner, repo };
}

function run(
  command: string,
  args: string[],
  options: { cwd?: string; timeout: number; step: string },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new AnalysisError(`${options.step} 단계가 시간 초과되었습니다`, options.step));
    }, options.timeout);

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new AnalysisError(`${command}를 실행할 수 없습니다: ${error.message}`, options.step));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new AnalysisError(stderr.trim() || `${command} 실패 (exit ${code})`, options.step));
    });
  });
}

export async function analyzeRepo(input: string): Promise<AnalysisResult> {
  const { owner, repo } = parseRepo(input);
  const slug = `${owner}/${repo}`;
  const workdir = await mkdtemp(path.join(tmpdir(), "crdd-"));

  try {
    // 1. 얕은 clone — 히스토리는 필요 없다
    const cloneStart = Date.now();
    await run(
      "git",
      ["clone", "--depth", "1", "--quiet", `https://github.com/${slug}.git`, workdir],
      { timeout: CLONE_TIMEOUT_MS, step: "clone" },
    );
    const cloneMs = Date.now() - cloneStart;

    // 2. 파일 해시 스냅샷 — 변경 감지의 기준. clone이 이미 있으니 API 호출이 필요 없다
    const lsTree = await run("git", ["ls-tree", "-r", "HEAD"], {
      cwd: workdir,
      timeout: 30_000,
      step: "hash",
    });
    const fileHashes: Record<string, string> = {};
    for (const line of lsTree.split("\n")) {
      const match = line.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/);
      if (match) fileHashes[match[2]!] = match[1]!;
    }

    const commit = (
      await run("git", ["rev-parse", "HEAD"], { cwd: workdir, timeout: 15_000, step: "hash" })
    ).trim();

    // 3. 설정·매니페스트 제외 후 추출 (LLM 없음)
    await writeFile(path.join(workdir, ".graphifyignore"), GRAPHIFY_IGNORE_FILE, "utf8");

    const extractStart = Date.now();
    await run("graphify", ["extract", ".", "--code-only", "--force"], {
      cwd: workdir,
      timeout: EXTRACT_TIMEOUT_MS,
      step: "extract",
    });
    await run("graphify", ["cluster-only", ".", "--no-label", "--no-viz"], {
      cwd: workdir,
      timeout: EXTRACT_TIMEOUT_MS,
      step: "cluster",
    });
    const extractMs = Date.now() - extractStart;

    const raw = await readFile(path.join(workdir, "graphify-out", "graph.json"), "utf8");
    const graph = JSON.parse(raw) as GraphJson;
    if (!graph.nodes?.length) {
      throw new AnalysisError("그래프가 비어 있습니다 — 지원되는 코드 파일을 찾지 못했습니다", "extract");
    }

    // 4. concept 이름(1차, 결정론적) + 레이아웃
    const layoutStart = Date.now();
    const concepts = nameCommunities(graph);
    if (concepts.length === 0) {
      throw new AnalysisError("concept으로 쓸 만한 커뮤니티가 없습니다", "concepts");
    }
    const map = buildMapData({ ...graph, built_at_commit: commit }, concepts, slug);
    const layoutMs = Date.now() - layoutStart;

    return {
      repo: slug,
      commit,
      concepts,
      map,
      fileHashes,
      timings: { clone: cloneMs, extract: extractMs, layout: layoutMs },
    };
  } finally {
    // 5. 소스는 남기지 않는다
    await rm(workdir, { recursive: true, force: true });
  }
}
