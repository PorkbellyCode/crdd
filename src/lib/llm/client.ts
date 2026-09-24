/**
 * 브라우저 쪽 BYOK 보관소.
 *
 * 키는 이 브라우저의 localStorage에만 둔다. 서버 DB에는 저장하지 않는다.
 * localStorage는 사생활 보호 모드 등에서 막히거나 비어 있을 수 있어 모든 접근을
 * try/catch로 감싼다 — 그 경우 키가 없는 것으로 취급한다.
 */
"use client";

import { useEffect, useState } from "react";
import { LLM_KEY_HEADER, LLM_MODEL_HEADER } from "./headers";

const STORAGE_KEY = "crdd.llm";
const EVENT = "crdd:llm-settings";

export interface LlmSettings {
  apiKey: string;
  model: string;
}

export function loadLlmSettings(): LlmSettings | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    return parsed.apiKey && parsed.model ? { apiKey: parsed.apiKey, model: parsed.model } : null;
  } catch {
    return null;
  }
}

export function saveLlmSettings(settings: LlmSettings): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

export function clearLlmSettings() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 지울 수 없으면 원래 없던 것
  }
  window.dispatchEvent(new Event(EVENT));
}

/** LLM이 필요한 요청에 붙일 헤더 */
export function llmHeaders(settings: LlmSettings): Record<string, string> {
  return { [LLM_KEY_HEADER]: settings.apiKey, [LLM_MODEL_HEADER]: settings.model };
}

/** 화면 표시용 — 키 전체를 다시 보여주지 않는다 */
export function maskKey(apiKey: string): string {
  return apiKey.length <= 14 ? "sk-ant-…" : `${apiKey.slice(0, 10)}…${apiKey.slice(-4)}`;
}

/**
 * 현재 설정을 구독한다. 서버 렌더와 첫 렌더에서는 undefined(아직 모름),
 * 이후 null(없음) 또는 설정값.
 */
export function useLlmSettings(): LlmSettings | null | undefined {
  const [settings, setSettings] = useState<LlmSettings | null | undefined>(undefined);
  useEffect(() => {
    const sync = () => setSettings(loadLlmSettings());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return settings;
}
