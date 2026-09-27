"use client";

import { Circle, CircleCheck, CircleX, Maximize2, Minus, Pencil, Plus, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePanZoom } from "@/lib/client/use-pan-zoom";
import { LABEL_OFFSET, tidyBubbles } from "@/lib/crdd/tidy";
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
  cold: { label: "미측정", icon: Circle },
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
  /**
   * 개념 이름 고치기. 없으면 고치는 버튼을 숨긴다.
   * "login"이면 버튼 대신 로그인하면 고칠 수 있다고 알린다.
   */
  rename?: ((concept: MapData["concepts"][number], name: string) => Promise<string | null>) | "login";
}

const NAME_SOURCE_LABEL = {
  auto: "파일 구조로 붙인 이름",
  llm: "퀴즈를 낼 때 AI가 다듬은 이름",
  manual: "직접 고친 이름",
} as const;

export default function UnderstandingMap({ data, debt, debtIsExample, renderAction, rename }: UnderstandingMapProps) {
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

  // 저장된 좌표를 화면용으로 정돈 — 뭉친 개념을 벌리고, 결과를 감싸는 viewBox를 만든다
  const conceptLayout = useMemo(
    () =>
      tidyBubbles(
        data.concepts.map((c) => ({ x: c.x, y: c.y, r: c.r, label: c.name })),
        data.clinks,
      ),
    [data],
  );
  const fileLayout = useMemo(
    () => tidyBubbles(data.nodes.map((n) => ({ x: n.x, y: n.y, r: 3 })), [], { relax: false, pad: 16 }),
    [data],
  );
  const cpos = conceptLayout.points;
  const npos = fileLayout.points;
  const pz = usePanZoom(
    view === "concept" ? conceptLayout.box : fileLayout.box,
    view === "concept" ? cpos[selected] : undefined,
  );
  const select = (index: number) => {
    if (!pz.dragged.current) setSelected(index);
  };

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
        <div className="relative overflow-hidden rounded-lg border border-border bg-editor">
          <div className="absolute top-2 right-2 z-10 flex overflow-hidden rounded-md border border-border bg-chrome">
            <button
              type="button"
              onClick={() => pz.zoomBy(1 / 1.3)}
              className="grid size-7 place-items-center text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="확대"
              title="확대"
            >
              <Plus className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => pz.zoomBy(1.3)}
              className="grid size-7 place-items-center border-x border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="축소"
              title="축소"
            >
              <Minus className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={pz.fit}
              className="flex h-7 items-center gap-1.5 px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="전체 보기"
            >
              <Maximize2 className="size-3" aria-hidden />
              {Math.round(pz.zoom * 100)}%
            </button>
          </div>
          <svg
            ref={pz.svgRef}
            viewBox={pz.viewBox}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`${data.repo}의 코드 구조를 ${data.concepts.length}개 개념으로 묶어 보여주는 지도`}
            className="block h-[min(68vh,560px)] w-full cursor-grab touch-none select-none active:cursor-grabbing"
            {...pz.handlers}
          >
            {view === "concept" ? (
              <>
                {data.clinks.map((link, i) => {
                  const a = cpos[link.s]!;
                  const b = cpos[link.t]!;
                  const on = link.s === selected || link.t === selected;
                  return (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      style={{ stroke: on ? "var(--primary)" : "var(--edge)" }}
                      // 연결 수 1~12를 1~3px로 — 굵기 차이는 보이되 원보다 앞에 나서지 않게
                      strokeWidth={1 + Math.min(link.w, 12) / 6}
                      strokeOpacity={on ? 0.85 : 1}
                      strokeLinecap="round"
                    />
                  );
                })}
                {data.concepts.map((concept, i) => {
                  const at = cpos[i]!;
                  const value = debt[concept.id] ?? null;
                  const level = severity(value);
                  const color = debtColor(value);
                  const on = i === selected;
                  // 안쪽 숫자는 원 크기에 맞춰 — 가장 작은 원(r≈11)에서도 넘치지 않게
                  const inner = Math.max(9, Math.min(12, concept.r * 0.62));
                  return (
                    <g
                      key={concept.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${concept.name}, 심볼 ${concept.nodes}개, ${value === null ? "미측정" : `부채비율 ${value}%`}`}
                      aria-pressed={on}
                      className="map-node cursor-pointer outline-none"
                      onClick={() => select(i)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          select(i);
                        }
                      }}
                    >
                      <title>{`${concept.name} — ${value === null ? "미측정" : `부채비율 ${value}%`}`}</title>
                      {/* 선택 표시: 에디터의 선택 색으로 바깥 고리 */}
                      {on ? (
                        <circle
                          cx={at.x}
                          cy={at.y}
                          r={concept.r + 5}
                          style={{ fill: "none", stroke: "var(--primary)" }}
                          strokeWidth={1.5}
                        />
                      ) : null}
                      {/* 불투명 바탕 — 원 아래로 지나가는 연결선을 가린다 */}
                      <circle cx={at.x} cy={at.y} r={concept.r} style={{ fill: "var(--editor)" }} />
                      <circle
                        cx={at.x}
                        cy={at.y}
                        r={concept.r}
                        style={{ fill: color }}
                        fillOpacity={level === "cold" ? 0 : 0.1}
                      />
                      {/* 테두리 = 부채비율 게이지. 12시에서 시계방향으로 채우고, 남은 부분은 흐린 트랙.
                          미측정은 빈 게이지 — 아직 잰 적이 없다는 뜻이지 0%가 아니다 */}
                      <circle
                        cx={at.x}
                        cy={at.y}
                        r={concept.r}
                        style={{ fill: "none", stroke: "var(--track)" }}
                        strokeWidth={3}
                      />
                      {level === "cold" ? null : (
                        <circle
                          cx={at.x}
                          cy={at.y}
                          r={concept.r}
                          pathLength={100}
                          transform={`rotate(-90 ${at.x} ${at.y})`}
                          style={{ fill: "none", stroke: color }}
                          strokeWidth={3}
                          strokeDasharray={`${Math.max(value ?? 0, 0.5)} 100`}
                        />
                      )}
                      <text
                        x={at.x}
                        y={at.y}
                        dy="0.35em"
                        textAnchor="middle"
                        style={{ fill: level === "cold" ? "var(--dim)" : color }}
                        fontSize={inner}
                        fontWeight={level === "cold" ? 400 : 700}
                        className="tabular"
                        pointerEvents="none"
                      >
                        {value === null ? "—" : `${value}%`}
                      </text>
                      <text
                        x={at.x}
                        y={at.y + concept.r + LABEL_OFFSET}
                        textAnchor="middle"
                        // 연결선 위에서도 읽히게 편집기 배경색 테두리를 두른다
                        style={{
                          fill: on ? "var(--foreground)" : "var(--muted-foreground)",
                          stroke: "var(--editor)",
                          strokeWidth: 3,
                          paintOrder: "stroke",
                          strokeLinejoin: "round",
                        }}
                        fontSize={11}
                        fontWeight={on ? 700 : 500}
                        pointerEvents="none"
                      >
                        {concept.name}
                      </text>
                    </g>
                  );
                })}
              </>
            ) : (
              <>
                {data.links.map((link, i) => {
                  const a = npos[link.s]!;
                  const b = npos[link.t]!;
                  return (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      style={{ stroke: "var(--edge)" }}
                      strokeWidth={0.75}
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
                      cx={npos[i]!.x}
                      cy={npos[i]!.y}
                      r={3}
                      style={{ fill: debtColor(value) }}
                      // 선택한 개념의 심볼만 진하게 — 파일 보기에서도 개념의 범위가 보이게
                      fillOpacity={current && node.c === current.id ? 0.95 : 0.35}
                      className="cursor-pointer"
                      onClick={() => index !== undefined && select(index)}
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
              <ConceptName key={current.id} concept={current} rename={rename} />
              <p className="mb-3 text-xs text-dim">
                심볼 {current.nodes}개, 파일 {current.files.length}개
                {current.nameSource ? <>. {NAME_SOURCE_LABEL[current.nameSource]}</> : null}
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
        <span className="text-dim">테두리 호는 부채비율, 원 크기는 심볼 수, 선 굵기는 개념 사이 연결 수</span>
        <span className="ml-auto text-dim">스크롤로 확대, 드래그로 이동</span>
      </div>
    </div>
  );
}

/** 개념 이름 — 고칠 수 있으면 제자리에서 입력칸으로 바뀐다 */
function ConceptName({
  concept,
  rename,
}: {
  concept: MapData["concepts"][number];
  rename: UnderstandingMapProps["rename"];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(concept.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (editing && typeof rename === "function") {
    const save = async () => {
      const name = draft.trim();
      if (!name || name === concept.name) {
        setEditing(false);
        return;
      }
      setPending(true);
      const failure = await rename(concept, name);
      setPending(false);
      if (failure) setError(failure);
      else setEditing(false);
    };
    return (
      <form
        className="mb-1"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="sr-only" htmlFor="concept-name">
          개념 이름
        </label>
        <input
          id="concept-name"
          autoFocus
          value={draft}
          maxLength={40}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(false);
          }}
          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm font-bold focus-visible:border-ring"
        />
        <div className="mt-1.5 flex gap-1.5">
          <Button type="submit" size="xs" disabled={pending}>
            {pending ? "저장 중…" : "이름 저장"}
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => setEditing(false)}>
            취소
          </Button>
        </div>
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </form>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2">
      <h2 className="text-base font-bold tracking-tight break-all">{concept.name}</h2>
      {typeof rename === "function" ? (
        <button
          type="button"
          onClick={() => {
            setDraft(concept.name);
            setError(null);
            setEditing(true);
          }}
          className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-dim hover:bg-secondary hover:text-foreground"
          aria-label="이름 고치기"
          title="이름 고치기"
        >
          <Pencil className="size-3.5" />
        </button>
      ) : rename === "login" ? (
        <span className="mt-1 shrink-0 text-[11px] text-dim" title="개념 이름은 로그인하면 고칠 수 있습니다">
          로그인하면 이름 수정
        </span>
      ) : null}
    </div>
  );
}
