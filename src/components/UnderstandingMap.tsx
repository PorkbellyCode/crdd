"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MapData } from "@/lib/crdd/types";

const DEBT_COLORS = {
  ok: "#45b08c",
  warn: "#d8a33f",
  crit: "#e05a4e",
  cold: "#57627a",
} as const;

function debtColor(debt: number | null): string {
  if (debt === null) return DEBT_COLORS.cold;
  if (debt < 30) return DEBT_COLORS.ok;
  if (debt < 55) return DEBT_COLORS.warn;
  return DEBT_COLORS.crit;
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={view === "concept" ? "default" : "secondary"}
          aria-pressed={view === "concept"}
          onClick={() => setView("concept")}
        >
          개념 보기 · {data.concepts.length}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === "file" ? "default" : "secondary"}
          aria-pressed={view === "file"}
          onClick={() => setView("file")}
        >
          파일 보기 · {data.counts.nodes}
        </Button>
        <span className="ml-auto font-mono text-[11px] text-dim">
          노드를 클릭하면 오른쪽에 상세가 나옵니다
        </span>
      </div>

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="overflow-hidden p-0">
          <svg
            viewBox="0 0 1000 660"
            role="img"
            aria-label={`${data.repo}의 코드 구조를 ${data.concepts.length}개 개념으로 묶어 보여주는 지도`}
            className="block h-auto w-full font-sans"
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
                        className="font-mono"
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
        </Card>

        <Card className="min-w-0 gap-0 p-3.5">
          {current ? (
            <>
              <h2 className="text-base font-semibold tracking-tight">{current.name}</h2>
              <p className="mb-3 font-mono text-[11px] text-dim">
                community {current.id} · 심볼 {current.nodes}개 · 파일 {current.files.length}개
              </p>

              <div className="flex items-baseline gap-2">
                <b
                  className="font-mono text-3xl font-semibold tracking-tight tabular"
                  style={{ color: debtColor(currentDebt) }}
                >
                  {currentDebt === null ? "—" : `${currentDebt}%`}
                </b>
                <span className="eyebrow">
                  {currentDebt === null
                    ? "콜드 스타트"
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

              <div className="eyebrow mb-1.5 text-[9.5px]">대표 심볼 (fan-in 순)</div>
              <ul className="flex flex-col gap-1">
                {current.top.map((symbol) => (
                  <li
                    key={`${symbol.file}-${symbol.label}`}
                    className="flex justify-between gap-2 font-mono text-[11px] text-muted-foreground"
                  >
                    <b className="font-medium text-foreground">{symbol.label}</b>
                    <span className="shrink-0 text-dim">fan-in {symbol.fan}</span>
                  </li>
                ))}
              </ul>

              <div className="eyebrow mt-3.5 mb-1.5 text-[9.5px]">
                파일 {current.files.length}개
              </div>
              <ul className="flex flex-col gap-1">
                {current.files.map((file) => (
                  <li key={file} className="font-mono text-[11px] break-all text-muted-foreground">
                    {file}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="font-mono text-[11px] text-dim">개념을 선택하세요</p>
          )}
        </Card>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-3 border-t border-border pt-3 font-mono text-[11px] text-dim">
        {(
          [
            ["부채 낮음", DEBT_COLORS.ok],
            ["주의", DEBT_COLORS.warn],
            ["높음", DEBT_COLORS.crit],
            ["콜드 스타트", DEBT_COLORS.cold],
          ] as const
        ).map(([label, color]) => (
          <Badge key={label} variant="outline" className="gap-1.5 font-mono text-[10px]">
            <span className="size-2 rounded-full" style={{ background: color }} />
            {label}
          </Badge>
        ))}
        <span>원 크기 = 포함 심볼 수 · 선 굵기 = 개념 간 연결 수</span>
      </div>
    </div>
  );
}
