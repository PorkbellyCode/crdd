/**
 * 출제용 구조 요약 (순수 함수).
 *
 * 코드 조각만 주면 모델은 "이 함수가 뭘 하나"를 묻는다. 실제 키로 porklog Tech Digest를
 * 출제해 보니 3문항 중 2문항이 보조 스크립트 역할, RSS/Atom 필드 매핑 같은 지엽적인
 * 문제였다. 이미 가진 그래프로 이 개념의 진입점·내부 호출 흐름·다른 개념과 주고받는
 * 지점을 요약해 함께 넘기고, 출제 재료가 될 파일도 흐름 순서로 고른다.
 *
 * 엣지 방향은 Graphify 기준 "source가 target에 의존한다"(import·호출하는 쪽 → 당하는 쪽).
 */
import type { MapData } from "@/lib/crdd/types";

const DEPENDENCY = new Set(["imports", "imports_from", "calls", "dynamic_import", "indirect_call"]);

/** 앱이 실행되는 입구 — 라우트, 페이지, cron, 서버 액션, 진입 스크립트가 아닌 앱 코드 */
const ENTRY_PATTERN =
  /(^|\/)(route|page|layout|middleware)\.[cm]?[jt]sx?$|(^|\/)(pages|api)\/|(^|\/)(main|server)\.[cm]?[jt]s$|Controller\.(java|kt)$/;
/** 보조 파일 — 개념에 이것뿐일 때만 재료로 쓴다 */
const AUXILIARY_PATTERN = /(^|\/)(scripts?|tests?|__tests__|__mocks__|e2e|examples?|fixtures?)\/|\.(test|spec|stories)\.[cm]?[jt]sx?$/;

export interface ConceptStructure {
  /** 흐름이 시작되는 파일 (보조 파일 제외) */
  entries: string[];
  /** 개념 안 파일 간 호출 — "GET() @route.ts → fetchFeed() @fetch-feeds.ts" */
  calls: { from: string; fromFile: string; to: string; toFile: string }[];
  /** 다른 개념이 이 개념을 쓰는 곳 */
  usedBy: { concept: string; fromFile: string; toFile: string }[];
  /** 이 개념이 쓰는 다른 개념 */
  uses: { concept: string; fromFile: string; toFile: string }[];
  /** 출제 재료로 넘길 파일 순서 — 진입점 → 흐름 순 → 나머지 → 보조 파일 */
  rankedFiles: string[];
}

export function isAuxiliaryFile(path: string): boolean {
  return AUXILIARY_PATTERN.test(path);
}

