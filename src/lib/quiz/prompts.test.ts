import { describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
const { sanitizeQuestions } = await import("./prompts");

const material = [{ path: "a.ts", content: "x\ny\nz", truncated: false }];
const base = {
  kind: "flow" as const,
  level: "understanding" as const,
  question: "질문",
  codeExcerpt: { file: "a.ts", startLine: 1, endLine: 2, code: "x\ny" },
  rubric: ["a", "b"],
  hint: "힌트",
  explanation: "설명",
};

describe("sanitizeQuestions", () => {
  test("정상 문항은 통과", () => {
    expect(sanitizeQuestions([base], material)).toHaveLength(1);
  });
  test("hint 또는 explanation이 비면 버린다", () => {
    expect(sanitizeQuestions([{ ...base, hint: "  " }], material)).toHaveLength(0);
    expect(sanitizeQuestions([{ ...base, explanation: "" }], material)).toHaveLength(0);
  });
  test("LLM이 옮긴 code 대신 material 원문을 줄 범위로 잘라 쓴다", () => {
    const bad = { ...base, codeExcerpt: { ...base.codeExcerpt, code: "x\n#\nz-틀림" } };
    const [q] = sanitizeQuestions([bad], material);
    expect(q!.codeExcerpt.code).toBe("x\ny");
  });
});
