import { describe, expect, test } from "bun:test";
import { applyVerdict, currentIndex, initialProgress, isFinished } from "./flow";

const pass = { passed: true, feedback: "좋아요" };
const fail = { passed: false, feedback: "빠졌어요", hint: "H", explanation: "E" };

describe("applyVerdict", () => {
  test("첫 시도 정답 → first_try", () => {
    const [p] = initialProgress(1);
    expect(applyVerdict(p!, "답", pass).outcome).toBe("first_try");
  });

  test("틀림 → 힌트 단계, 힌트 저장", () => {
    const [p] = initialProgress(1);
    const next = applyVerdict(p!, "답", fail);
    expect(next.stage).toBe("hint");
    expect(next.hint).toBe("H");
    expect(next.explanation).toBeNull();
    expect(next.outcome).toBeNull();
  });

  test("힌트 후 정답 → after_hint, 설명 후 정답 → after_explanation", () => {
    const [p] = initialProgress(1);
    const afterHint = applyVerdict(applyVerdict(p!, "a", fail), "b", pass);
    expect(afterHint.outcome).toBe("after_hint");

    const inExplanation = applyVerdict(applyVerdict(p!, "a", fail), "b", fail);
    expect(inExplanation.stage).toBe("explanation");
    expect(inExplanation.explanation).toBe("E");
    expect(applyVerdict(inExplanation, "c", pass).outcome).toBe("after_explanation");
  });

  test("세 번 모두 틀림 → unresolved", () => {
    let [p] = initialProgress(1);
    p = applyVerdict(p!, "", fail);
    p = applyVerdict(p, "", fail);
    p = applyVerdict(p, "", fail);
    expect(p.outcome).toBe("unresolved");
    expect(p.attempts).toHaveLength(3);
  });

  test("끝난 문항에는 답할 수 없다", () => {
    const [p] = initialProgress(1);
    const done = applyVerdict(p!, "a", pass);
    expect(() => applyVerdict(done, "b", pass)).toThrow();
  });
});

describe("진행 위치", () => {
  test("모든 문항이 끝나야 finished", () => {
    const progress = initialProgress(2);
    expect(currentIndex(progress)).toBe(0);
    progress[0] = applyVerdict(progress[0]!, "a", pass);
    expect(currentIndex(progress)).toBe(1);
    expect(isFinished(progress)).toBe(false);
    progress[1] = applyVerdict(progress[1]!, "a", pass);
    expect(isFinished(progress)).toBe(true);
  });
});
