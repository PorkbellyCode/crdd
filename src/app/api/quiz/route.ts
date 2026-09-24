import { NextResponse } from "next/server";
import { createQuiz } from "@/db/quiz-repo";
import { getAnalysis, getConcept, getConceptKeys } from "@/db/repo";
import { fetchQuizMaterial, selectQuizFiles } from "@/lib/github/source";
import { readLlmCredentials } from "@/lib/llm/request";
import { errorResponse, QuizError } from "@/lib/quiz/errors";
import { initialProgress } from "@/lib/quiz/flow";
import { generateQuestions } from "@/lib/quiz/prompts";
import { toQuizView } from "@/lib/quiz/view";
import { ensureUserId } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * 출제 — concept 하나에 대해 문항을 만든다.
 *   분석 스냅샷 → concept 키 → 커밋 고정 코드 조회 → LLM 출제 → 세션 저장
 */
export async function POST(request: Request) {
  try {
    const { apiKey, model } = readLlmCredentials(request);
    const body = (await request.json().catch(() => null)) as {
      analysisId?: unknown;
      communityId?: unknown;
    } | null;
    if (typeof body?.analysisId !== "string" || typeof body.communityId !== "number") {
      throw new QuizError("analysisId와 communityId가 필요합니다", 400);
    }

    const analysis = await getAnalysis(body.analysisId);
    if (!analysis) throw new QuizError("분석을 찾을 수 없습니다", 404);

    const mapIndex = analysis.map.concepts.findIndex((c) => c.id === body.communityId);
    const mapConcept = analysis.map.concepts[mapIndex];
    const conceptKey = (await getConceptKeys(analysis.id))[body.communityId as number];
    if (!mapConcept || !conceptKey) throw new QuizError("이 분석에 없는 개념입니다", 404);
    const stored = await getConcept(analysis.projectId, conceptKey);

    const neighbors = analysis.map.clinks
      .filter((link) => link.s === mapIndex || link.t === mapIndex)
      .sort((a, b) => b.w - a.w)
      .slice(0, 4)
      .map((link) => analysis.map.concepts[link.s === mapIndex ? link.t : link.s]!.name);

    const paths = selectQuizFiles(
      mapConcept.files,
      mapConcept.top.map((t) => t.file),
    );
    const material = await fetchQuizMaterial(analysis.map.repo, analysis.commit, paths);
    if (material.length === 0) {
      throw new QuizError("GitHub에서 코드를 가져오지 못했습니다. 레포가 아직 public인지 확인해 주세요.", 502);
    }

    const questions = await generateQuestions({
      apiKey,
      model,
      repo: analysis.map.repo,
      commit: analysis.commit,
      concept: { name: stored?.name ?? mapConcept.name, files: mapConcept.files, top: mapConcept.top },
      neighbors,
      material,
    });
    if (questions.length === 0) {
      throw new QuizError("쓸 만한 문항을 만들지 못했습니다. 다시 시도해 주세요.", 502);
    }

    const userId = await ensureUserId();
    const progress = initialProgress(questions.length);
    const id = await createQuiz({
      userId,
      projectId: analysis.projectId,
      analysisId: analysis.id,
      conceptKey,
      conceptName: stored?.name ?? mapConcept.name,
      commit: analysis.commit,
      model,
      questions,
      progress,
    });

    return NextResponse.json(
      toQuizView({
        id,
        analysisId: analysis.id,
        conceptName: stored?.name ?? mapConcept.name,
        commit: analysis.commit,
        status: "active",
        questions,
        progress,
        result: null,
      }),
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, "문항을 만들지 못했습니다");
  }
}
