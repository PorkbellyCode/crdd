import Link from "next/link";
import { Stat, StatStrip } from "@/components/Stat";
import UnderstandingMap from "@/components/UnderstandingMap";
import { EXAMPLE_DEBT } from "@/data/porklog-demo";
import mapData from "@/data/porklog-map.json";
import { overallDebtRatio } from "@/lib/crdd/score";
import type { MapData } from "@/lib/crdd/types";

const data = mapData as MapData;

export default function DemoPage() {
  const overall = overallDebtRatio(
    data.concepts.map((concept) => {
      const debt = EXAMPLE_DEBT[concept.id];
      return {
        files: concept.files,
        score: debt === null || debt === undefined ? null : 100 - debt,
      };
    }),
  );

  return (
    <main className="mx-auto max-w-6xl px-5 pt-10 pb-16">
      <p className="eyebrow mb-2.5">Demo · read only</p>
      <h1 className="text-[clamp(24px,3.4vw,34px)] font-bold tracking-tight">{data.repo}</h1>
      <p className="mt-2.5 max-w-[64ch] text-sm text-muted-foreground">
        Graphify가 뽑은 실제 코드 그래프 위에 부채비율을 얹은 화면입니다. 구조는 진짜
        데이터이고, 부채비율은 예시 값입니다 — 아직 퀴즈 루프가 붙기 전입니다.
      </p>

      <StatStrip>
        <Stat value={`${overall}%`} label="overall 부채비율 (예시)" />
        <Stat value={data.counts.nodes} label="nodes" />
        <Stat value={data.counts.edges} label="edges" />
        <Stat value={data.concepts.length} label="concepts" />
        <Stat value={data.commit} label="built at commit" valueClassName="text-sm" />
      </StatStrip>

      <UnderstandingMap data={data} debt={EXAMPLE_DEBT} debtIsExample />

      <p className="mt-6 font-mono text-[11px] text-dim">
        graphify extract --code-only · 설정·매니페스트 제외 · 좌표는 서버에서 미리 계산 ·{" "}
        <Link href="/" className="underline underline-offset-2">
          처음으로
        </Link>
      </p>
    </main>
  );
}
