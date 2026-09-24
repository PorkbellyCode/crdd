import Link from "next/link";
import { Suspense } from "react";
import ApiKeySettings from "@/components/ApiKeySettings";

export const metadata = { title: "설정 · CRDD" };

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 pt-10 pb-16">
      <p className="eyebrow mb-2.5">Settings</p>
      <h1 className="text-2xl font-bold tracking-tight">LLM 키 (BYOK)</h1>
      <p className="mt-2.5 mb-6 max-w-[64ch] text-sm text-muted-foreground">
        구조 분석은 LLM 없이 돌아갑니다. 퀴즈를 풀 때만 본인 키가 필요합니다.
      </p>
      <Suspense>
        <ApiKeySettings />
      </Suspense>
      <p className="mt-6 font-mono text-[11px] text-dim">
        <Link href="/" className="underline underline-offset-2">
          처음으로
        </Link>
      </p>
    </main>
  );
}
