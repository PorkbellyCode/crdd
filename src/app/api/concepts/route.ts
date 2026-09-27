import { NextResponse } from "next/server";
import { getAnalysis, getConceptKeys, renameConcept } from "@/db/repo";
import { normalizeConceptName } from "@/lib/crdd/concepts";
import { getAccountId } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 개념 이름 고치기 — 로그인한 사용자만.
 *
 * 이름은 프로젝트 공용이라(점수와 달리 사용자별이 아니다) 익명 방문자에게 열어 두면
 * 누구나 남의 지도 이름을 바꿀 수 있다. 계정이 있어야 누가 바꿨는지 책임이 생긴다.
 */
export async function PATCH(request: Request) {
  if (!(await getAccountId())) {
    return NextResponse.json({ error: "로그인하면 개념 이름을 고칠 수 있습니다" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    analysisId?: unknown;
    communityId?: unknown;
    name?: unknown;
  } | null;
  const name = normalizeConceptName(body?.name);
  if (typeof body?.analysisId !== "string" || typeof body.communityId !== "number") {
    return NextResponse.json({ error: "analysisId와 communityId가 필요합니다" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "이름은 1~40자로 써 주세요" }, { status: 400 });
  }

  const analysis = await getAnalysis(body.analysisId);
  if (!analysis) return NextResponse.json({ error: "분석을 찾을 수 없습니다" }, { status: 404 });
  const key = (await getConceptKeys(analysis.id))[body.communityId];
  if (!key) return NextResponse.json({ error: "이 분석에 없는 개념입니다" }, { status: 404 });

  await renameConcept(analysis.projectId, key, name, "manual");
  return NextResponse.json({ name, nameSource: "manual" });
}
