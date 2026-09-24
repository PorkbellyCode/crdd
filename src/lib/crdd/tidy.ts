/**
 * 지도 정돈 — 저장된 좌표를 화면용으로 다듬는다 (순수 함수, 브라우저에서 돈다).
 *
 * 서버 레이아웃(force-directed)은 연결이 없는 개념을 멀리 밀어낸다. 그 상태로
 * 경계 상자에 맞춰 축소하면, 떨어진 몇 개 때문에 나머지가 가운데 한 점으로 뭉개진다
 * (workwrap 실측: 12개 중 9개가 지름 60px 안에 겹침).
 *
 *   1. 로그 압축 — 중심에서의 거리를 log로 눌러 멀리 떨어진 개념을 끌어온다
 *   2. 간격 맞춤 — 원 크기에 맞는 기본 간격으로 확대
 *   3. 충돌 해소 + 중심 인력 — 원(과 이름 폭)이 겹치지 않는 선에서 한 덩어리로 모은다
 *   4. 경계 — 결과를 감싸는 viewBox를 돌려준다 (축소해서 욱여넣지 않는다)
 *
 * 입력 좌표에서 출발하는 결정론적 계산이라 같은 분석은 항상 같은 그림이 된다.
 */

export interface Bubble {
  x: number;
  y: number;
  r: number;
  /** 이름 — 원보다 이름이 넓으면 이름 폭을 충돌 반경으로 쓴다 */
  label?: string;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TidyOptions {
  /** 원 사이 최소 여백 (px) */
  gap?: number;
  /** 12px 고정폭 글꼴의 글자 폭 (px) — 한글은 두 칸으로 센다 */
  charWidth?: number;
  /** 충돌 해소를 할지 (심볼 수백 개짜리 파일 보기는 압축만 한다) */
  relax?: boolean;
  iterations?: number;
  /** viewBox 여백 */
  pad?: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function textWidth(label: string, charWidth: number): number {
  let cells = 0;
  for (const char of label) cells += /[ᄀ-ᇿ㄰-㆏가-힯]/.test(char) ? 2 : 1;
  return cells * charWidth;
}

export function tidyBubbles(
  items: Bubble[],
  links: { s: number; t: number }[] = [],
  options: TidyOptions = {},
): { points: { x: number; y: number }[]; box: Box } {
  const { gap = 16, charWidth = 7.2, relax = true, iterations = 320, pad = 28 } = options;
  const n = items.length;
  if (n === 0) return { points: [], box: { x: 0, y: 0, w: 1000, h: 660 } };

  // 충돌 반경: 원 반지름과 이름 폭의 절반 중 큰 쪽
  const radius = items.map((item) =>
    Math.max(item.r, item.label ? textWidth(item.label, charWidth) / 2 + 4 : 0),
  );

  // 1. 중앙값 중심으로 로그 압축
  const cx = median(items.map((p) => p.x));
  const cy = median(items.map((p) => p.y));
  const dist = items.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const scale = median(dist.filter((d) => d > 1e-6)) || 1;
  let xs = items.map((p, i) => {
    const d = dist[i]!;
    return d < 1e-9 ? 0 : ((p.x - cx) / d) * scale * Math.log1p(d / scale);
  });
  let ys = items.map((p, i) => {
    const d = dist[i]!;
    return d < 1e-9 ? 0 : ((p.y - cy) / d) * scale * Math.log1p(d / scale);
  });

  // 2. 원 크기에 맞는 간격으로 확대 — 중앙값 거리가 "평균 지름 × √n / 2" 정도가 되게
  const meanR = radius.reduce((a, b) => a + b, 0) / n;
  const compressedMedian = median(xs.map((x, i) => Math.hypot(x, ys[i]!)).filter((d) => d > 1e-6)) || 1;
  const target = Math.max(meanR * 2 + gap, (meanR * 2 + gap) * Math.sqrt(n) * 0.5);
  const grow = target / compressedMedian;
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

  // 파일 보기(충돌 해소 없음): 상위 5%보다 먼 점은 가장자리로 끌어온다 —
  // 떨어진 점 하나 때문에 수백 개가 작게 줄어드는 것을 막는다
  if (!relax && n > 20) {
    const radial = xs.map((x, i) => Math.hypot(x, ys[i]!));
    const limit = [...radial].sort((a, b) => a - b)[Math.floor(n * 0.95)]! * 1.1;
    for (let i = 0; i < n; i++) {
      if (radial[i]! > limit) {
        xs[i] = (xs[i]! / radial[i]!) * limit;
        ys[i] = (ys[i]! / radial[i]!) * limit;
      }
    }
  }

  // 3. 충돌 해소 + 연결 스프링 + 약한 중심 인력
  if (relax) {
    for (let step = 0; step < iterations; step++) {
      const cool = 1 - step / iterations;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const vx = xs[j]! - xs[i]!;
          const vy = ys[j]! - ys[i]!;
          const d = Math.hypot(vx, vy) || 1e-6;
          const min = radius[i]! + radius[j]! + gap;
          if (d < min) {
            const push = (min - d) / 2;
            xs[i]! -= (vx / d) * push;
            ys[i]! -= (vy / d) * push;
            xs[j]! += (vx / d) * push;
            ys[j]! += (vy / d) * push;
          }
        }
      }
      for (const { s, t } of links) {
        const vx = xs[t]! - xs[s]!;
        const vy = ys[t]! - ys[s]!;
        const d = Math.hypot(vx, vy) || 1e-6;
        const rest = (radius[s]! + radius[t]! + gap) * 1.6;
        if (d > rest) {
          const pull = (d - rest) * 0.02 * cool;
          xs[s]! += (vx / d) * pull;
          ys[s]! += (vy / d) * pull;
          xs[t]! -= (vx / d) * pull;
          ys[t]! -= (vy / d) * pull;
        }
      }
      // 중심 인력 — 연결이 없어 멀리 떨어진 개념까지 끌어와 한 덩어리로 모은다.
      // 충돌 해소가 받쳐 주므로 겹치지는 않고, 원끼리 맞닿을 때까지만 모인다.
      for (let i = 0; i < n; i++) {
        xs[i]! *= 1 - 0.02 * cool;
        ys[i]! *= 1 - 0.02 * cool;
      }
    }
  }

  // 4. 결과를 감싸는 viewBox — 원 아래 부채비율 글자(약 18px)까지 포함
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const r = radius[i]!;
    minX = Math.min(minX, xs[i]! - r);
    maxX = Math.max(maxX, xs[i]! + r);
    minY = Math.min(minY, ys[i]! - items[i]!.r);
    maxY = Math.max(maxY, ys[i]! + items[i]!.r + (relax ? 20 : 0));
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
