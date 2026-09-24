"use client";

import Link from "next/link";
import { maskKey, useLlmSettings } from "@/lib/llm/client";

/** 상단 띠 — 홈·데모·키 상태. 키 상태는 브라우저에서만 알 수 있어 클라이언트 컴포넌트다 */
export default function SiteHeader() {
  const settings = useLlmSettings();
  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-2.5 font-mono text-[11px]">
        <Link href="/" className="font-semibold text-foreground">
          CRDD
        </Link>
        <Link href="/demo" className="text-muted-foreground hover:text-foreground">
          데모
        </Link>
        <Link
          href="/settings"
          className="ml-auto flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: settings ? "var(--debt-ok)" : "var(--debt-cold)" }}
          />
          {settings === undefined ? "API 키" : settings ? `API 키 ${maskKey(settings.apiKey)}` : "API 키 없음"}
        </Link>
      </nav>
    </header>
  );
}
