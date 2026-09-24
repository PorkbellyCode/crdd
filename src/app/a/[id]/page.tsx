"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Stat, StatStrip } from "@/components/Stat";
import StartQuizButton from "@/components/StartQuizButton";
import UnderstandingMap from "@/components/UnderstandingMap";
import { Button } from "@/components/ui/button";
import { overallDebtRatio } from "@/lib/crdd/score";
import type { MapData } from "@/lib/crdd/types";

interface JobView {
  id: string;
  repo: string;
  status: "queued" | "running" | "done" | "error";
  step: string;
  error?: string;
  elapsedMs: number;
  analysisId?: string;
  map?: MapData;
  timings?: { clone: number; extract: number; layout: number };
  fileCount?: number;
  debt?: Record<number, number | null>;
}

const STEP_LABEL: Record<string, string> = {
  queued: "대기 중",
  clone: "레포 가져오는 중",
  hash: "파일 해시 기록 중",
  extract: "구조 분석 중",
  cluster: "개념으로 묶는 중",
  concepts: "이름 붙이는 중",
  done: "완료",
  parse: "주소 확인",
  unknown: "알 수 없는 단계",
};

export default function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<JobView | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const response = await fetch(`/api/analyze/${id}`, { cache: "no-store" });
        if (response.status === 404) {
          if (alive) setMissing(true);
          return;
        }
        const data: JobView = await response.json();
        if (!alive) return;
        setJob(data);
        if (data.status === "queued" || data.status === "running") {
          timer = setTimeout(poll, 1000);
        }
      } catch {
        if (alive) timer = setTimeout(poll, 2000);
      }
    }

    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id]);

  if (missing) {
    return (
      <main className="mx-auto max-w-5xl px-5 pt-10 pb-16">
        <h1 className="text-2xl font-bold tracking-tight">작업을 찾을 수 없습니다</h1>
        <p className="mt-2.5 max-w-[60ch] text-sm text-muted-foreground">
          분석 작업은 아직 서버 메모리에만 있어서 재시작하면 사라집니다. 다시 시도해 주세요.
        </p>
        <Button render={<Link href="/" />} variant="secondary" className="mt-5">
          처음으로
        </Button>
      </main>
    );
  }

  if (!job || job.status === "queued" || job.status === "running") {
    return (
      <main className="mx-auto max-w-5xl px-5 pt-10 pb-16">
        <p className="eyebrow mb-2.5">Analyzing</p>
        <h1 className="text-2xl font-bold tracking-tight">{job?.repo ?? "레포 분석 중"}</h1>
        <p className="mt-2.5 text-sm text-muted-foreground">
          {STEP_LABEL[job?.step ?? "queued"] ?? job?.step}…
        </p>
        <div className="mt-4 h-1 w-full max-w-md overflow-hidden rounded-full bg-secondary">
          <i className="block h-full w-1/3 animate-pulse rounded-full bg-primary" />
        </div>
        <p className="mt-3.5 font-mono text-[11px] text-dim">
          {Math.round((job?.elapsedMs ?? 0) / 1000)}초 경과 · 소스는 분석이 끝나면 삭제됩니다
        </p>
      </main>
    );
  }

  if (job.status === "error") {
    return (
      <main className="mx-auto max-w-5xl px-5 pt-10 pb-16">
        <p className="eyebrow mb-2.5">Failed · {STEP_LABEL[job.step] ?? job.step}</p>
        <h1 className="text-2xl font-bold tracking-tight">분석하지 못했습니다</h1>
        <p className="mt-2.5 max-w-[60ch] text-sm text-muted-foreground">{job.error}</p>
        <p className="mt-3 font-mono text-[11px] text-dim">
          public 레포인지, 주소가 맞는지 확인해 주세요.
        </p>
        <Button render={<Link href="/" />} variant="secondary" className="mt-5">
          다시 시도
        </Button>
      </main>
    );
  }

  const map = job.map!;
  // 퀴즈를 본 적 없는 concept은 콜드 스타트로 그린다
  const debt: Record<number, number | null> = Object.fromEntries(
    map.concepts.map((concept) => [concept.id, job.debt?.[concept.id] ?? null]),
  );
  const measured = map.concepts.filter((c) => debt[c.id] !== null);
  // 데모와 같은 공식 — 파일 tier 가중 평균, 퀴즈를 안 본 개념은 부채 100%로 친다
  const overall = overallDebtRatio(
    map.concepts.map((concept) => {
      const value = debt[concept.id];
      return { files: concept.files, score: value === null || value === undefined ? null : 100 - value };
    }),
  );

  return (
    <main className="mx-auto max-w-6xl px-5 pt-10 pb-16">
      <p className="eyebrow mb-2.5">Analyzed · {map.commit}</p>
      <h1 className="text-[clamp(24px,3.4vw,34px)] font-bold tracking-tight">{map.repo}</h1>
      <p className="mt-2.5 max-w-[64ch] text-sm text-muted-foreground">
        {measured.length === 0
          ? "구조 분석이 끝났습니다. 아직 퀴즈를 풀지 않아 모든 개념이 콜드 스타트 상태입니다 — 개념을 골라 퀴즈를 풀면 부채비율이 채워집니다."
          : `${map.concepts.length}개 개념 중 ${measured.length}개를 측정했습니다. 측정하지 않은 개념은 부채 100%로 계산합니다.`}
      </p>

      <StatStrip>
        <Stat value={`${overall}%`} label={`overall 부채비율 · 측정 ${measured.length}/${map.concepts.length}`} />
        <Stat value={map.counts.nodes} label="nodes" />
        <Stat value={map.counts.edges} label="edges" />
        <Stat value={map.concepts.length} label="concepts" />
        <Stat value={`${(job.elapsedMs / 1000).toFixed(1)}s`} label="분석 시간" />
      </StatStrip>

      <UnderstandingMap
        data={map}
        debt={debt}
        renderAction={(concept) =>
          job.analysisId ? (
            <StartQuizButton
              analysisId={job.analysisId}
              communityId={concept.id}
              returnTo={`/a/${id}`}
            />
          ) : null
        }
      />

      <p className="mt-6 font-mono text-[11px] text-dim">
        clone {job.timings?.clone}ms · extract {job.timings?.extract}ms · layout{" "}
        {job.timings?.layout}ms · 파일 {job.fileCount}개 해시 기록 ·{" "}
        <Link href="/" className="underline underline-offset-2">
          처음으로
        </Link>
      </p>
    </main>
  );
}
