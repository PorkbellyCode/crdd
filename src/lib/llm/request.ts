/**
 * 요청 헤더에서 BYOK 자격을 꺼낸다 (서버 전용).
 * 여기서 꺼낸 키는 호출한 라우트의 지역 변수로만 산다.
 */
import "server-only";
import { API_KEY_PATTERN, LLM_KEY_HEADER, LLM_MODEL_HEADER, MODEL_PATTERN } from "./headers";
import { LlmError } from "./anthropic";

export function readLlmKey(request: Request): string {
  const apiKey = request.headers.get(LLM_KEY_HEADER)?.trim() ?? "";
  if (!apiKey) throw new LlmError("API 키가 필요합니다. 설정에서 Anthropic 키를 입력해 주세요.", 401);
  if (!API_KEY_PATTERN.test(apiKey)) throw new LlmError("Anthropic API 키 형식이 아닙니다 (sk-ant-…).", 400);
  return apiKey;
}

export function readLlmCredentials(request: Request): { apiKey: string; model: string } {
  const apiKey = readLlmKey(request);
  const model = request.headers.get(LLM_MODEL_HEADER)?.trim() ?? "";
  if (!MODEL_PATTERN.test(model)) throw new LlmError("모델이 선택되지 않았습니다. 설정에서 모델을 골라 주세요.", 400);
  return { apiKey, model };
}
