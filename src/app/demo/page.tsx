import Link from "next/link";
import UnderstandingMap from "@/components/UnderstandingMap";
import { EXAMPLE_DEBT } from "@/data/porklog-demo";
import mapData from "@/data/porklog-map.json";
import { overallDebtRatio } from "@/lib/crdd/score";
import type { MapData } from "@/lib/crdd/types";

const data = mapData as MapData;

export default function DemoPage() {
  const overall = overallDebtRatio(
    data.concepts.map((concept) => ({
      files: concept.files,
      score: EXAMPLE_DEBT[concept.id] === null || EXAMPLE_DEBT[concept.id] === undefined
        ? null
        : 100 - (EXAMPLE_DEBT[concept.id] as number),
    })),
  );

  return (
    <main className="wrap">
      <p className="kicker">Demo · read only</p>
      <h1>{data.repo}</h1>
      <p className="lede">
        Graphify가 뽑은 실제 코드 그래프 위에 부채비율을 얹은 화면입니다. 구조는 진짜
        데이터이고, 부채비율은 예시 값입니다 — 아직 퀴즈 루프가 붙기 전입니다.
      </p>

      <div className="stats">
        <div className="stat">
          <b>{overall}%</b>
          <span>overall 부채비율 (예시)</span>
        </div>
        <div className="stat">
          <b>{data.counts.nodes}</b>
          <span>nodes</span>
        </div>
        <div className="stat">
          <b>{data.counts.edges}</b>
          <span>edges</span>
        </div>
        <div className="stat">
          <b>{data.concepts.length}</b>
          <span>concepts</span>
        </div>
        <div className="stat">
          <b style={{ fontSize: 14 }}>{data.commit}</b>
          <span>built at commit</span>
        </div>
      </div>

      <UnderstandingMap data={data} debt={EXAMPLE_DEBT} debtIsExample />

      <p className="note" style={{ marginTop: 24 }}>
        graphify extract --code-only · 설정·매니페스트 제외 · 좌표는 서버에서 미리 계산 ·{" "}
        <Link href="/">처음으로</Link>
      </p>
    </main>
  );
}
