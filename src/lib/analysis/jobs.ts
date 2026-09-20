/**
 * 분석 작업 실행기.
 *
 * 작업 상태와 결과는 DB(jobs/analyses)에 쓴다. 프로세스가 재시작해도 끝난
 * 분석은 남고, 인스턴스가 여러 개여도 같은 상태를 본다. 실행 자체는 아직
 * 이 프로세스 안에서 일어나므로, 실행 중이던 작업은 재시작 시 running으로
 * 남는다 — 별도 워커로 분리할 때 정리한다.
 */
import { createJobRow, saveAnalysis, updateJob } from "@/db/repo";
import { analyzeRepo, AnalysisError, parseRepo } from "./analyze";

export async function startJob(repoInput: string): Promise<{ id: string; repo: string }> {
  const { owner, repo } = parseRepo(repoInput);
  const slug = `${owner}/${repo}`;
  const id = await createJobRow(slug);

  void (async () => {
    try {
      await updateJob(id, { status: "running", step: "clone" });
      const result = await analyzeRepo(slug);
      const { projectId, analysisId } = await saveAnalysis(result);
      await updateJob(id, {
        status: "done",
        step: "done",
        projectId,
        analysisId,
        finishedAt: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      await updateJob(id, {
        status: "error",
        step: error instanceof AnalysisError ? error.step : "unknown",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: Math.floor(Date.now() / 1000),
      });
    }
  })();

  return { id, repo: slug };
}