export function conceptStructure(
  map: MapData,
  conceptIndex: number,
  nameOf: (communityId: number) => string = (id) => map.concepts.find((c) => c.id === id)?.name ?? `#${id}`,
): ConceptStructure {
  const concept = map.concepts[conceptIndex]!;
  const files = new Set(concept.files);
  const inConcept = (file: string | null | undefined): file is string => !!file && files.has(file);

  // 파일 단위 의존 그래프 (개념 안)
  const out = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  for (const file of files) {
    out.set(file, new Set());
    indegree.set(file, 0);
  }

  const calls: ConceptStructure["calls"] = [];
  const seenCall = new Set<string>();
  const usedBy = new Map<string, ConceptStructure["usedBy"][number]>();
  const uses = new Map<string, ConceptStructure["uses"][number]>();

  for (const link of map.links) {
    if (!DEPENDENCY.has(link.r)) continue;
    const a = map.nodes[link.s];
    const b = map.nodes[link.t];
    if (!a?.f || !b?.f || a.f === b.f) continue;

    if (inConcept(a.f) && inConcept(b.f)) {
      if (!out.get(a.f)!.has(b.f)) {
        out.get(a.f)!.add(b.f);
        indegree.set(b.f, indegree.get(b.f)! + 1);
      }
      if (link.r === "calls" || link.r === "indirect_call") {
        const key = `${a.l}|${a.f}|${b.l}|${b.f}`;
        if (!seenCall.has(key)) {
          seenCall.add(key);
          calls.push({ from: a.l, fromFile: a.f, to: b.l, toFile: b.f });
        }
      }
    } else if (inConcept(b.f) && !inConcept(a.f)) {
      const key = `${a.f}|${b.f}`;
      if (!usedBy.has(key)) usedBy.set(key, { concept: nameOf(a.c), fromFile: a.f, toFile: b.f });
    } else if (inConcept(a.f) && !inConcept(b.f)) {
      const key = `${a.f}|${b.f}`;
      if (!uses.has(key)) uses.set(key, { concept: nameOf(b.c), fromFile: a.f, toFile: b.f });
    }
  }

  const main = concept.files.filter((file) => !isAuxiliaryFile(file));
  // 진입점: 이름이 입구처럼 생긴 파일, 없으면 개념 안에서 아무도 의존하지 않고 다른 파일에 의존하는 파일
  let entries = main.filter((file) => ENTRY_PATTERN.test(file));
  if (entries.length === 0) {
    entries = main.filter((file) => indegree.get(file) === 0 && out.get(file)!.size > 0);
  }
  if (entries.length === 0) {
    entries = [...main].sort((x, y) => out.get(y)!.size - out.get(x)!.size).slice(0, 1);
  }

  // 진입점에서 너비 우선으로 흐름 순서를 만든다
  const order: string[] = [];
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (order.includes(file)) continue;
    order.push(file);
    for (const next of out.get(file) ?? []) if (!isAuxiliaryFile(next)) queue.push(next);
  }
  const rest = main
    .filter((file) => !order.includes(file))
    .sort((x, y) => out.get(y)!.size + indegree.get(y)! - (out.get(x)!.size + indegree.get(x)!));
  const auxiliary = concept.files.filter(isAuxiliaryFile);
  // 재료는 파일 수 상한(5개)이 있다. 비슷한 말단 파일(fetch-a, fetch-b …)이 앞자리를 다 차지하면
  // 흐름의 뒷단(요약·저장)이 빠진다. 진입점 다음에는 다른 파일을 부르는 파일을 먼저, 말단은 뒤로
  const isLeaf = (file: string) => (out.get(file)?.size ?? 0) === 0;
  const flow = [
    ...order.filter((file) => entries.includes(file)),
    ...order.filter((file) => !entries.includes(file) && !isLeaf(file)),
    ...order.filter((file) => !entries.includes(file) && isLeaf(file)),
  ];

  // 호출도 흐름 순서로 — 먼저 도달하는 파일에서 나가는 호출이 앞에
  const rank = new Map([...order, ...rest].map((file, i) => [file, i]));
  calls.sort((x, y) => (rank.get(x.fromFile) ?? 999) - (rank.get(y.fromFile) ?? 999));

  return {
    entries,
    calls: calls.filter((call) => !isAuxiliaryFile(call.fromFile)),
    usedBy: [...usedBy.values()].filter((item) => !isAuxiliaryFile(item.fromFile)),
    uses: [...uses.values()].filter((item) => !isAuxiliaryFile(item.fromFile)),
    rankedFiles: [...flow, ...rest, ...auxiliary],
  };
}

const short = (path: string) => path.split("/").slice(-2).join("/");

/** 프롬프트에 넣을 요약문. 줄 수를 제한해 코드 재료보다 앞서지 않게 한다 */
export function renderStructure(structure: ConceptStructure): string {
  const lines: string[] = [];
  lines.push(`진입점: ${structure.entries.join(", ") || "(찾지 못함)"}`);
  if (structure.calls.length > 0) {
    lines.push("개념 안 파일 간 호출 (흐름 순):");
    for (const call of structure.calls.slice(0, 24)) {
      lines.push(`  ${call.from} @${short(call.fromFile)} → ${call.to} @${short(call.toFile)}`);
    }
  }
  const group = (items: { concept: string; fromFile: string; toFile: string }[]) => {
    const byConcept = new Map<string, string[]>();
    for (const item of items) {
      const list = byConcept.get(item.concept) ?? [];
      const text = `${short(item.fromFile)} → ${short(item.toFile)}`;
      if (!list.includes(text)) list.push(text);
      byConcept.set(item.concept, list);
    }
    return [...byConcept].slice(0, 6).map(([concept, list]) => `  [${concept}] ${list.slice(0, 3).join(", ")}`);
  };
  if (structure.usedBy.length > 0) lines.push("다른 개념이 이 개념을 쓰는 곳:", ...group(structure.usedBy));
  if (structure.uses.length > 0) lines.push("이 개념이 쓰는 다른 개념:", ...group(structure.uses));
  return lines.join("\n");
}
