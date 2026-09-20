/**
 * 그래프 레이아웃 — 서버에서 미리 계산한다.
 *
 * 브라우저에서 물리 시뮬레이션을 돌리지 않는 이유: 좌표가 고정되면 같은 커밋에
 * 대해 항상 같은 그림이 나오고(스크린샷·공유·회귀 비교가 가능해진다), 클라이언트는
 * SVG만 그리면 되므로 렌더링 라이브러리 선택이 자유로워진다.
 *
 * Fruchterman-Reingold + 커뮤니티 중심 인력. 시드 고정이라 결정론적이다.
 */

export interface LayoutOptions {
  iterations?: number;
  seed?: number;
  /** 같은 그룹끼리 끌어당기는 힘 (커뮤니티 단위로 뭉치게 한다) */
  groups?: number[];
  groupPull?: number;
  kScale?: number;
  weights?: number[];
}

export interface Point {
  x: number;
  y: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function forceLayout(
  count: number,
  edges: [number, number][],
  options: LayoutOptions = {},
): Point[] {
  const {
    iterations = 260,
    seed = 7,
    groups,
    groupPull = 0.45,
    kScale = 1,
    weights,
  } = options;

  const random = mulberry32(seed);
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    xs[i] = (random() - 0.5) * 2;
    ys[i] = (random() - 0.5) * 2;
  }
  if (count <= 1) return [{ x: 0, y: 0 }];

  const k = kScale * Math.sqrt(1 / count);
  const dx = new Float64Array(count);
  const dy = new Float64Array(count);

  const groupIds = groups ? [...new Set(groups)] : [];

  let temperature = 0.12;
  for (let step = 0; step < iterations; step++) {
    dx.fill(0);
    dy.fill(0);

    // 반발
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const vx = xs[i]! - xs[j]!;
        const vy = ys[i]! - ys[j]!;
        const d2 = vx * vx + vy * vy + 1e-9;
        const force = (k * k) / d2;
        dx[i]! += vx * force;
        dy[i]! += vy * force;
        dx[j]! -= vx * force;
        dy[j]! -= vy * force;
      }
    }

    // 인력 (엣지)
    for (let e = 0; e < edges.length; e++) {
      const [a, b] = edges[e]!;
      const weight = weights?.[e] ?? 1;
      const vx = xs[a]! - xs[b]!;
      const vy = ys[a]! - ys[b]!;
      const length = Math.sqrt(vx * vx + vy * vy) + 1e-9;
      const force = (length / k) * weight;
      const fx = (vx / length) * force;
      const fy = (vy / length) * force;
      dx[a]! -= fx;
      dy[a]! -= fy;
      dx[b]! += fx;
      dy[b]! += fy;
    }

    // 그룹 중심으로 당기기
    if (groups) {
      for (const id of groupIds) {
        let cx = 0;
        let cy = 0;
        let n = 0;
        for (let i = 0; i < count; i++) {
          if (groups[i] === id) {
            cx += xs[i]!;
            cy += ys[i]!;
            n++;
          }
        }
        if (n === 0) continue;
        cx /= n;
        cy /= n;
        for (let i = 0; i < count; i++) {
          if (groups[i] === id) {
            dx[i]! += (cx - xs[i]!) * groupPull;
            dy[i]! += (cy - ys[i]!) * groupPull;
          }
        }
      }
    }

    for (let i = 0; i < count; i++) {
      const length = Math.sqrt(dx[i]! * dx[i]! + dy[i]! * dy[i]!) + 1e-9;
      const capped = Math.min(length, temperature);
      xs[i]! += (dx[i]! / length) * capped;
      ys[i]! += (dy[i]! / length) * capped;
    }
    temperature *= 0.985;
  }

  return Array.from({ length: count }, (_, i) => ({ x: xs[i]!, y: ys[i]! }));
}

/** viewBox 안에 들어오도록 정규화한다 */
export function normalize(points: Point[], width: number, height: number, pad: number): Point[] {
  if (points.length === 0) return [];
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const shifted = points.map((p) => ({ x: p.x - minX, y: p.y - minY }));
  const maxX = Math.max(...shifted.map((p) => p.x), 1e-9);
  const maxY = Math.max(...shifted.map((p) => p.y), 1e-9);
  const scale = Math.min((width - 2 * pad) / maxX, (height - 2 * pad) / maxY);
  const scaled = shifted.map((p) => ({ x: p.x * scale, y: p.y * scale }));
  const spanX = Math.max(...scaled.map((p) => p.x), 0);
  const spanY = Math.max(...scaled.map((p) => p.y), 0);
  const offsetX = pad + (width - 2 * pad - spanX) / 2;
  const offsetY = pad + (height - 2 * pad - spanY) / 2;
  return scaled.map((p) => ({
    x: Math.round((p.x + offsetX) * 10) / 10,
    y: Math.round((p.y + offsetY) * 10) / 10,
  }));
}
