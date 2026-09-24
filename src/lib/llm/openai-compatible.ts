/**
 * OpenAI 호환 Chat Completions 클라이언트 (서버 전용) — OpenAI, Gemini, OpenRouter 공용.
 *
 * 세 제공자 모두 `POST {base}/chat/completions` + function calling을 받는다. 차이는
 * 주소와 모델 목록 모양뿐이라 구현 하나로 처리한다.
 *
 * 키 취급 규칙은 anthropic.ts와 같다: 키는 Authorization 헤더에만 싣고,
 * 에러 메시지에 키나 응답 원문을 넣지 않는다.
 */
import "server-only";
import { compatErrorMessage, extractToolArguments } from "./compat";
import { filterModels, PROVIDERS, type ProviderId, type RawModel } from "./providers";
import { LlmError, type LlmClient, type ToolCall } from "./types";

type CompatProvider = Exclude<ProviderId, "anthropic">;

function headers(provider: CompatProvider, apiKey: string): Record<string, string> {
  const base: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  };
  if (provider === "openrouter") {
    // OpenRouter가 요청 출처를 표시하는 데 쓰는 선택 헤더
    base["http-referer"] = process.env.AUTH_URL || "https://crdd.fly.dev";
    base["x-title"] = "CRDD";
  }
  return base;
}

async function toLlmError(response: Response): Promise<LlmError> {
  const text = await response.text().catch(() => "");
  const { message, status } = compatErrorMessage(response.status, text);
  return new LlmError(message, status);
}

async function get(provider: CompatProvider, apiKey: string, path: string): Promise<Response> {
  try {
    return await fetch(`${PROVIDERS[provider].baseUrl}${path}`, {
      headers: headers(provider, apiKey),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new LlmError("LLM 제공자 서버에 연결하지 못했습니다.", 502);
  }
}

export function openAiCompatible(provider: CompatProvider): LlmClient {
  return {
    async listModels(apiKey) {
      // OpenRouter의 모델 목록은 키 없이도 열리므로, 키가 맞는지는 따로 확인한다
      if (provider === "openrouter") {
        const check = await get(provider, apiKey, "/key");
        if (!check.ok) throw await toLlmError(check);
      }
      const response = await get(provider, apiKey, "/models");
      if (!response.ok) throw await toLlmError(response);
      const body = (await response.json()) as {
        data?: { id: string; name?: string; created?: number; supported_parameters?: string[] }[];
      };
      const raw: RawModel[] = (body.data ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        created: m.created,
        tools: m.supported_parameters ? m.supported_parameters.includes("tools") : undefined,
      }));
      return filterModels(provider, raw);
    },

    async callTool<T>({ apiKey, model, system, prompt, tool }: ToolCall): Promise<T> {
      let response: Response;
      try {
        response = await fetch(`${PROVIDERS[provider].baseUrl}/chat/completions`, {
          method: "POST",
          headers: headers(provider, apiKey),
          cache: "no-store",
          signal: AbortSignal.timeout(120_000),
          // 토큰 상한은 넣지 않는다 — 제공자·모델마다 파라미터 이름이 달라
          // (max_tokens / max_completion_tokens) 하나를 고르면 다른 쪽이 거절한다
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
            tools: [
              {
                type: "function",
                function: { name: tool.name, description: tool.description, parameters: tool.input_schema },
              },
            ],
            tool_choice: { type: "function", function: { name: tool.name } },
          }),
        });
      } catch {
        throw new LlmError("LLM 제공자 서버에 연결하지 못했습니다.", 502);
      }
      if (!response.ok) throw await toLlmError(response);

      const args = extractToolArguments(await response.json(), tool.name);
      if (args === null) {
        throw new LlmError("LLM이 예상한 형식으로 답하지 않았습니다. 다시 시도하거나 다른 모델을 골라 주세요.", 502);
      }
      return args as T;
    },
  };
}
