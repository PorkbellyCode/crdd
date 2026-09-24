/**
 * LLM 제공자 목록과 제공자별 규칙 — 브라우저와 서버가 같이 쓰는 순수 모듈.
 *
 * 구현은 두 갈래뿐이다.
 *   anthropic          → Anthropic Messages API (anthropic.ts)
 *   openai·gemini·openrouter → OpenAI 호환 Chat Completions (openai-compatible.ts)
 *     Gemini는 OpenAI 호환 주소를, OpenRouter는 키 하나로 여러 회사 모델을 제공한다.
 */

export type ProviderId = "anthropic" | "openai" | "gemini" | "openrouter";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** 키 형식 — 붙여 넣은 키가 이 제공자 것인지 먼저 거른다 */
  keyPattern: RegExp;
  keyPlaceholder: string;
  /** 키를 만드는 곳 */
  keyUrl: string;
  /** OpenAI 호환 제공자의 API 주소 */
  baseUrl?: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyPattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    keyPlaceholder: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    id: "openai",
    label: "OpenAI (GPT)",
    keyPattern: /^sk-[A-Za-z0-9_-]{20,}$/,
    keyPlaceholder: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    baseUrl: "https://api.openai.com/v1",
  },
  gemini: {
    id: "gemini",
    label: "Google (Gemini)",
    keyPattern: /^AIza[0-9A-Za-z_-]{30,}$/,
    keyPlaceholder: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter (여러 회사 모델)",
    keyPattern: /^sk-or-[A-Za-z0-9_-]{20,}$/,
    keyPlaceholder: "sk-or-…",
    keyUrl: "https://openrouter.ai/settings/keys",
    baseUrl: "https://openrouter.ai/api/v1",
  },
};

/** 드롭다운에 보이는 순서 */
export const PROVIDER_ORDER: ProviderId[] = ["anthropic", "openai", "gemini", "openrouter"];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && value in PROVIDERS;
}

/** 모델 이름 — 제공자마다 형식이 달라 넓게 받는다 (openrouter: "anthropic/claude-…") */
export const MODEL_PATTERN = /^[A-Za-z0-9._:/-]{1,128}$/;

export interface ModelInfo {
  id: string;
  name: string;
}

export interface RawModel {
  id: string;
  name?: string;
  /** 초 단위 생성 시각 — 최신순 정렬용 */
  created?: number;
  /** 도구 호출(function calling) 지원 여부. 모르면 undefined */
  tools?: boolean;
}

/** 퀴즈에 쓸 수 없는 모델(음성·이미지·임베딩 등)을 걸러낸다 */
const OPENAI_EXCLUDE = /(audio|realtime|tts|transcribe|image|search|embedding|instruct|moderation|codex|computer-use|deep-research)/;
const GEMINI_EXCLUDE = /(embedding|image|tts|live|native-audio|aqa|learnlm|gemma)/;

export function filterModels(provider: ProviderId, raw: RawModel[]): ModelInfo[] {
  const byNewest = (list: RawModel[]) => [...list].sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
  let list: RawModel[];
  switch (provider) {
    case "anthropic":
      list = raw;
      break;
    case "openai":
      list = byNewest(raw.filter((m) => /^(gpt-|o\d|chatgpt-)/.test(m.id) && !OPENAI_EXCLUDE.test(m.id)));
      break;
    case "gemini":
      list = raw
        .map((m) => ({ ...m, id: m.id.replace(/^models\//, "") }))
        .filter((m) => m.id.includes("gemini") && !GEMINI_EXCLUDE.test(m.id));
      break;
    case "openrouter":
      list = byNewest(raw.filter((m) => m.tools === true));
      break;
  }
  return list.map((m) => ({ id: m.id, name: m.name ?? m.id }));
}

/** 처음 고를 모델 — 출제·채점에는 각 회사의 중상급 범용 모델이 비용과 품질의 균형이 맞다 */
export function defaultModel(provider: ProviderId, models: ModelInfo[]): string {
  const find = (pattern: RegExp) => models.find((m) => pattern.test(m.id))?.id;
  const first = models[0]?.id ?? "";
  switch (provider) {
    case "anthropic":
      return find(/sonnet/) ?? first;
    case "openai":
      return find(/^gpt-\d+(\.\d+)?$/) ?? find(/^gpt-/) ?? first;
    case "gemini":
      return find(/^gemini-[\d.]+-pro$/) ?? find(/pro/) ?? find(/flash/) ?? first;
    case "openrouter":
      return find(/^anthropic\/claude-sonnet/) ?? find(/^openai\/gpt-/) ?? first;
  }
}
