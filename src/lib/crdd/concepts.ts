/**
 * Graphify 커뮤니티에 사람이 읽을 이름을 붙인다 (1차, LLM 불필요).
 *
 * 2단계 구조의 1단계다. 분석 직후 키 없이 즉시 이름을 만들어, 비로그인
 * 방문자도 이름이 붙은 그래프를 볼 수 있게 한다. 2단계(사용자 키로 LLM이
 * 다듬기 + 수동 수정)는 첫 퀴즈 시점에 붙는다.
 *
 * porklog 실측 결과: 커뮤니티 15개 전부 이름 생성, 실패 0개.
 * 한계: 모듈 이름이지 도메인 개념 이름은 아니다 ("Toc", "Chart").
 */
import { isNoiseFile } from "./ignore";
import type { Concept, GraphJson } from "./types";

const GENERIC_DIRS = new Set([
  "",
  "src",
  "app",
  "lib",
  "src/app",
  "src/lib",
  "src/components",
  "src/components/ui",
]);

/**
 * fan-in 1위여도 이름으로 쓰지 않는 범용 모듈명.
 * 이 필터가 결정적이다 — 없으면 커뮤니티 0이 utils.ts(fan-in 48)를 집어
 * "Utils"가 되지만, 건너뛰면 "Admin Stats"가 나온다.
 */
const GENERIC_MODULES = new Set([
  "utils",
  "index",
  "db",
  "client",
  "config",
  "types",
  "constants",
  "helpers",
  "page",
  "route",
  "layout",
]);

const FAN_IN_RELATIONS = new Set(["imports", "imports_from", "calls"]);

/** 이보다 작은 커뮤니티는 concept으로 쓰지 않는다 */
const MIN_NODES = 3;

function titleize(stem: string): string {
  return stem
    .replace(/\[|\]/g, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .split(/[-_/.]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function dirLabel(dir: string): string | null {
  const parts = dir.split("/").filter((p) => p && !["src", "app", "components", "lib"].includes(p));
  return parts.length ? titleize(parts.slice(-2).join("-")) : null;
}

export function nameCommunities(graph: GraphJson): Concept[] {
  const fileOf = new Map(graph.nodes.map((n) => [n.id, n.source_file ?? null]));

  const fanIn = new Map<string, number>();
  for (const link of graph.links) {
    if (!FAN_IN_RELATIONS.has(link.relation)) continue;
    const file = fileOf.get(link.target);
    if (!file || isNoiseFile(file)) continue;
    fanIn.set(file, (fanIn.get(file) ?? 0) + 1);
  }

  const byCommunity = new Map<number, typeof graph.nodes>();
  for (const node of graph.nodes) {
    const bucket = byCommunity.get(node.community);
    if (bucket) bucket.push(node);
    else byCommunity.set(node.community, [node]);
  }

  const used = new Set<string>();
  const concepts: Concept[] = [];

  const ordered = [...byCommunity.entries()].sort((a, b) => b[1].length - a[1].length);

  for (const [communityId, members] of ordered) {
    const files = [
      ...new Set(members.map((n) => n.source_file).filter((f): f is string => !!f && !isNoiseFile(f))),
    ];
    if (files.length === 0 || members.length < MIN_NODES) continue;

    let name: string | null = null;
    let rule = "";

    // 규칙 A — 파일의 60% 이상을 덮는 실제 디렉터리(파일 2개 이상)
    for (const depth of [4, 3, 2]) {
      const counts = new Map<string, number>();
      for (const file of files) {
        const dir = file.split("/").slice(0, depth).join("/");
        counts.set(dir, (counts.get(dir) ?? 0) + 1);
      }
      const [dir, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
      const inDir = files.filter((f) => f.startsWith(dir + "/"));
      if (inDir.length >= 2 && count / files.length >= 0.6 && !GENERIC_DIRS.has(dir)) {
        const candidate = dirLabel(dir);
        if (candidate && !used.has(candidate)) {
          name = candidate;
          rule = `directory ${dir}/`;
          break;
        }
      }
    }

    // 규칙 B — fan-in 상위 파일명 (범용 모듈명은 건너뜀)
    if (!name) {
      const ranked = [...files].sort((a, b) => (fanIn.get(b) ?? 0) - (fanIn.get(a) ?? 0));
      for (const file of ranked) {
        const base = file.split("/").pop() ?? file;
        const stem = base.replace(/\..*$/, "");
        if (GENERIC_MODULES.has(stem)) continue;
        const candidate = titleize(base);
        if (candidate && !used.has(candidate)) {
          name = candidate;
          rule = `fan-in ${file} (${fanIn.get(file) ?? 0})`;
          break;
        }
      }
    }

    if (!name) {
      name = `Community ${communityId}`;
      rule = "unnamed";
    }

    used.add(name);
    concepts.push({
      communityId,
      name,
      nameRule: rule,
      nameSource: "auto",
      files: files.sort(),
      nodeCount: members.length,
    });
  }

  return concepts;
}
