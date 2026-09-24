"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { maskKey, useLlmSettings } from "@/lib/llm/client";

const SHORT = { anthropic: "Claude", openai: "GPT", gemini: "Gemini", openrouter: "OpenRouter" } as const;

/** 상태 바의 API 키 표시 — 키는 브라우저에만 있어서 클라이언트에서만 알 수 있다 */
export default function KeyStatus() {
  const settings = useLlmSettings();
  return (
    <Link href="/settings" className="flex items-center gap-1.5 px-2 hover:bg-white/15" title="API 키 설정">
      <KeyRound className="size-3.5" aria-hidden />
      {settings === undefined ? "API 키" : settings ? `${SHORT[settings.provider]} ${maskKey(settings.apiKey)}` : "API 키 없음"}
    </Link>
  );
}
