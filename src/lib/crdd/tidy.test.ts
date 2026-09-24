import { describe, expect, test } from "bun:test";
import { tidyBubbles } from "./tidy";

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

  test("이름 폭까지 고려해 겹치지 않는다", () => {
    const labeled = squeezed.map((b, i) => ({ ...b, label: `Install Prompt ${i}` }));
    const { points } = tidyBubbles(labeled);
    // 이름 폭의 절반(약 55px)을 반경으로 보면 서로 겹치지 않아야 한다
    const radii = labeled.map(() => 50);
    expect(overlaps(points, radii)).toBe(0);
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

  test("빈 입력", () => {
    expect(tidyBubbles([]).points).toEqual([]);
  });
});
