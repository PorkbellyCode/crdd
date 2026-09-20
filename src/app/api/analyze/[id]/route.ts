import { NextResponse } from "next/server";
import { getAnalysis, getDebtByCommunity, getJobRow } from "@/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJobRow(id);

  if (!job) {
    return NextResponse.json({ error: "작업을 찾을 수 없습니다" }, { status: 404 });
  }

  const analysis = job.analysisId ? await getAnalysis(job.analysisId) : null;
  const debt = job.projectId ? await getDebtByCommunity(job.projectId) : {};

  return NextResponse.json({
    id: job.id,
    repo: job.repo,
    status: job.status,
    step: job.step,
    error: job.error ?? undefined,
    elapsedMs: ((job.finishedAt ?? Math.floor(Date.now() / 1000)) - job.createdAt) * 1000,
    // 소스는 보관하지 않으므로 돌려줄 것은 그래프와 점수뿐이다
    map: analysis?.map,
    timings: analysis?.timings,
    fileCount: analysis?.fileCount,
    debt,
  });
}
