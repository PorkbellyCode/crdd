/**
 * 지도 정돈 — 저장된 좌표를 화면용으로 다듬는다 (순수 함수, 브라우저에서 돈다).
 *
 * 좌표 단위는 화면 px다. 확대 100%에서 1단위 = 1px이 되도록 그리므로, 여기서 정한
 * 원 반지름·이름 폭이 그대로 화면 크기가 된다 (전체를 칸에 맞춰 늘리지 않는다).
 *
 *   1. 이상치 압축 — 연결 없는 개념이 멀리 떨어져 있을 때만 거리를 log로 눌러 끌어온다.
 *      멀쩡한 배치는 그대로 둔다: 중심과 변두리의 거리 자체가 구조 정보다.
 *   2. 간격 맞춤 — 원 크기에 맞는 기본 간격으로 확대·축소
 *   3. 겹침 해소 — 원 + 원 아래 이름이 차지하는 사각형끼리 겹치지 않게 민다.
 *      중심 인력은 쓰지 않는다 (모든 개념을 한 덩어리로 뭉쳐 변두리가 사라진다)
 *   4. 경계 — 결과를 감싸는 상자를 돌려준다
 *
 * 입력 좌표에서 출발하는 결정론적 계산이라 같은 분석은 항상 같은 그림이 된다.
 */

