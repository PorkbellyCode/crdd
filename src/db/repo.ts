/**
 * 저장·조회 레이어. 라우트와 작업 러너는 여기만 호출한다.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { analyses, concepts, jobs, projects, scores } from "./schema";
import type { AnalysisResult } from "@/lib/analysis/analyze";
import { assignConceptKeys } from "@/lib/crdd/identity";
import type { MapData } from "@/lib/crdd/types";

const nowSec = () => Math.floor(Date.now() / 1000);

export async function ensureProject(repo: string, rootCommit?: string): Promise<string> {
  const existing = await db.select().from(projects).where(eq(projects.repo, repo)).limit(1);
  if (existing[0]) {
    return existing[0].id;
  }
  const id = crypto.randomUUID();
  await db.insert(projects).values({ id, repo, rootCommit });
  return id;
}

/** 분석 결과 저장 — 같은 커밋을 다시 분석하면 최신 것으로 덮어쓴다 */
export async function saveAnalysis(result: AnalysisResult): Promise<{
  projectId: string;
  analysisId: string;
}> {
  const projectId = await ensureProject(result.repo);

  // concept 영속 키 배정 — 직전 concept들과 파일 집합 유사도로 짝을 짓는다.
  // communityId는 재분석마다 다시 매겨지므로 그대로 쓰면 점수가 엉뚱한 곳에 붙는다.
  const previous = await db.select().from(concepts).where(eq(concepts.projectId, projectId));
  const keyByCommunity = assignConceptKeys(
    previous.map((row) => ({ key: row.key, files: JSON.parse(row.filesJson) as string[] })),
    result.concepts.map((concept) => ({ communityId: concept.communityId, files: concept.files })),
  );
  const conceptKeysJson = JSON.stringify(Object.fromEntries(keyByCommunity));

  const analysisId = crypto.randomUUID();
  const analysisValues = {
    mapJson: JSON.stringify(result.map),
    fileHashesJson: JSON.stringify(result.fileHashes),
    conceptKeysJson,
    nodeCount: result.map.counts.nodes,
    edgeCount: result.map.counts.edges,
    conceptCount: result.map.counts.concepts,
    timingsJson: JSON.stringify(result.timings),
  };
  const [saved] = await db
    .insert(analyses)
    .values({ id: analysisId, projectId, commit: result.commit, ...analysisValues })
    .onConflictDoUpdate({ target: [analyses.projectId, analyses.commit], set: analysisValues })
    .returning({ id: analyses.id });

  // 이번 분석에 없는 concept은 비활성으로 — 점수 이력 때문에 지우지는 않는다
  await db.update(concepts).set({ active: false }).where(eq(concepts.projectId, projectId));

  for (const concept of result.concepts) {
    const key = keyByCommunity.get(concept.communityId)!;
    const existing = previous.find((row) => row.key === key);
    // 이름이 2차(LLM)나 수동으로 바뀐 경우에는 덮어쓰지 않는다
    const keepName = existing && existing.nameSource !== "auto";

    await db
      .insert(concepts)
      .values({
        id: crypto.randomUUID(),
        projectId,
        key,
        communityId: concept.communityId,
        active: true,
        name: concept.name,
        nameRule: concept.nameRule,
        nameSource: concept.nameSource,
        filesJson: JSON.stringify(concept.files),
        nodeCount: concept.nodeCount,
      })
      .onConflictDoUpdate({
        target: [concepts.projectId, concepts.key],
        set: {
          ...(keepName ? {} : { name: concept.name, nameRule: concept.nameRule }),
          communityId: concept.communityId,
          active: true,
          filesJson: JSON.stringify(concept.files),
          nodeCount: concept.nodeCount,
          updatedAt: nowSec(),
        },
      });
  }

  return { projectId, analysisId: saved?.id ?? analysisId };
}

function parseAnalysisRow(row: typeof analyses.$inferSelect) {
  return {
    ...row,
    map: JSON.parse(row.mapJson) as MapData,
    timings: row.timingsJson
      ? (JSON.parse(row.timingsJson) as { clone: number; extract: number; layout: number })
      : undefined,
    fileCount: Object.keys(JSON.parse(row.fileHashesJson) as Record<string, string>).length,
    conceptKeys: row.conceptKeysJson
      ? (JSON.parse(row.conceptKeysJson) as Record<string, string>)
      : null,
  };
}

export async function getAnalysis(analysisId: string) {
  const rows = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  return rows[0] ? parseAnalysisRow(rows[0]) : null;
}

export async function getLatestAnalysisByRepo(repo: string) {
  const project = await db.select().from(projects).where(eq(projects.repo, repo)).limit(1);
  if (!project[0]) return null;
  const rows = await db
    .select()
    .from(analyses)
    .where(eq(analyses.projectId, project[0].id))
    .orderBy(desc(analyses.createdAt))
    .limit(1);
  if (!rows[0]) return null;
  return { project: project[0], analysis: parseAnalysisRow(rows[0]), map: JSON.parse(rows[0].mapJson) as MapData };
}

/** 분석 하나의 communityId → concept 키. 키 기록이 없는 옛 분석은 현재 concept 표로 대신한다 */
export async function getConceptKeys(analysisId: string): Promise<Record<number, string>> {
  const analysis = await getAnalysis(analysisId);
  if (!analysis) return {};
  if (analysis.conceptKeys) {
    return Object.fromEntries(
      Object.entries(analysis.conceptKeys).map(([communityId, key]) => [Number(communityId), key]),
    );
  }
  const rows = await db
    .select()
    .from(concepts)
    .where(and(eq(concepts.projectId, analysis.projectId), eq(concepts.active, true)));
  return Object.fromEntries(rows.map((row) => [row.communityId, row.key]));
}

/**
 * 분석 화면용 communityId → 부채비율. 퀴즈를 본 적 없는 concept은 null(콜드 스타트).
 * userId가 없으면(익명 ID 쿠키가 아직 없는 첫 방문) 전부 콜드 스타트다.
 */
export async function getDebtForAnalysis(
  analysisId: string,
  userId: string | null,
): Promise<Record<number, number | null>> {
  const analysis = await getAnalysis(analysisId);
  if (!analysis || !userId) return {};
  const keys = await getConceptKeys(analysisId);

  const rows = await db
    .select()
    .from(scores)
    .where(and(eq(scores.projectId, analysis.projectId), eq(scores.userId, userId)));
  const byKey = new Map(rows.map((row) => [row.conceptKey, row]));

  const debt: Record<number, number | null> = {};
  for (const [communityId, key] of Object.entries(keys)) {
    const row = byKey.get(key);
    debt[Number(communityId)] = row?.lastQuizAt ? 100 - row.score : null;
  }
  return debt;
}

export async function getConcept(projectId: string, key: string) {
  const rows = await db
    .select()
    .from(concepts)
    .where(and(eq(concepts.projectId, projectId), eq(concepts.key, key)))
    .limit(1);
  const row = rows[0];
  return row ? { ...row, files: JSON.parse(row.filesJson) as string[] } : null;
}

// --- jobs ---

export async function createJobRow(repo: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(jobs).values({ id, repo, status: "queued", step: "queued" });
  return id;
}

export async function updateJob(
  id: string,
  patch: Partial<{
    status: string;
    step: string;
    error: string | null;
    projectId: string;
    analysisId: string;
    finishedAt: number;
  }>,
) {
  await db.update(jobs).set(patch).where(eq(jobs.id, id));
}

export async function getJobRow(id: string) {
  const rows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return rows[0] ?? null;
}
