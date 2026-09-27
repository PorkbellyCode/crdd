import { describe, expect, test } from "bun:test";
import { normalizeConceptName } from "./concepts";

describe("normalizeConceptName", () => {
  test("공백과 따옴표를 정리한다", () => {
    expect(normalizeConceptName('  "게시글  작성·수정"  ')).toBe("게시글 작성·수정");
  });
  test("줄바꿈 같은 제어 문자는 공백으로", () => {
    expect(normalizeConceptName("인증\n세션")).toBe("인증 세션");
  });
  test("비었거나 40자를 넘으면 쓰지 않는다", () => {
    expect(normalizeConceptName("   ")).toBeNull();
    expect(normalizeConceptName("가".repeat(41))).toBeNull();
    expect(normalizeConceptName(42)).toBeNull();
  });
});
