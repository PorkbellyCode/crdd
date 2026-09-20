/**
 * 저장·조회 레이어. 라우트와 작업 러너는 여기만 호출한다.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { analyses, concepts, jobs, projects, scores } from "./schema";
import type { AnalysisResult } from "@/lib/analysis/analyze";
import type { MapData } from "@/lib/crdd/types";

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
  const analysisId = crypto.randomUUID();

  await db
    .insert(analyses)
    .values({
      id: analysisId,
      projectId,
      commit: result.commit,
      mapJson: JSON.stringify(result.map),
      fileHashesJson: JSON.stringify(result.fileHashes),
      nodeCount: result.map.counts.nodes,
      edgeCount: result.map.counts.edges,
      conceptCount: result.map.counts.concepts,
      timingsJson: JSON.stringify(result.timings),
    })
    .onConflictDoUpdate({
      target: [analyses.projectId, analyses.commit],
      set: {
        mapJson: JSON.stringify(result.map),
        fileHashesJson: JSON.stringify(result.fileHashes),
        nodeCount: result.map.counts.nodes,
        edgeCount: result.map.counts.edges,
        conceptCount: result.map.counts.concepts,
        timingsJson: JSON.stringify(result.timings),
      },
    });

  // concept은 커뮤니티 ID 기준으로 갱신한다. 이름이 2차(LLM)나 수동으로 바뀐
  // 경우에는 덮어쓰지 않는다 — 사용자가 고친 이름이 재분석으로 사라지면 안 된다.
  for (const concept of result.concepts) {
    const existing = await db
      .select()
      .from(concepts)
      .where(
        and(eq(concepts.projectId, projectId), eq(concepts.communityId, concept.communityId)),
      )
      .limit(1);

    const keepName = existing[0] && existing[0].nameSource !== "auto";

    await db
      .insert(concepts)
      .values({
        id: crypto.randomUUID(),
        projectId,
        communityId: concept.communityId,
        name: concept.name,
        nameRule: concept.nameRule,
        nameSource: concept.nameSource,
        filesJson: JSON.stringify(concept.files),
        nodeCount: concept.nodeCount,
      })
      .onConflictDoUpdate({
        target: [concepts.projectId, concepts.communityId],
        set: {
          ...(keepName ? {} : { name: concept.name, nameRule: concept.nameRule }),
          filesJson: JSON.stringify(concept.files),
          nodeCount: concept.nodeCount,
          updatedAt: Math.floor(Date.now() / 1000),
        },
      });
  }

  return { projectId, analysisId };
}

export async function getAnalysis(analysisId: string) {
  const rows = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    map: JSON.parse(row.mapJson) as MapData,
    timings: row.timingsJson
      ? (JSON.parse(row.timingsJson) as { clone: number; extract: number; layout: number })
      : undefined,
    fileCount: Object.keys(JSON.parse(row.fileHashesJson) as Record<string, string>).length,
  };
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
  return { project: project[0], analysis: rows[0], map: JSON.parse(rows[0].mapJson) as MapData };
}

/** communityId → 부채비율. 퀴즈를 본 적 없는 concept은 null(콜드 스타트) */
export async function getDebtByCommunity(
  projectId: string,
  userId = "local",
): Promise<Record<number, number | null>> {
  const rows = await db
    .select()
    .from(scores)
    .where(and(eq(scores.projectId, projectId), eq(scores.userId, userId)));

  const debt: Record<number, number | null> = {};
  for (const row of rows) {
    debt[row.communityId] = row.lastQuizAt ? 100 - row.score : null;
  }
  return debt;
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
