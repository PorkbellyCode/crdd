/**
 * 분석 작업 큐 — MVP는 인메모리.
 *
 * 분석이 2~수십 초 걸리므로 HTTP 요청 안에서 끝내지 않고 작업으로 띄운 뒤
 * 상태를 폴링한다. 프로세스가 죽으면 작업도 사라지는데, P3에서 Postgres
 * 테이블로 옮기면서 해결한다 (별도 큐 제품은 쓰지 않는다).
 */
import { analyzeRepo, AnalysisError, parseRepo, type AnalysisResult } from "./analyze";

export type JobStatus = "queued" | "running" | "done" | "error";

export interface Job {
  id: string;
  repo: string;
  status: JobStatus;
  step: string;
  error?: string;
  result?: AnalysisResult;
  createdAt: number;
  finishedAt?: number;
}

type JobStore = Map<string, Job>;

// 개발 중 HMR로 모듈이 다시 로드돼도 작업이 날아가지 않게 globalThis에 둔다
const globalStore = globalThis as unknown as { __crddJobs?: JobStore };
const jobs: JobStore = globalStore.__crddJobs ?? new Map();
globalStore.__crddJobs = jobs;

const MAX_JOBS = 50;

export function createJob(repoInput: string): Job {
  const { owner, repo } = parseRepo(repoInput);
  const slug = `${owner}/${repo}`;
  const id = crypto.randomUUID();
  const job: Job = { id, repo: slug, status: "queued", step: "queued", createdAt: Date.now() };
  jobs.set(id, job);

  // 오래된 작업 정리 (인메모리라 무한히 쌓이면 안 된다)
  if (jobs.size > MAX_JOBS) {
    const oldest = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest) jobs.delete(oldest.id);
  }

  void (async () => {
    job.status = "running";
    job.step = "clone";
    try {
      job.result = await analyzeRepo(slug);
      job.status = "done";
      job.step = "done";
    } catch (error) {
      job.status = "error";
      job.step = error instanceof AnalysisError ? error.step : "unknown";
      job.error = error instanceof Error ? error.message : String(error);
    } finally {
      job.finishedAt = Date.now();
    }
  })();

  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
