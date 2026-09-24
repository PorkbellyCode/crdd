import { NextResponse } from "next/server";
import { AnalysisError } from "@/lib/analysis/analyze";
import { startJob } from "@/lib/analysis/jobs";
import { getAccountId } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 분석은 서버 자원(clone·AST 추출)을 쓴다. 누구나 임의의 레포를 돌리지 못하게
  // 새 분석은 로그인한 사용자만 요청할 수 있다. 결과 보기와 데모는 비로그인 공개.
  if (!(await getAccountId())) {
    return NextResponse.json({ error: "로그인 후 분석할 수 있습니다" }, { status: 401 });
  }

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
