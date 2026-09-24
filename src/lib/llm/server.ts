/**
 * 제공자 id → 구현. 라우트와 출제 코드는 여기서만 LLM 클라이언트를 얻는다.
 */
import "server-only";
import { anthropicClient } from "./anthropic";
import { openAiCompatible } from "./openai-compatible";
import type { ProviderId } from "./providers";
import type { LlmClient } from "./types";

export function llmClient(provider: ProviderId): LlmClient {
  return provider === "anthropic" ? anthropicClient : openAiCompatible(provider);
}

export interface LlmCredentials {
  provider: ProviderId;
  apiKey: string;
  model: string;
}
