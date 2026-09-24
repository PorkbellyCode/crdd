/**
 * Anthropic Messages API 최소 클라이언트 (서버 전용).
 *
 * SDK 대신 fetch 하나로 부른다 — 필요한 건 모델 목록과 "도구 하나 강제 호출"로
 * 구조화된 JSON을 받는 것뿐이다.
 *
 * 키 취급 규칙: 인자로 받은 키는 요청 헤더에만 싣는다. 에러 메시지에 키나
 * 요청 본문을 절대 넣지 않는다 — 에러는 화면과 서버 로그로 흘러가기 때문이다.
 */
import "server-only";

const API = "https://api.anthropic.com/v1";
const VERSION = "2023-06-01";

export class LlmError extends Error {
  constructor(
    message: string,
    /** 브라우저에 돌려줄 HTTP 상태 */
    readonly status: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

function headers(apiKey: string) {
  return {
    "x-api-key": apiKey,
    "anthropic-version": VERSION,
    "content-type": "application/json",
  };
}

/** Anthropic 에러를 사용자에게 보여줄 문장으로 — 원문 본문은 버린다 */
async function toLlmError(response: Response): Promise<LlmError> {
  let type = "";
  try {
    const body = (await response.json()) as { error?: { type?: string } };
    type = body.error?.type ?? "";
  } catch {
    // 본문이 JSON이 아니면 상태 코드만으로 판단한다
  }
  switch (response.status) {
    case 401:
      return new LlmError("API 키가 유효하지 않습니다. 설정에서 키를 확인해 주세요.", 401);
    case 403:
      return new LlmError("이 키로는 해당 모델을 쓸 수 없습니다.", 403);
    case 404:
      return new LlmError("선택한 모델을 찾을 수 없습니다. 설정에서 모델을 다시 골라 주세요.", 400);
    case 429:
      return new LlmError("API 사용량 한도에 걸렸습니다. 잠시 후 다시 시도해 주세요.", 429);
    case 529:
      return new LlmError("Anthropic API가 혼잡합니다. 잠시 후 다시 시도해 주세요.", 503);
    default:
      if (type === "invalid_request_error") {
        return new LlmError("LLM 요청이 거절되었습니다 (크레딧 잔액 부족일 수 있습니다).", 400);
      }
      return new LlmError(`LLM 호출에 실패했습니다 (HTTP ${response.status}).`, 502);
  }
}

export interface ModelInfo {
  id: string;
  name: string;
}

/** 키 확인 겸 모델 목록. 최신 모델이 앞에 온다 */
export async function listModels(apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch(`${API}/models?limit=100`, {
    headers: headers(apiKey),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw await toLlmError(response);
  const body = (await response.json()) as { data: { id: string; display_name?: string }[] };
  return body.data.map((model) => ({ id: model.id, name: model.display_name ?? model.id }));
}

export interface ToolCall<TInput> {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  tool: { name: string; description: string; input_schema: Record<string, unknown> };
  maxTokens?: number;
}

/** 도구 하나를 강제로 호출하게 해서 그 입력(JSON)을 결과로 받는다 */
export async function callTool<TInput>({
  apiKey,
  model,
  system,
  prompt,
  tool,
  maxTokens = 4096,
}: ToolCall<TInput>): Promise<TInput> {
  let response: Response;
  try {
    response = await fetch(`${API}/messages`, {
      method: "POST",
      headers: headers(apiKey),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
      }),
    });
  } catch {
    throw new LlmError("LLM 서버에 연결하지 못했습니다.", 502);
  }
  if (!response.ok) throw await toLlmError(response);

  const body = (await response.json()) as {
    content: { type: string; name?: string; input?: unknown }[];
    stop_reason?: string;
  };
  const call = body.content.find((block) => block.type === "tool_use" && block.name === tool.name);
  if (!call?.input) {
    throw new LlmError(
      body.stop_reason === "max_tokens"
        ? "LLM 응답이 길이 한도에서 잘렸습니다. 다시 시도해 주세요."
        : "LLM이 예상한 형식으로 답하지 않았습니다. 다시 시도해 주세요.",
      502,
    );
  }
  return call.input as TInput;
}
