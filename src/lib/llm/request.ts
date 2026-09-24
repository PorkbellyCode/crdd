/**
 * 요청 헤더에서 BYOK 자격을 꺼낸다 (서버 전용).
 * 여기서 꺼낸 키는 호출한 라우트의 지역 변수로만 산다.
 */
import "server-only";
import { LLM_KEY_HEADER, LLM_MODEL_HEADER, LLM_PROVIDER_HEADER } from "./headers";
import { isProviderId, MODEL_PATTERN, PROVIDERS, type ProviderId } from "./providers";
import type { LlmCredentials } from "./server";
import { LlmError } from "./types";

/** 제공자 헤더가 없으면 Anthropic — 제공자 선택이 생기기 전의 브라우저 저장값과 호환 */
export function readLlmProvider(request: Request): ProviderId {
  const value = request.headers.get(LLM_PROVIDER_HEADER)?.trim() || "anthropic";
  if (!isProviderId(value)) throw new LlmError("지원하지 않는 LLM 제공자입니다.", 400);
  return value;
}

export function readLlmKey(request: Request, provider: ProviderId): string {
  const info = PROVIDERS[provider];
  const apiKey = request.headers.get(LLM_KEY_HEADER)?.trim() ?? "";
  if (!apiKey) throw new LlmError(`API 키가 필요합니다. 설정에서 ${info.label} 키를 입력해 주세요.`, 401);
  if (!info.keyPattern.test(apiKey)) {
    throw new LlmError(`${info.label} 키 형식이 아닙니다 (${info.keyPlaceholder}).`, 400);
  }
  return apiKey;
}

export function readLlmCredentials(request: Request): LlmCredentials {
  const provider = readLlmProvider(request);
  const apiKey = readLlmKey(request, provider);
  const model = request.headers.get(LLM_MODEL_HEADER)?.trim() ?? "";
  if (!MODEL_PATTERN.test(model)) {
    throw new LlmError("모델이 선택되지 않았습니다. 설정에서 모델을 골라 주세요.", 400);
  }
  return { provider, apiKey, model };
}
