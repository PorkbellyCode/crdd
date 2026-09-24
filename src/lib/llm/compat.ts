/**
 * OpenAI 호환 응답 해석 — 순수 함수 (테스트 대상).
 */

/** chat/completions 응답에서 강제 호출한 도구의 인자(JSON)를 꺼낸다 */
export function extractToolArguments(body: unknown, toolName: string): unknown | null {
  const message = (body as { choices?: { message?: Record<string, unknown> }[] })?.choices?.[0]?.message;
  if (!message) return null;

  const calls = message.tool_calls as { function?: { name?: string; arguments?: string } }[] | undefined;
  const call = calls?.find((c) => c.function?.name === toolName) ?? calls?.[0];
  const raw = call?.function?.arguments ?? (typeof message.content === "string" ? message.content : null);
  if (!raw) return null;

  // 일부 모델은 코드 블록으로 감싸서 돌려준다
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * 오류 응답 → 사용자에게 보여줄 문장. 원문 본문은 돌려주지 않는다 (키가 섞일 여지를 없앤다).
 * Gemini는 잘못된 키에 400을 돌려주므로 본문의 "API key" 언급으로 구분한다.
 */
export function compatErrorMessage(status: number, bodyText: string): { message: string; status: number } {
  const mentionsKey = /api[ _-]?key/i.test(bodyText);
  if (status === 401 || ((status === 400 || status === 403) && mentionsKey)) {
    return { message: "API 키가 유효하지 않습니다. 설정에서 키를 확인해 주세요.", status: 401 };
  }
  if (status === 402) return { message: "크레딧이 부족합니다. 제공자 계정의 잔액을 확인해 주세요.", status: 402 };
  if (status === 403) return { message: "이 키로는 해당 모델을 쓸 수 없습니다.", status: 403 };
  if (status === 404) {
    return { message: "선택한 모델을 찾을 수 없습니다. 설정에서 모델을 다시 골라 주세요.", status: 400 };
  }
  if (status === 429) {
    return { message: "사용량 한도에 걸렸습니다. 잠시 후 다시 시도하거나 요금제를 확인해 주세요.", status: 429 };
  }
  if (status >= 500) return { message: "LLM 제공자 서버에 문제가 있습니다. 잠시 후 다시 시도해 주세요.", status: 503 };
  if (/tool|function/i.test(bodyText)) {
    return { message: "이 모델은 도구 호출을 지원하지 않습니다. 다른 모델을 골라 주세요.", status: 400 };
  }
  return { message: `LLM 요청이 거절되었습니다 (HTTP ${status}).`, status: 400 };
}
