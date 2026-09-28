import { NextResponse } from "next/server";
import { createQuiz } from "@/db/quiz-repo";
import { getAnalysis, getConcept, getConceptKeys, getConceptNames, renameConcept } from "@/db/repo";
import { fetchQuizMaterial, selectQuizFiles } from "@/lib/github/source";
import { readLlmCredentials } from "@/lib/llm/request";
import { errorResponse, QuizError } from "@/lib/quiz/errors";
import { initialProgress } from "@/lib/quiz/flow";
import { generateQuestions } from "@/lib/quiz/prompts";
import { conceptStructure, renderStructure } from "@/lib/quiz/structure";
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
    const credentials = readLlmCredentials(request);
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

    const names = await getConceptNames(analysis.id);
    const neighbors = analysis.map.clinks
      .filter((link) => link.s === mapIndex || link.t === mapIndex)
      .sort((a, b) => b.w - a.w)
      .slice(0, 4)
      .map((link) => {
        const other = analysis.map.concepts[link.s === mapIndex ? link.t : link.s]!;
        return names[other.id]?.name ?? other.name;
      });

    // 구조 요약 — 진입점·개념 안 호출 흐름·다른 개념과 주고받는 곳. 재료 파일도 흐름 순서로 고른다
    const structure = conceptStructure(analysis.map, mapIndex, (id) => {
      const other = analysis.map.concepts.find((c) => c.id === id);
      return names[id]?.name ?? other?.name ?? `#${id}`;
    });
    const paths = selectQuizFiles(mapConcept.files, structure.rankedFiles);
    const material = await fetchQuizMaterial(analysis.map.repo, analysis.commit, paths);
    if (material.length === 0) {
      throw new QuizError("GitHub에서 코드를 가져오지 못했습니다. 레포가 아직 public인지 확인해 주세요.", 502);
    }

    const { questions, conceptName: suggested } = await generateQuestions({
      ...credentials,
      repo: analysis.map.repo,
      commit: analysis.commit,
      concept: { name: stored?.name ?? mapConcept.name, files: mapConcept.files, top: mapConcept.top },
      neighbors,
      structure: renderStructure(structure),
      material,
    });
    if (questions.length === 0) {
      throw new QuizError("쓸 만한 문항을 만들지 못했습니다. 다시 시도해 주세요.", 502);
    }

    // 2차 이름 — 아직 1차(파일 구조) 이름이면 출제하면서 받은 제안으로 바꾼다.
    // 사람이 고친 이름이나 이미 다듬은 이름은 건드리지 않는다 (renameConcept가 auto일 때만 바꾼다)
    let conceptName = stored?.name ?? mapConcept.name;
    if (suggested && stored?.nameSource === "auto") {
      if (await renameConcept(analysis.projectId, conceptKey, suggested, "llm")) conceptName = suggested;
    }

    const userId = await ensureUserId();
    const progress = initialProgress(questions.length);
    const id = await createQuiz({
      userId,
      projectId: analysis.projectId,
      analysisId: analysis.id,
      conceptKey,
      conceptName,
      commit: analysis.commit,
      // 어느 제공자의 어떤 모델로 냈는지 — 키는 저장하지 않는다
      model: `${credentials.provider}:${credentials.model}`,
      questions,
      progress,
    });

    return NextResponse.json(
      toQuizView({
        id,
        analysisId: analysis.id,
        conceptName,
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
