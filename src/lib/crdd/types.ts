/** Graphify가 만든 graph.json (graphify extract --code-only 기준) */
export interface GraphNode {
  id: string;
  label: string;
  community: number;
  source_file?: string;
  /** "L62" 형태 */
  source_location?: string;
  file_type?: string;
}

export type GraphRelation =
  | "contains"
  | "imports"
  | "imports_from"
  | "calls"
  | "dynamic_import"
  | "indirect_call";

export interface GraphLink {
  source: string;
  target: string;
  relation: GraphRelation | string;
  confidence?: "EXTRACTED" | "INFERRED" | "AMBIGUOUS";
}

export interface GraphJson {
  nodes: GraphNode[];
  links: GraphLink[];
  /** Graphify가 그래프에 직접 기록하는 커밋 SHA */
  built_at_commit?: string;
  directed?: boolean;
}

/**
 * concept — Graphify 커뮤니티 하나에 대응한다.
 *
 * 키는 이름이 아니라 communityId다. 1차 이름(결정론적)이 2차(LLM)에서 바뀌어도
 * 점수 이력이 끊기면 안 되기 때문이다. MCP판 스키마는 이름을 키로 썼는데,
 * 웹앱으로 옮기면서 바뀐 부분이다.
 */
export interface Concept {
  communityId: number;
  name: string;
  /** 이름이 어떤 규칙에서 나왔는지 — 화면에 근거를 보여줄 수 있게 남긴다 */
  nameRule: string;
  /** "auto" = 결정론적 1차, "llm" = 사용자 키로 다듬음, "manual" = 사용자가 고침 */
  nameSource: "auto" | "llm" | "manual";
  files: string[];
  nodeCount: number;
}

export type AnswerOutcome =
  | "first_try"
  | "after_hint"
  | "after_explanation"
  | "unresolved";

export interface ConceptRecord {
  /** 내부 계산용. 화면에는 debtRatio(100 - score)만 노출한다 */
  score: number;
  files: string[];
  lastVerifiedCommit: string;
  lastQuizAt: string | null;
}

export interface HistoryEntry {
  at: string;
  commit: string;
  communityId: number;
  correct: number;
  total: number;
  scoreBefore: number;
  scoreAfter: number;
}

export interface ProjectStore {
  projectId: string;
  repo: string;
  updatedAt: string;
  concepts: Record<string, ConceptRecord>;
  history: HistoryEntry[];
}

/** 화면이 바로 그릴 수 있게 좌표까지 계산된 형태 (레이아웃은 서버에서 미리 계산한다) */
export interface MapConcept {
  id: number;
  name: string;
  nodes: number;
  files: string[];
  top: { label: string; file?: string | null; loc?: string | null; fan: number }[];
  x: number;
  y: number;
  r: number;
}

export interface MapData {
  repo: string;
  commit: string;
  counts: { nodes: number; edges: number; concepts: number };
  concepts: MapConcept[];
  clinks: { s: number; t: number; w: number }[];
  nodes: { l: string; f: string | null; c: number; x: number; y: number }[];
  links: { s: number; t: number; r: string }[];
}
