"use client";

import Link from "next/link";
import { maskKey, useLlmSettings } from "@/lib/llm/client";

/** API 키 상태 — 키는 브라우저에만 있어서 클라이언트에서만 알 수 있다 */
export default function KeyStatus() {
  const settings = useLlmSettings();
  return (
    <Link href="/settings" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
      <span
        className="size-1.5 rounded-full"
        style={{ background: settings ? "var(--debt-ok)" : "var(--debt-cold)" }}
      />
      {settings === undefined ? "API 키" : settings ? `API 키 ${maskKey(settings.apiKey)}` : "API 키 없음"}
    </Link>
  );
}
