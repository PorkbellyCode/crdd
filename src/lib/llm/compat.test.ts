import { describe, expect, test } from "bun:test";
import { compatErrorMessage, extractToolArguments } from "./compat";
import { defaultModel, filterModels } from "./providers";

describe("extractToolArguments", () => {
  test("tool_calls의 arguments를 파싱", () => {
    const body = { choices: [{ message: { tool_calls: [{ function: { name: "submit", arguments: '{"a":1}' } }] } }] };
    expect(extractToolArguments(body, "submit")).toEqual({ a: 1 });
  });
  test("도구 호출 없이 본문에 JSON을 넣은 경우(코드 블록 포함)도 받는다", () => {
    const body = { choices: [{ message: { content: '```json\n{"a":2}\n```' } }] };
    expect(extractToolArguments(body, "submit")).toEqual({ a: 2 });
  });
  test("깨진 JSON이나 빈 응답은 null", () => {
    expect(extractToolArguments({ choices: [{ message: { content: "안녕하세요" } }] }, "x")).toBeNull();
    expect(extractToolArguments({}, "x")).toBeNull();
  });
});

describe("compatErrorMessage", () => {
  test("Gemini는 잘못된 키를 400으로 준다 — 키 오류로 분류", () => {
    expect(compatErrorMessage(400, '{"error":{"message":"API key not valid"}}').status).toBe(401);
  });
  test("원문을 그대로 돌려주지 않는다", () => {
    const secret = "sk-SECRETSECRETSECRET";
    expect(compatErrorMessage(400, `bad request ${secret}`).message).not.toContain(secret);
  });
  test("상태 코드별 분류", () => {
    expect(compatErrorMessage(402, "").status).toBe(402);
    expect(compatErrorMessage(429, "").status).toBe(429);
    expect(compatErrorMessage(500, "").status).toBe(503);
  });
});

describe("filterModels / defaultModel", () => {
  test("OpenAI: 대화 모델만 최신순", () => {
    const models = filterModels("openai", [
      { id: "gpt-4.1", created: 1 },
      { id: "text-embedding-3-large", created: 9 },
      { id: "gpt-4o-audio-preview", created: 8 },
      { id: "gpt-5", created: 5 },
      { id: "gpt-5-mini", created: 6 },
    ]);
    expect(models.map((m) => m.id)).toEqual(["gpt-5-mini", "gpt-5", "gpt-4.1"]);
    expect(defaultModel("openai", models)).toBe("gpt-5");
  });
  test("Gemini: models/ 접두어를 떼고 임베딩 등은 제외", () => {
    const models = filterModels("gemini", [
      { id: "models/gemini-2.5-flash" },
      { id: "models/gemini-2.5-pro" },
      { id: "models/text-embedding-004" },
      { id: "models/gemini-embedding-001" },
    ]);
    expect(models.map((m) => m.id)).toEqual(["gemini-2.5-flash", "gemini-2.5-pro"]);
    expect(defaultModel("gemini", models)).toBe("gemini-2.5-pro");
  });
  test("OpenRouter: 도구 호출 지원 모델만", () => {
    const models = filterModels("openrouter", [
      { id: "anthropic/claude-sonnet-4.5", tools: true, created: 2 },
      { id: "some/no-tools", tools: false, created: 3 },
    ]);
    expect(models.map((m) => m.id)).toEqual(["anthropic/claude-sonnet-4.5"]);
    expect(defaultModel("openrouter", models)).toBe("anthropic/claude-sonnet-4.5");
  });
});