export interface Bubble {
  x: number;
  y: number;
  r: number;
  /** 원 아래에 붙는 이름 — 폭과 높이를 겹침 계산에 넣는다 */
  label?: string;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TidyOptions {
  /** 이웃 사이 최소 여백 (px) */
  gap?: number;
  /** 이름 글꼴의 글자 폭 (px) — 한글은 두 칸으로 센다 */
  charWidth?: number;
  /** 원 아래 이름 줄의 높이 (px) */
  labelHeight?: number;
  /** 겹침 해소를 할지 (심볼 수백 개짜리 파일 보기는 압축만 한다) */
  relax?: boolean;
  iterations?: number;
  /** 경계 여백 */
  pad?: number;
  /** 파일 보기처럼 이름 없는 점의 배치 폭(px) */
  spread?: number;
}

/** 원 중심에서 이름 기준선까지의 거리 (원 아래 여백 + 글자 높이) */
export const LABEL_OFFSET = 15;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function textWidth(label: string, charWidth: number): number {
  let cells = 0;
  for (const char of label) cells += /[ᄀ-ᇿ㄰-㆏가-힯]/.test(char) ? 2 : 1;
  return cells * charWidth;
}

export function tidyBubbles(
  items: Bubble[],
  links: { s: number; t: number }[] = [],
  options: TidyOptions = {},
): { points: { x: number; y: number }[]; box: Box } {
  const {
    gap = 18,
    charWidth = 6.7,
    labelHeight = 20,
    relax = true,
    iterations = 300,
    pad = 24,
    spread = 720,
  } = options;
  const n = items.length;
  if (n === 0) return { points: [], box: { x: 0, y: 0, w: 1, h: 1 } };

  // 각 개념이 차지하는 사각형: 가로는 원과 이름 중 넓은 쪽, 세로는 원 위 ~ 이름 아래
  const halfW = items.map((item) =>
    Math.max(item.r, item.label ? textWidth(item.label, charWidth) / 2 + 2 : 0),
  );
  const top = items.map((item) => item.r);
  const bottom = items.map((item) => (item.label ? item.r + labelHeight : item.r));

  // 1. 중앙값 중심. 이상치가 있을 때만 log 압축
  const cx = median(items.map((p) => p.x));
  const cy = median(items.map((p) => p.y));
  const dist = items.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const scale = median(dist.filter((d) => d > 1e-6)) || 1;
  const outlying = Math.max(...dist) / scale > 2.6;
  // 중앙값 거리 안쪽은 그대로, 바깥만 log로 누른다 (안쪽까지 누르면 점들이 고리에 몰린다)
  const squash = (d: number) => (d <= scale ? d : scale * (1 + Math.log(d / scale)));
  let xs = items.map((p, i) => {
    const d = dist[i]!;
    if (!outlying || d < 1e-9) return p.x - cx;
    return ((p.x - cx) / d) * squash(d);
  });
  let ys = items.map((p, i) => {
    const d = dist[i]!;
    if (!outlying || d < 1e-9) return p.y - cy;
    return ((p.y - cy) / d) * squash(d);
  });

  // 2. 간격 맞춤 — 개념 보기는 원 크기 기준, 파일 보기는 정해진 폭 기준
  const radial = xs.map((x, i) => Math.hypot(x, ys[i]!));
  const currentMedian = median(radial.filter((d) => d > 1e-6)) || 1;
  const meanFoot = halfW.reduce((a, b) => a + b, 0) / n;
  const target = relax
    ? Math.max(meanFoot * 2 + gap, (meanFoot * 2 + gap) * Math.sqrt(n) * 0.42)
    : spread / 4;
  const grow = target / currentMedian;
  xs = xs.map((x) => x * grow);
  ys = ys.map((y) => y * grow);

  // 같은 좌표에 겹친 점은 결정론적으로 살짝 벌린다 (밀어낼 방향이 없으므로)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(xs[i]! - xs[j]!) < 1e-6 && Math.abs(ys[i]! - ys[j]!) < 1e-6) {
        const angle = (j * 2.399963) % (2 * Math.PI); // 황금각
        xs[j]! += Math.cos(angle);
        ys[j]! += Math.sin(angle);
      }
    }
  }

  // 파일 보기(겹침 해소 없음): 상위 5%보다 먼 점은 가장자리로 끌어온다 —
  // 떨어진 점 하나 때문에 수백 개가 작게 줄어드는 것을 막는다
  if (!relax && n > 20) {
    const r2 = xs.map((x, i) => Math.hypot(x, ys[i]!));
    const limit = [...r2].sort((a, b) => a - b)[Math.floor(n * 0.95)]! * 1.1;
    for (let i = 0; i < n; i++) {
      if (r2[i]! > limit) {
        xs[i] = (xs[i]! / r2[i]!) * limit;
        ys[i] = (ys[i]! / r2[i]!) * limit;
      }
    }
  }

  // 3. 사각형 겹침 해소 + 연결 스프링(약하게)
  if (relax) {
    for (let step = 0; step < iterations; step++) {
      const cool = 1 - step / iterations;
      let moved = false;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = xs[j]! - xs[i]!;
          const dy = ys[j]! - ys[i]!;
          const overlapX = halfW[i]! + halfW[j]! + gap - Math.abs(dx);
          // j가 아래에 있으면 i의 아랫변과 j의 윗변이 맞닿는다
          const overlapY =
            (dy >= 0 ? bottom[i]! + top[j]! : top[i]! + bottom[j]!) + gap - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          moved = true;
          // 덜 겹친 축으로 민다 — 사각형은 그쪽이 가장 적게 움직인다
          if (overlapX < overlapY) {
            const push = (overlapX / 2) * Math.sign(dx || 1);
            xs[i]! -= push;
            xs[j]! += push;
          } else {
            const push = (overlapY / 2) * Math.sign(dy || 1);
            ys[i]! -= push;
            ys[j]! += push;
          }
        }
      }
      for (const { s, t } of links) {
        const vx = xs[t]! - xs[s]!;
        const vy = ys[t]! - ys[s]!;
        const d = Math.hypot(vx, vy) || 1e-6;
        const rest = (halfW[s]! + halfW[t]! + gap) * 2.2;
        if (d > rest) {
          const pull = (d - rest) * 0.01 * cool;
          xs[s]! += (vx / d) * pull;
          ys[s]! += (vy / d) * pull;
          xs[t]! -= (vx / d) * pull;
          ys[t]! -= (vy / d) * pull;
        }
      }
      if (!moved && step > iterations / 2) break;
    }
  }

  // 3-1. 연결이 하나도 없는 개념은 본 덩어리 아래에 한 줄로 모은다 —
  // 힘 기반 배치에서는 이들이 멀리 밀려나 지도 전체를 작게 만든다 (workwrap 실측)
  if (relax && links.length > 0) {
    const degree = new Array<number>(n).fill(0);
    for (const { s, t } of links) {
      degree[s]!++;
      degree[t]!++;
    }
    const lonely = items.map((_, i) => i).filter((i) => degree[i] === 0);
    const linked = items.map((_, i) => i).filter((i) => degree[i]! > 0);
    if (lonely.length > 0 && linked.length > 0) {
      let left = Infinity;
      let right = -Infinity;
      let floor = -Infinity;
      for (const i of linked) {
        left = Math.min(left, xs[i]! - halfW[i]!);
        right = Math.max(right, xs[i]! + halfW[i]!);
        floor = Math.max(floor, ys[i]! + bottom[i]!);
      }
      const rowWidth = Math.max(right - left, 320);
      let cursor = left;
      let rowTop = floor + gap * 2;
      let rowHeight = 0;
      for (const i of lonely) {
        const width = halfW[i]! * 2;
        if (cursor > left && cursor + width > left + rowWidth) {
          cursor = left;
          rowTop += rowHeight + gap;
          rowHeight = 0;
        }
        xs[i] = cursor + halfW[i]!;
        ys[i] = rowTop + top[i]!;
        cursor += width + gap;
        rowHeight = Math.max(rowHeight, top[i]! + bottom[i]!);
      }
    }
  }

  // 4. 결과를 감싸는 상자
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, xs[i]! - halfW[i]!);
    maxX = Math.max(maxX, xs[i]! + halfW[i]!);
    minY = Math.min(minY, ys[i]! - top[i]!);
    maxY = Math.max(maxY, ys[i]! + bottom[i]!);
  }
  const box = {
    x: minX - pad,
    y: minY - pad,
    w: Math.max(maxX - minX + pad * 2, 1),
    h: Math.max(maxY - minY + pad * 2, 1),
  };
  return {
    points: xs.map((x, i) => ({ x: Math.round(x * 10) / 10, y: Math.round(ys[i]! * 10) / 10 })),
    box,
  };
}
