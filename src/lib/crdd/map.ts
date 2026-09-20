/**
 * graph.json + concept 목록 → 화면이 바로 그릴 수 있는 MapData.
 *
 * 개념 보기(접힌 상태)가 기본이고 파일 보기는 선택이다. porklog 실측에서
 * 374개 노드를 한 번에 펼치면 털뭉치가 되는 것을 확인했다.
 */
import { isNoiseFile } from "./ignore";
import { forceLayout, normalize } from "./layout";
import type { Concept, GraphJson, MapData } from "./types";

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 660;
const FAN_IN_RELATIONS = new Set(["imports", "imports_from", "calls"]);

export function buildMapData(graph: GraphJson, concepts: Concept[], repo: string): MapData {
  const conceptIds = new Set(concepts.map((c) => c.communityId));

  const nodes = graph.nodes.filter(
    (node) => conceptIds.has(node.community) && !isNoiseFile(node.source_file),
  );
  const indexById = new Map(nodes.map((node, i) => [node.id, i]));
  const links = graph.links.filter(
    (link) => indexById.has(link.source) && indexById.has(link.target),
  );

  // --- 파일 수준 레이아웃 ---
  const edges = links.map(
    (link) => [indexById.get(link.source)!, indexById.get(link.target)!] as [number, number],
  );
  const groups = nodes.map((node) => node.community);
  const nodePoints = normalize(
    forceLayout(nodes.length, edges, { groups, seed: 7 }),
    VIEW_WIDTH,
    VIEW_HEIGHT,
    40,
  );

  // --- 개념 수준 그래프 ---
  const orderedConcepts = [...concepts].sort((a, b) => a.communityId - b.communityId);
  const conceptIndex = new Map(orderedConcepts.map((c, i) => [c.communityId, i]));

  const interCount = new Map<string, number>();
  for (const link of links) {
    const a = nodes[indexById.get(link.source)!]!.community;
    const b = nodes[indexById.get(link.target)!]!.community;
    if (a === b) continue;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    interCount.set(key, (interCount.get(key) ?? 0) + 1);
  }

  const conceptEdges: [number, number][] = [];
  const conceptWeights: number[] = [];
  const clinks: MapData["clinks"] = [];
  for (const [key, count] of interCount) {
    const [a, b] = key.split(":").map(Number) as [number, number];
    const s = conceptIndex.get(a)!;
    const t = conceptIndex.get(b)!;
    conceptEdges.push([s, t]);
    conceptWeights.push(Math.min(count, 12) / 4);
    clinks.push({ s, t, w: count });
  }

  const conceptPoints = normalize(
    forceLayout(orderedConcepts.length, conceptEdges, {
      weights: conceptWeights,
      seed: 3,
      kScale: 1.35,
      iterations: 400,
    }),
    VIEW_WIDTH,
    VIEW_HEIGHT,
    90,
  );

  // --- 대표 심볼 (fan-in 상위) ---
  const fanIn = new Map<string, number>();
  for (const link of links) {
    if (!FAN_IN_RELATIONS.has(link.relation)) continue;
    fanIn.set(link.target, (fanIn.get(link.target) ?? 0) + 1);
  }
  const ranked = [...nodes].sort((a, b) => (fanIn.get(b.id) ?? 0) - (fanIn.get(a.id) ?? 0));
  const tops = new Map<number, MapData["concepts"][number]["top"]>();
  for (const node of ranked) {
    const bucket = tops.get(node.community) ?? [];
    if (bucket.length >= 6) continue;
    bucket.push({
      label: node.label,
      file: node.source_file ?? null,
      loc: node.source_location ?? null,
      fan: fanIn.get(node.id) ?? 0,
    });
    tops.set(node.community, bucket);
  }

  return {
    repo,
    commit: (graph.built_at_commit ?? "").slice(0, 8),
    counts: { nodes: nodes.length, edges: links.length, concepts: orderedConcepts.length },
    concepts: orderedConcepts.map((concept, i) => ({
      id: concept.communityId,
      name: concept.name,
      nodes: concept.nodeCount,
      files: concept.files,
      top: tops.get(concept.communityId) ?? [],
      x: conceptPoints[i]!.x,
      y: conceptPoints[i]!.y,
      r: Math.round((6 + 3.1 * Math.sqrt(concept.nodeCount)) * 10) / 10,
    })),
    clinks,
    nodes: nodes.map((node, i) => ({
      l: node.label,
      f: node.source_file ?? null,
      c: node.community,
      x: nodePoints[i]!.x,
      y: nodePoints[i]!.y,
    })),
    links: links.map((link) => ({
      s: indexById.get(link.source)!,
      t: indexById.get(link.target)!,
      r: link.relation,
    })),
  };
}
