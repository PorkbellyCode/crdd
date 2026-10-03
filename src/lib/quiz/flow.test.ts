import { describe, expect, test } from "bun:test";
import {
  applyVerdict,
  currentIndex,
  initialProgress,
  isFinished,
  matchesProgress,
  readFence,
} from "./flow";

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

describe("fence — 화면이 보고 있는 지점", () => {
  test("같은 index·attempts·stage면 통과", () => {
    const progress = initialProgress(2);
    expect(matchesProgress(progress, { index: 0, attempts: 0, stage: "first" })).toBe(true);
    expect(matchesProgress(progress, { index: 0, attempts: 0 })).toBe(true);
  });

  test("다른 문항을 보고 있으면 거절", () => {
    const progress = initialProgress(2);
    expect(matchesProgress(progress, { index: 1, attempts: 0 })).toBe(false);
  });

  test("같은 index인데 단계가 넘어갔으면 거절 — 힌트를 못 본 채 채점되는 걸 막는다", () => {
    const progress = initialProgress(1);
    progress[0] = applyVerdict(progress[0]!, "답", fail); // first → hint, attempts 1
    // 새로고침으로 stage=first·attempts=0을 보고 있던 화면의 재제출
    expect(matchesProgress(progress, { index: 0, attempts: 0, stage: "first" })).toBe(false);
    expect(matchesProgress(progress, { index: 0, attempts: 0 })).toBe(false);
    // stage만 보내도 잡힌다
    expect(matchesProgress(progress, { index: 0, attempts: 1, stage: "first" })).toBe(false);
    // 서버와 같은 지점이면 통과
    expect(matchesProgress(progress, { index: 0, attempts: 1, stage: "hint" })).toBe(true);
  });

  test("끝난 퀴즈에는 맞는 지점이 없다", () => {
    const progress = initialProgress(1);
    progress[0] = applyVerdict(progress[0]!, "답", pass);
    expect(matchesProgress(progress, { index: 0, attempts: 1 })).toBe(false);
    expect(matchesProgress(progress, { index: -1, attempts: 0 })).toBe(false);
  });
});

describe("readFence", () => {
  test("index·attempts가 있으면 읽는다. stage는 선택", () => {
    expect(readFence({ index: 1, attempts: 2 })).toEqual({ index: 1, attempts: 2, stage: undefined });
    expect(readFence({ index: 0, attempts: 0, stage: "hint" })).toEqual({
      index: 0,
      attempts: 0,
      stage: "hint",
    });
  });

  test("빠지거나 형식이 틀리면 null — 모르는 지점은 채점하지 않는다", () => {
    expect(readFence(null)).toBeNull();
    expect(readFence({ attempts: 0 })).toBeNull();
    expect(readFence({ index: 0 })).toBeNull();
    expect(readFence({ index: "0", attempts: 0 })).toBeNull();
    expect(readFence({ index: 0, attempts: -1 })).toBeNull();
    expect(readFence({ index: 1.5, attempts: 0 })).toBeNull();
    expect(readFence({ index: 0, attempts: 0, stage: "bogus" })).toBeNull();
  });
});
