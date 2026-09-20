"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import UnderstandingMap from "@/components/UnderstandingMap";
import type { MapData } from "@/lib/crdd/types";

interface JobView {
  id: string;
  repo: string;
  status: "queued" | "running" | "done" | "error";
  step: string;
  error?: string;
  elapsedMs: number;
  map?: MapData;
  timings?: { clone: number; extract: number; layout: number };
  fileCount?: number;
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
      <main className="wrap">
        <h1>작업을 찾을 수 없습니다</h1>
        <p className="lede">
          분석 작업은 아직 서버 메모리에만 있어서 재시작하면 사라집니다. 다시 시도해 주세요.
        </p>
        <p style={{ marginTop: 20 }}>
          <Link className="btn" href="/">
            처음으로
          </Link>
        </p>
      </main>
    );
  }

  if (!job || job.status === "queued" || job.status === "running") {
    return (
      <main className="wrap">
        <p className="kicker">Analyzing</p>
        <h1>{job?.repo ?? "레포 분석 중"}</h1>
        <p className="lede">{STEP_LABEL[job?.step ?? "queued"] ?? job?.step}…</p>
        <p className="note" style={{ marginTop: 14 }}>
          {Math.round((job?.elapsedMs ?? 0) / 1000)}초 경과 · 소스는 분석이 끝나면 삭제됩니다
        </p>
      </main>
    );
  }

  if (job.status === "error") {
    return (
      <main className="wrap">
        <p className="kicker">Failed · {STEP_LABEL[job.step] ?? job.step}</p>
        <h1>분석하지 못했습니다</h1>
        <p className="lede">{job.error}</p>
        <p className="note" style={{ marginTop: 12 }}>
          public 레포인지, 주소가 맞는지 확인해 주세요.
        </p>
        <p style={{ marginTop: 20 }}>
          <Link className="btn" href="/">
            다시 시도
          </Link>
        </p>
      </main>
    );
  }

  const map = job.map!;
  // 퀴즈를 아직 풀지 않았으므로 모든 concept이 콜드 스타트다 (부채비율 100%)
  const debt: Record<number, number | null> = Object.fromEntries(
    map.concepts.map((concept) => [concept.id, null]),
  );

  return (
    <main className="wrap">
      <p className="kicker">Analyzed · {map.commit}</p>
      <h1>{map.repo}</h1>
      <p className="lede">
        구조 분석이 끝났습니다. 아직 퀴즈를 풀지 않아 모든 개념이 콜드 스타트 상태입니다 —
        부채비율은 퀴즈를 풀면서 채워집니다.
      </p>

      <div className="stats">
        <div className="stat">
          <b>100%</b>
          <span>overall 부채비율</span>
        </div>
        <div className="stat">
          <b>{map.counts.nodes}</b>
          <span>nodes</span>
        </div>
        <div className="stat">
          <b>{map.counts.edges}</b>
          <span>edges</span>
        </div>
        <div className="stat">
          <b>{map.concepts.length}</b>
          <span>concepts</span>
        </div>
        <div className="stat">
          <b>{(job.elapsedMs / 1000).toFixed(1)}s</b>
          <span>분석 시간</span>
        </div>
      </div>

      <UnderstandingMap data={map} debt={debt} />

      <p className="note" style={{ marginTop: 24 }}>
        clone {job.timings?.clone}ms · extract {job.timings?.extract}ms · layout{" "}
        {job.timings?.layout}ms · 파일 {job.fileCount}개 해시 기록 ·{" "}
        <Link href="/">처음으로</Link>
      </p>
    </main>
  );
}
