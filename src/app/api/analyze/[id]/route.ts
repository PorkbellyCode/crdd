import { NextResponse } from "next/server";
import { getJob } from "@/lib/analysis/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return NextResponse.json({ error: "작업을 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    repo: job.repo,
    status: job.status,
    step: job.step,
    error: job.error,
    elapsedMs: (job.finishedAt ?? Date.now()) - job.createdAt,
    // 소스는 보관하지 않으므로 돌려줄 것은 그래프와 concept뿐이다
    map: job.result?.map,
    timings: job.result?.timings,
    fileCount: job.result ? Object.keys(job.result.fileHashes).length : undefined,
  });
}
