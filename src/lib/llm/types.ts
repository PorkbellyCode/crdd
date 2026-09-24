import type { ModelInfo } from "./providers";

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema */
  input_schema: Record<string, unknown>;
}

export interface ToolCall {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  tool: ToolSpec;
  maxTokens?: number;
}

/** 제공자 구현이 갖춰야 할 두 가지 — 모델 목록(=키 확인)과 도구 강제 호출 */
export interface LlmClient {
  listModels(apiKey: string): Promise<ModelInfo[]>;
  callTool<T>(call: ToolCall): Promise<T>;
}

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
