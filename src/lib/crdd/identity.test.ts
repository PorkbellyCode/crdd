import { describe, expect, test } from "bun:test";
import { assignConceptKeys, jaccard, newConceptKey } from "./identity";

describe("jaccard", () => {
  test("같은 집합은 1, 겹침 없으면 0", () => {
    expect(jaccard(["a", "b"], ["b", "a"])).toBe(1);
    expect(jaccard(["a"], ["b"])).toBe(0);
    expect(jaccard(["a", "b", "c"], ["a", "b"])).toBeCloseTo(2 / 3);
  });
});

describe("assignConceptKeys", () => {
  test("첫 분석은 communityId + 파일 해시로 키를 만든다", () => {
    const keys = assignConceptKeys([], [{ communityId: 3, files: ["x.ts", "y.ts"] }]);
    expect(keys.get(3)).toBe(newConceptKey(3, ["y.ts", "x.ts"]));
  });

  test("커뮤니티 번호가 바뀌어도 파일 집합이 비슷하면 기존 키를 이어받는다", () => {
    const previous = [
      { key: "c0-aaaa", files: ["auth.ts", "session.ts", "login.tsx"] },
      { key: "c1-bbbb", files: ["post.ts", "post-list.tsx"] },
    ];
    // 재분석: 번호가 뒤바뀌고 auth 쪽에 파일이 하나 늘었다
    const keys = assignConceptKeys(previous, [
      { communityId: 0, files: ["post.ts", "post-list.tsx"] },
      { communityId: 1, files: ["auth.ts", "session.ts", "login.tsx", "logout.tsx"] },
    ]);
    expect(keys.get(0)).toBe("c1-bbbb");
    expect(keys.get(1)).toBe("c0-aaaa");
  });

  test("많이 달라진 커뮤니티는 새 키를 받는다", () => {
    const keys = assignConceptKeys(
      [{ key: "c0-aaaa", files: ["a.ts", "b.ts", "c.ts", "d.ts"] }],
      [{ communityId: 0, files: ["a.ts", "x.ts", "y.ts", "z.ts"] }],
    );
    expect(keys.get(0)).not.toBe("c0-aaaa");
  });

  test("하나의 기존 키는 한 커뮤니티에만 배정된다 (쪼개진 경우 더 닮은 쪽)", () => {
    const keys = assignConceptKeys(
      [{ key: "k", files: ["a", "b", "c", "d"] }],
      [
        { communityId: 0, files: ["a", "b", "c"] },
        { communityId: 1, files: ["a", "b"] },
      ],
    );
    expect(keys.get(0)).toBe("k");
    expect(keys.get(1)).not.toBe("k");
  });
});
