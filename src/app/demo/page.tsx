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
      <h1 className="flex flex-wrap items-baseline gap-x-3 text-[clamp(22px,3vw,30px)] font-bold tracking-tight">
        {data.repo}
        <span className="text-sm font-normal text-dim">@{data.commit}</span>
        <span className="rounded-md border border-border px-2 py-0.5 text-xs font-normal text-muted-foreground">
          읽기 전용 데모
        </span>
      </h1>
      <p className="mt-2.5 max-w-[64ch] text-sm text-muted-foreground">
        porklog 레포를 실제로 분석한 구조 지도입니다. 개념 이름과 연결은 진짜 분석 결과이고,
        부채비율은 화면을 보여주기 위한 예시 값입니다.
      </p>

      <StatStrip>
        <Stat value={`${overall}%`} label="전체 부채비율 (예시)" />
        <Stat value={data.concepts.length} label="개념" />
        <Stat value={data.counts.nodes} label="심볼" />
        <Stat value={data.counts.edges} label="연결" />
      </StatStrip>

      <UnderstandingMap data={data} debt={EXAMPLE_DEBT} debtIsExample />

      <p className="mt-6 text-xs text-dim">
        <code>graphify extract --code-only</code>로 뽑은 그래프입니다. 설정·매니페스트 파일은 분석 전에
        제외했습니다.
      </p>
    </main>
  );
}
