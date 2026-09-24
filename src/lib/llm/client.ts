/**
 * 브라우저 쪽 BYOK 보관소.
 *
 * 키는 이 브라우저의 localStorage에만 둔다. 서버 DB에는 저장하지 않는다.
 * 제공자마다 키를 따로 보관하고 하나를 "사용 중"으로 둔다 (형식은 settings.ts).
 * localStorage는 사생활 보호 모드 등에서 막히거나 비어 있을 수 있어 모든 접근을
 * try/catch로 감싼다 — 그 경우 키가 없는 것으로 취급한다.
 */
"use client";

import { useEffect, useState } from "react";
import { LLM_KEY_HEADER, LLM_MODEL_HEADER, LLM_PROVIDER_HEADER } from "./headers";
import { activeSettings, EMPTY_STORED, parseStored, type LlmSettings, type StoredLlm } from "./settings";

export type { LlmSettings, StoredLlm };

const STORAGE_KEY = "crdd.llm";
const EVENT = "crdd:llm-settings";

export function loadStored(): StoredLlm {
  try {
    return parseStored(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return EMPTY_STORED;
  }
}

export function saveStored(stored: StoredLlm): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

export function loadLlmSettings(): LlmSettings | null {
  return activeSettings(loadStored());
}

/** LLM이 필요한 요청에 붙일 헤더 */
export function llmHeaders(settings: LlmSettings): Record<string, string> {
  return {
    [LLM_PROVIDER_HEADER]: settings.provider,
    [LLM_KEY_HEADER]: settings.apiKey,
    [LLM_MODEL_HEADER]: settings.model,
  };
}

/** 화면 표시용 — 키 전체를 다시 보여주지 않는다 */
export function maskKey(apiKey: string): string {
  return apiKey.length <= 14 ? `${apiKey.slice(0, 4)}…` : `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}`;
}

/** 저장소 전체를 구독한다. 첫 렌더에서는 undefined(아직 모름) */
export function useStoredLlm(): StoredLlm | undefined {
  const [stored, setStored] = useState<StoredLlm | undefined>(undefined);
  useEffect(() => {
    const sync = () => setStored(loadStored());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return stored;
}

/** 사용 중인 설정. 첫 렌더에서는 undefined, 이후 null(없음) 또는 설정값 */
export function useLlmSettings(): LlmSettings | null | undefined {
  const stored = useStoredLlm();
  return stored === undefined ? undefined : activeSettings(stored);
}
