"use client";

import { useMemo, useState } from "react";
import type { MapData } from "@/lib/crdd/types";

const COLD = "#57627a";

function debtColor(debt: number | null): string {
  if (debt === null) return COLD;
  if (debt < 30) return "#45b08c";
  if (debt < 55) return "#d8a33f";
  return "#e05a4e";
}

export interface UnderstandingMapProps {
  data: MapData;
  /** communityId → 부채비율. 값이 없으면 콜드 스타트로 그린다 */
  debt: Record<number, number | null>;
  /** 부채비율이 실측이 아닌 예시 값일 때 화면에 밝힌다 */
  debtIsExample?: boolean;
}

export default function UnderstandingMap({ data, debt, debtIsExample }: UnderstandingMapProps) {
  const [view, setView] = useState<"concept" | "file">("concept");
  const [selected, setSelected] = useState<number>(() =>
    data.concepts.reduce(
      (best, concept, i, all) =>
        (debt[concept.id] ?? 0) > (debt[all[best]!.id] ?? 0) ? i : best,
      0,
    ),
  );

  const conceptIndexById = useMemo(() => {
    const map = new Map<number, number>();
    data.concepts.forEach((concept, i) => map.set(concept.id, i));
    return map;
  }, [data]);

  const current = data.concepts[selected];
  const currentDebt = current ? (debt[current.id] ?? null) : null;
  const debtLabel = debtIsExample ? "부채비율 (예시)" : "부채비율";

  return (
    <div>
      <div className="toolbar">
        <button
          type="button"
          aria-pressed={view === "concept"}
          onClick={() => setView("concept")}
        >
          개념 보기 · {data.concepts.length}
        </button>
        <button type="button" aria-pressed={view === "file"} onClick={() => setView("file")}>
          파일 보기 · {data.counts.nodes}
        </button>
        <span className="note" style={{ marginLeft: "auto" }}>
          노드를 클릭하면 오른쪽에 상세가 나옵니다
        </span>
      </div>

      <div className="stage">
        <div className="canvas">
          <svg
            viewBox="0 0 1000 660"
            role="img"
            aria-label={`${data.repo}의 코드 구조를 ${data.concepts.length}개 개념으로 묶어 보여주는 지도`}
          >
            {view === "concept" ? (
              <>
                {data.clinks.map((link, i) => {
                  const a = data.concepts[link.s]!;
                  const b = data.concepts[link.t]!;
                  const on = link.s === selected || link.t === selected;
                  return (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={on ? "#f2743d" : "#2b3342"}
                      strokeWidth={Math.min(1 + link.w * 0.35, 5)}
                      strokeOpacity={on ? 0.9 : 0.7}
                    />
                  );
                })}
                {data.concepts.map((concept, i) => {
                  const value = debt[concept.id] ?? null;
                  const color = debtColor(value);
                  const on = i === selected;
                  return (
                    <g
                      key={concept.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${concept.name} — 심볼 ${concept.nodes}개`}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelected(i)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(i);
                        }
                      }}
                    >
                      <circle
                        cx={concept.x}
                        cy={concept.y}
                        r={concept.r}
                        fill={color}
                        fillOpacity={on ? 0.3 : 0.14}
                        stroke={color}
                        strokeWidth={on ? 2.4 : 1.4}
                      />
                      <text
                        x={concept.x}
                        y={concept.y + 4}
                        textAnchor="middle"
                        fill="#e6e9f0"
                        fontSize={12}
                        fontWeight={600}
                        pointerEvents="none"
                      >
                        {concept.name}
                      </text>
                      <text
                        x={concept.x}
                        y={concept.y + concept.r + 14}
                        textAnchor="middle"
                        fill={color}
                        fontSize={10}
                        fontFamily="var(--mono)"
                        pointerEvents="none"
                      >
                        {value === null ? "미측정" : `${value}%`}
                      </text>
                    </g>
                  );
                })}
              </>
            ) : (
              <>
                {data.links.map((link, i) => {
                  const a = data.nodes[link.s]!;
                  const b = data.nodes[link.t]!;
                  return (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="#242b38"
                      strokeWidth={0.6}
                    />
                  );
                })}
                {data.nodes.map((node, i) => {
                  const index = conceptIndexById.get(node.c);
                  const value =
                    index === undefined ? null : (debt[data.concepts[index]!.id] ?? null);
                  return (
                    <circle
                      key={i}
                      cx={node.x}
                      cy={node.y}
                      r={2.6}
                      fill={debtColor(value)}
                      fillOpacity={0.85}
                      style={{ cursor: "pointer" }}
                      onClick={() => index !== undefined && setSelected(index)}
                    >
                      <title>{`${node.l} — ${node.f ?? ""}`}</title>
                    </circle>
                  );
                })}
              </>
            )}
          </svg>
        </div>

        <aside className="panel">
          {current ? (
            <>
              <h2>{current.name}</h2>
              <p className="sub">
                community {current.id} · 심볼 {current.nodes}개 · 파일 {current.files.length}개
              </p>
              <div className="debt">
                <b style={{ color: debtColor(currentDebt) }}>
                  {currentDebt === null ? "—" : `${currentDebt}%`}
                </b>
                <span>{currentDebt === null ? "콜드 스타트 · 퀴즈 미실시" : debtLabel}</span>
              </div>
              <div className="bar">
                <i
                  style={{
                    width: `${currentDebt ?? 100}%`,
                    background: debtColor(currentDebt),
                  }}
                />
              </div>

              <div className="plabel">대표 심볼 (fan-in 순)</div>
              <ul className="slist">
                {current.top.map((symbol) => (
                  <li key={`${symbol.file}-${symbol.label}`}>
                    <b>{symbol.label}</b>
                    <span>fan-in {symbol.fan}</span>
                  </li>
                ))}
              </ul>

              <div className="plabel">파일 {current.files.length}개</div>
              <ul className="flist">
                {current.files.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="note">개념을 선택하세요</p>
          )}
        </aside>
      </div>

      <div className="legend">
        <span>
          <i style={{ background: "#45b08c" }} />
          부채 낮음
        </span>
        <span>
          <i style={{ background: "#d8a33f" }} />
          주의
        </span>
        <span>
          <i style={{ background: "#e05a4e" }} />
          높음
        </span>
        <span>
          <i style={{ background: COLD }} />
          콜드 스타트
        </span>
        <span>원 크기 = 포함 심볼 수 · 선 굵기 = 개념 간 연결 수</span>
      </div>
    </div>
  );
}
