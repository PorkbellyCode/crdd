"use client";

import { CircleCheck, CircleDashed, CircleX, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { MapData } from "@/lib/crdd/types";

/**
 * 부채비율 단계를 에디터의 진단 심각도로 읽는다 — ok / warning / error, 그리고 미측정.
 * 색은 테마 토큰(--debt-*)이라 라이트·다크에서 각각 맞는 값이 쓰인다.
 */
type Severity = "ok" | "warn" | "crit" | "cold";

const SEVERITY = {
  ok: { label: "부채 30% 미만", icon: CircleCheck },
  warn: { label: "30–54%", icon: TriangleAlert },
  crit: { label: "55% 이상", icon: CircleX },
  cold: { label: "미측정", icon: CircleDashed },
} as const;

function severity(debt: number | null): Severity {
  if (debt === null) return "cold";
  if (debt < 30) return "ok";
  if (debt < 55) return "warn";
  return "crit";
}

function debtColor(debt: number | null): string {
  return `var(--debt-${severity(debt)})`;
}

export interface UnderstandingMapProps {
  data: MapData;
  /** communityId → 부채비율. 값이 없으면 콜드 스타트로 그린다 */
  debt: Record<number, number | null>;
  /** 부채비율이 실측이 아닌 예시 값일 때 화면에 밝힌다 */
  debtIsExample?: boolean;
  /** 선택한 개념의 상세 패널에 붙일 동작 (퀴즈 시작 등). 데모에서는 비운다 */
  renderAction?: (concept: MapData["concepts"][number]) => React.ReactNode;
}

export default function UnderstandingMap({ data, debt, debtIsExample, renderAction }: UnderstandingMapProps) {
  const [view, setView] = useState<"concept" | "file">("concept");
  const [selected, setSelected] = useState(() =>
    data.concepts.reduce(
      (best, concept, i, all) => ((debt[concept.id] ?? 0) > (debt[all[best]!.id] ?? 0) ? i : best),
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

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="보기 전환">
        <Button
          type="button"
          size="sm"
          variant={view === "concept" ? "default" : "secondary"}
          aria-pressed={view === "concept"}
          onClick={() => setView("concept")}
        >
          개념 {data.concepts.length}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === "file" ? "default" : "secondary"}
          aria-pressed={view === "file"}
          onClick={() => setView("file")}
        >
          심볼 {data.counts.nodes}
        </Button>
        <span className="ml-auto text-xs text-dim">개념을 고르면 오른쪽에 파일과 퀴즈가 나옵니다</span>
      </div>

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden rounded-lg border border-border bg-editor">
          <svg
            viewBox="0 0 1000 660"
            role="img"
            aria-label={`${data.repo}의 코드 구조를 ${data.concepts.length}개 개념으로 묶어 보여주는 지도`}
            className="block h-auto w-full"
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
                      style={{ stroke: on ? "var(--primary)" : "var(--border)" }}
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
                      aria-label={`${concept.name}, 심볼 ${concept.nodes}개, ${value === null ? "미측정" : `부채비율 ${value}%`}`}
                      aria-pressed={on}
                      className="cursor-pointer outline-none"
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
                        style={{ fill: color, stroke: on ? "var(--primary)" : color }}
                        fillOpacity={on ? 0.28 : 0.13}
                        strokeWidth={on ? 2.4 : 1.4}
                      />
                      <text
                        x={concept.x}
                        y={concept.y + 4}
                        textAnchor="middle"
                        // 글자 뒤에 편집기 배경색 테두리를 둘러 선·원 위에서도 읽히게 한다
                        style={{
                          fill: "var(--foreground)",
                          stroke: "var(--editor)",
                          strokeWidth: 4,
                          paintOrder: "stroke",
                          strokeLinejoin: "round",
                        }}
                        fontSize={12}
                        fontWeight={700}
                        pointerEvents="none"
                      >
                        {concept.name}
                      </text>
                      <text
                        x={concept.x}
                        y={concept.y + concept.r + 14}
                        textAnchor="middle"
                        style={{
                          fill: color,
                          stroke: "var(--editor)",
                          strokeWidth: 3,
                          paintOrder: "stroke",
                        }}
                        fontSize={11}
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
                      style={{ stroke: "var(--border)" }}
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
                      style={{ fill: debtColor(value) }}
                      fillOpacity={0.85}
                      className="cursor-pointer"
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

        <aside className="min-w-0 rounded-lg border border-border bg-editor p-4" aria-label="선택한 개념">
          {current ? (
            <>
              <h2 className="text-base font-bold tracking-tight">{current.name}</h2>
              <p className="mb-3 text-xs text-dim">
                심볼 {current.nodes}개, 파일 {current.files.length}개
              </p>

              <div className="flex items-baseline gap-2">
                <b
                  className="text-3xl font-bold tracking-tight tabular"
                  style={{ color: debtColor(currentDebt) }}
                >
                  {currentDebt === null ? "—" : `${currentDebt}%`}
                </b>
                <span className="text-xs text-muted-foreground">
                  {currentDebt === null
                    ? "아직 퀴즈를 풀지 않음"
                    : debtIsExample
                      ? "부채비율 (예시)"
                      : "부채비율"}
                </span>
              </div>
              <div className="mt-1.5 mb-3.5 h-1 overflow-hidden rounded-full bg-secondary">
                <i
                  className="block h-full rounded-full"
                  style={{
                    width: `${currentDebt ?? 100}%`,
                    background: debtColor(currentDebt),
                  }}
                />
              </div>

              {renderAction ? <div className="mb-3.5">{renderAction(current)}</div> : null}

              <h3 className="mb-1.5 text-xs text-muted-foreground">많이 참조되는 심볼</h3>
              <ul className="flex flex-col gap-1">
                {current.top.map((symbol) => (
                  <li
                    key={`${symbol.file}-${symbol.label}`}
                    className="flex justify-between gap-2 text-xs text-muted-foreground"
                  >
                    <span className="truncate text-foreground">{symbol.label}</span>
                    <span className="shrink-0 text-dim tabular" title="이 심볼을 참조하는 곳의 수">
                      {symbol.fan}회
                    </span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-4 mb-1.5 text-xs text-muted-foreground">파일</h3>
              <ul className="flex flex-col gap-0.5">
                {current.files.map((file) => (
                  <li key={file} className="text-xs break-all text-muted-foreground">
                    {file}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs text-dim">지도에서 개념을 고르세요</p>
          )}
        </aside>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {(Object.keys(SEVERITY) as Severity[]).map((key) => {
          const Icon = SEVERITY[key].icon;
          return (
            <span key={key} className="flex items-center gap-1.5">
              <Icon className="size-3.5" style={{ color: `var(--debt-${key})` }} aria-hidden />
              {SEVERITY[key].label}
            </span>
          );
        })}
        <span className="text-dim">원 크기는 심볼 수, 선 굵기는 개념 사이 연결 수</span>
      </div>
    </div>
  );
}
