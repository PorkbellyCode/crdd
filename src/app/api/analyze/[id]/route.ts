import { NextResponse } from "next/server";
import { getAnalysis, getConceptNames, getDebtForAnalysis, getJobRow, withConceptNames } from "@/db/repo";
import { getAccountId, getUserId } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJobRow(id);

  if (!job) {
    return NextResponse.json({ error: "작업을 찾을 수 없습니다" }, { status: 404 });
  }

  const analysis = job.analysisId ? await getAnalysis(job.analysisId) : null;
  // 점수는 concept 영속 키에 붙어 있고, 이 분석의 communityId로 옮겨서 돌려준다
  const debt = job.analysisId ? await getDebtForAnalysis(job.analysisId, await getUserId()) : {};
  // 분석 시점의 1차 이름 위에 2차(LLM)·수동으로 바뀐 최신 이름을 입힌다
  const map = analysis ? withConceptNames(analysis.map, await getConceptNames(analysis.id)) : undefined;

  return NextResponse.json({
    id: job.id,
    repo: job.repo,
    status: job.status,
    step: job.step,
    error: job.error ?? undefined,
    elapsedMs: ((job.finishedAt ?? Math.floor(Date.now() / 1000)) - job.createdAt) * 1000,
    analysisId: job.analysisId ?? undefined,
    // 소스는 보관하지 않으므로 돌려줄 것은 그래프와 점수뿐이다
    map,
    // 이름 고치기는 로그인한 사용자만 (PATCH /api/concepts)
    canRename: Boolean(await getAccountId()),
    timings: analysis?.timings,
    fileCount: analysis?.fileCount,
    debt,
  });
}
