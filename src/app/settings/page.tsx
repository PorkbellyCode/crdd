import { Suspense } from "react";
import ApiKeySettings from "@/components/ApiKeySettings";

export const metadata = { title: "API 키 | CRDD" };

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 pt-10 pb-16">
      <h1 className="text-2xl font-bold tracking-tight">API 키</h1>
      <p className="mt-2.5 mb-6 max-w-[64ch] text-sm text-muted-foreground">
        구조 분석은 LLM 없이 돌아갑니다. 퀴즈를 풀 때만 본인 키가 필요합니다. Anthropic, OpenAI, Google, OpenRouter 키를 쓸 수 있습니다.
      </p>
      <Suspense>
        <ApiKeySettings />
      </Suspense>
    </main>
  );
}
