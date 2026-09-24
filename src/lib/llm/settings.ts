/**
 * 브라우저 저장 형식 (순수 함수 — 테스트 대상).
 *
 * 제공자마다 키를 따로 보관하고, 그중 하나를 "사용 중"으로 둔다. 제공자를 바꿔도
 * 다른 제공자의 키가 지워지지 않는다.
 *
 *   v2: { v: 2, active: "openai", entries: { anthropic: {apiKey, model}, openai: {...} } }
 *   v1: { apiKey, model }  ← 제공자 선택이 생기기 전. Anthropic 키로 옮긴다
 */
import { isProviderId, type ProviderId } from "./providers";

export interface LlmEntry {
  apiKey: string;
  model: string;
}

export interface LlmSettings extends LlmEntry {
  provider: ProviderId;
}

export interface StoredLlm {
  v: 2;
  active: ProviderId | null;
  entries: Partial<Record<ProviderId, LlmEntry>>;
}

export const EMPTY_STORED: StoredLlm = { v: 2, active: null, entries: {} };

function isEntry(value: unknown): value is LlmEntry {
  const entry = value as LlmEntry | null;
  return Boolean(entry && typeof entry.apiKey === "string" && entry.apiKey && typeof entry.model === "string" && entry.model);
}

export function parseStored(raw: string | null): StoredLlm {
  if (!raw) return EMPTY_STORED;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_STORED;
  }
  const value = parsed as Record<string, unknown>;

  if (value?.v === 2) {
    const entries: StoredLlm["entries"] = {};
    for (const [provider, entry] of Object.entries((value.entries as object) ?? {})) {
      if (isProviderId(provider) && isEntry(entry)) entries[provider] = { apiKey: entry.apiKey, model: entry.model };
    }
    const active = isProviderId(value.active) && entries[value.active] ? value.active : null;
    return { v: 2, active, entries };
  }

  // v1 → Anthropic
  if (isEntry(value)) {
    return { v: 2, active: "anthropic", entries: { anthropic: { apiKey: value.apiKey, model: value.model } } };
  }
  return EMPTY_STORED;
}

export function activeSettings(stored: StoredLlm): LlmSettings | null {
  if (!stored.active) return null;
  const entry = stored.entries[stored.active];
  return entry ? { provider: stored.active, ...entry } : null;
}

export function withEntry(stored: StoredLlm, provider: ProviderId, entry: LlmEntry): StoredLlm {
  return { v: 2, active: provider, entries: { ...stored.entries, [provider]: entry } };
}

export function withoutEntry(stored: StoredLlm, provider: ProviderId): StoredLlm {
  const entries = { ...stored.entries };
  delete entries[provider];
  // 사용 중이던 키를 지우면 남은 키 중 첫 번째를 사용 중으로
  const active =
    stored.active === provider ? ((Object.keys(entries)[0] as ProviderId | undefined) ?? null) : stored.active;
  return { v: 2, active, entries };
}

export function withActive(stored: StoredLlm, provider: ProviderId): StoredLlm {
  return stored.entries[provider] ? { ...stored, active: provider } : stored;
}
