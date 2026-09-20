import { NextResponse } from "next/server";
import { AnalysisError } from "@/lib/analysis/analyze";
import { startJob } from "@/lib/analysis/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let repo: unknown;
  try {
    ({ repo } = await request.json());
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다" }, { status: 400 });
  }

  if (typeof repo !== "string" || repo.trim() === "") {
    return NextResponse.json({ error: "레포 주소를 입력하세요" }, { status: 400 });
  }

  try {
    const job = await startJob(repo);
    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    const message = error instanceof AnalysisError ? error.message : "분석을 시작할 수 없습니다";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
