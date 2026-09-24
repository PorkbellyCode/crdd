import { describe, expect, test } from "bun:test";
import { activeSettings, parseStored, withActive, withEntry, withoutEntry } from "./settings";

const A = { apiKey: "sk-ant-aaa", model: "claude-x" };
const O = { apiKey: "sk-proj-bbb", model: "gpt-5" };

describe("parseStored", () => {
  test("v1(제공자 없음)은 Anthropic 키로 옮긴다", () => {
    const stored = parseStored(JSON.stringify(A));
    expect(activeSettings(stored)).toEqual({ provider: "anthropic", ...A });
  });
  test("깨진 값·빈 값은 빈 설정", () => {
    expect(activeSettings(parseStored("{"))).toBeNull();
    expect(activeSettings(parseStored(null))).toBeNull();
  });
  test("모르는 제공자나 빈 키는 버린다", () => {
    const stored = parseStored(JSON.stringify({ v: 2, active: "mistral", entries: { mistral: A, openai: { apiKey: "" } } }));
    expect(stored.entries).toEqual({});
    expect(stored.active).toBeNull();
  });
});

describe("제공자별 보관", () => {
  test("제공자를 바꿔도 다른 키는 남는다", () => {
    let stored = withEntry(parseStored(null), "anthropic", A);
    stored = withEntry(stored, "openai", O);
    expect(activeSettings(stored)?.provider).toBe("openai");
    expect(stored.entries.anthropic).toEqual(A);
    expect(activeSettings(withActive(stored, "anthropic"))?.model).toBe("claude-x");
  });
  test("사용 중인 키를 지우면 남은 키가 사용 중이 된다", () => {
    const stored = withEntry(withEntry(parseStored(null), "anthropic", A), "openai", O);
    expect(activeSettings(withoutEntry(stored, "openai"))?.provider).toBe("anthropic");
    expect(activeSettings(withoutEntry(withoutEntry(stored, "openai"), "anthropic"))).toBeNull();
  });
  test("저장된 키가 없는 제공자는 사용 중으로 바꿀 수 없다", () => {
    const stored = withEntry(parseStored(null), "anthropic", A);
    expect(withActive(stored, "gemini").active).toBe("anthropic");
  });
});
