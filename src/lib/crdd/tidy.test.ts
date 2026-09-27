import { describe, expect, test } from "bun:test";
import { textWidth, tidyBubbles } from "./tidy";

function overlaps(points: { x: number; y: number }[], radii: number[]) {
  let count = 0;
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++)
      if (Math.hypot(points[i]!.x - points[j]!.x, points[i]!.y - points[j]!.y) < radii[i]! + radii[j]!) count++;
  return count;
}

describe("tidyBubbles", () => {
  // workwrap처럼: 멀리 떨어진 2개 + 가운데 한 점에 뭉친 9개
  const squeezed = [
    { x: 500, y: 60, r: 10 },
    { x: 500, y: 620, r: 10 },
    ...Array.from({ length: 9 }, (_, i) => ({ x: 500 + (i % 3), y: 330 + Math.floor(i / 3), r: 14 + i })),
  ];

  test("뭉친 원들이 서로 겹치지 않게 벌어진다", () => {
    const { points } = tidyBubbles(squeezed);
    expect(overlaps(points, squeezed.map((b) => b.r))).toBe(0);
  });

  test("원과 원 아래 이름이 차지하는 사각형끼리 겹치지 않는다", () => {
    const labeled = squeezed.map((b, i) => ({ ...b, label: `Install Prompt ${i}` }));
    const { points } = tidyBubbles(labeled);
    const rects = labeled.map((b, i) => {
      const half = Math.max(b.r, textWidth(b.label, 6.7) / 2);
      return { l: points[i]!.x - half, r: points[i]!.x + half, t: points[i]!.y - b.r, b: points[i]!.y + b.r + 20 };
    });
    let hits = 0;
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const c = rects[j]!;
        if (a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b) hits++;
      }
    expect(hits).toBe(0);
  });

  test("이상치가 없으면 상대 배치(좌우·위아래 순서)를 지킨다", () => {
    const spread = [
      { x: 100, y: 100, r: 12 },
      { x: 400, y: 120, r: 12 },
      { x: 250, y: 400, r: 12 },
      { x: 700, y: 380, r: 12 },
    ];
    const { points } = tidyBubbles(spread);
    expect(points[0]!.x).toBeLessThan(points[1]!.x);
    expect(points[2]!.y).toBeGreaterThan(points[0]!.y);
    expect(points[3]!.x).toBeGreaterThan(points[2]!.x);
  });

  test("viewBox가 모든 원을 감싼다", () => {
    const { points, box } = tidyBubbles(squeezed);
    points.forEach((p, i) => {
      const r = squeezed[i]!.r;
      expect(p.x - r).toBeGreaterThanOrEqual(box.x);
      expect(p.x + r).toBeLessThanOrEqual(box.x + box.w);
      expect(p.y - r).toBeGreaterThanOrEqual(box.y);
      expect(p.y + r).toBeLessThanOrEqual(box.y + box.h);
    });
  });

  test("결정론적 — 같은 입력은 같은 결과", () => {
    expect(tidyBubbles(squeezed)).toEqual(tidyBubbles(squeezed));
  });

  test("파일 보기: 멀리 떨어진 점 하나가 전체를 줄이지 않는다", () => {
    const cloud = Array.from({ length: 100 }, (_, i) => ({ x: 500 + (i % 10) * 5, y: 300 + Math.floor(i / 10) * 5, r: 2.6 }));
    const withOutlier = [...cloud, { x: -5000, y: 300, r: 2.6 }];
    const base = tidyBubbles(cloud, [], { relax: false }).box;
    const outlier = tidyBubbles(withOutlier, [], { relax: false }).box;
    // 이상치가 있어도 viewBox 폭이 두 배를 넘지 않는다
    expect(outlier.w).toBeLessThan(base.w * 2);
  });

  test("연결 없는 개념은 멀리 떨어지지 않고 본 덩어리 바로 아래에 모인다", () => {
    const items = [
      { x: 400, y: 300, r: 20, label: "A" },
      { x: 450, y: 330, r: 20, label: "B" },
      { x: 420, y: 380, r: 20, label: "C" },
      { x: 5000, y: -3000, r: 12, label: "Lonely" },
    ];
    const links = [
      { s: 0, t: 1 },
      { s: 1, t: 2 },
    ];
    const { points } = tidyBubbles(items, links);
    const linkedFloor = Math.max(...points.slice(0, 3).map((p, i) => p.y + items[i]!.r + 20));
    const lonely = points[3]!;
    expect(lonely.y).toBeGreaterThan(linkedFloor);
    expect(lonely.y - linkedFloor).toBeLessThan(80);
    const xs = points.slice(0, 3).map((p) => p.x);
    expect(lonely.x).toBeGreaterThan(Math.min(...xs) - 100);
    expect(lonely.x).toBeLessThan(Math.max(...xs) + 100);
  });

  test("빈 입력", () => {
    expect(tidyBubbles([]).points).toEqual([]);
  });
});
