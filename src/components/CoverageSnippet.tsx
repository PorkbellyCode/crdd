/**
 * 홈 히어로 — "이해도 커버리지".
 *
 * 테스트 커버리지가 거터에 초록·빨강 막대로 "어느 줄이 실행됐는지" 보여주듯,
 * CRDD는 "어느 코드를 내가 설명할 수 있는지"를 보여준다는 걸 한 장면으로 말한다.
 * 코드는 porklog(src/lib/toc.ts)의 실제 코드이고, 막대는 예시다.
 */

type Level = "ok" | "warn" | "crit" | "cold";

const LEVEL_NOTE: Record<Level, string> = {
  ok: "첫 시도에 설명함",
  warn: "힌트를 보고 설명함",
  crit: "설명하지 못함",
  cold: "아직 묻지 않음",
};

const START_LINE = 23;
const CODE = `export function extractToc(markdown: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  let inCodeFence = false;

  for (const line of markdown.split("\\n")) {
    if (/^\\s*(\`\`\`|~~~)/.test(line)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    const match = /^(#{2,3})\\s+(.*)$/.exec(line);
    if (!match) continue;

    const text = plainText(match[2]);
    if (!text) continue;

    items.push({
      depth: match[1].length as 2 | 3,
      text,
      id: slugger.slug(text),
    });
  }

  return items;
}`;

/** 줄 번호(START_LINE 기준) 구간 → 커버리지 단계. 블록 첫 줄에 주석을 붙인다 */
const BLOCKS: { from: number; to: number; level: Level }[] = [
  { from: 23, to: 26, level: "ok" },
  { from: 28, to: 33, level: "warn" },
  { from: 35, to: 36, level: "crit" },
  { from: 38, to: 45, level: "cold" },
  { from: 46, to: 48, level: "ok" },
];

const KEYWORDS = /\b(export|function|const|let|new|for|of|if|continue|return|as)\b/;

/** 이 조각만을 위한 아주 작은 강조기 — 문자열·정규식·키워드·함수 호출 정도만 */
function highlight(line: string) {
  const parts: { text: string; kind?: "keyword" | "string" | "fn" }[] = [];
  const pattern = /("[^"]*"|\/\^[^ ]*\/|\b[A-Za-z_]\w*(?=\()|\b\w+\b|\s+|.)/g;
  for (const token of line.match(pattern) ?? []) {
    if (/^"/.test(token) || /^\/\^/.test(token)) parts.push({ text: token, kind: "string" });
    else if (KEYWORDS.test(token) && /^\w+$/.test(token)) parts.push({ text: token, kind: "keyword" });
    else if (/^[A-Za-z_]\w*$/.test(token) && line.includes(`${token}(`)) parts.push({ text: token, kind: "fn" });
    else parts.push({ text: token });
  }
  return parts.map((part, i) =>
    part.kind ? (
      <span key={i} style={{ color: `var(--syn-${part.kind})` }}>
        {part.text}
      </span>
    ) : (
      part.text
    ),
  );
}

export default function CoverageSnippet() {
  const lines = CODE.split("\n");
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-editor shadow-[0_1px_0_var(--border)]">
      <figcaption className="flex items-center justify-between border-b border-border bg-chrome px-3 py-1.5 text-xs">
        <span className="text-foreground">src/lib/toc.ts</span>
        <span className="text-dim">porklog</span>
      </figcaption>

      <div className="overflow-x-auto py-2 text-[12.5px] leading-[1.7]">
        <pre className="min-w-max">
          {lines.map((line, i) => {
            const number = START_LINE + i;
            const block = BLOCKS.find((b) => number >= b.from && number <= b.to);
            const first = block?.from === number;
            return (
              <div key={number} className="flex">
                <span className="w-10 shrink-0 bg-gutter pr-3 text-right text-dim select-none">{number}</span>
                <span
                  className="w-[3px] shrink-0"
                  style={{ background: block ? `var(--debt-${block.level})` : "transparent" }}
                  aria-hidden
                />
                <code className="pr-6 pl-3">
                  {highlight(line) }
                  {first && block ? (
                    <span className="pl-6 text-dim italic select-none">{`// ${LEVEL_NOTE[block.level]}`}</span>
                  ) : null}
                </code>
              </div>
            );
          })}
        </pre>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border bg-chrome px-3 py-1.5 text-[11px] text-muted-foreground">
        {(["ok", "warn", "crit", "cold"] as const).map((level) => (
          <span key={level} className="flex items-center gap-1.5">
            <span className="h-3 w-[3px]" style={{ background: `var(--debt-${level})` }} aria-hidden />
            {LEVEL_NOTE[level]}
          </span>
        ))}
      </div>
    </figure>
  );
}
