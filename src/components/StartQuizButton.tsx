"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { llmHeaders, useLlmSettings } from "@/lib/llm/client";

/** 개념 상세 패널의 "이 개념 퀴즈 풀기". 키가 없으면 설정으로 보낸다 */
export default function StartQuizButton({
  analysisId,
  communityId,
  returnTo,
}: {
  analysisId: string;
  communityId: number;
  /** 퀴즈가 끝나면 돌아올 분석 화면 경로 */
  returnTo: string;
}) {
  const router = useRouter();
  const settings = useLlmSettings();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (settings === undefined) return null;

  if (!settings) {
    return (
      <div className="mt-3.5">
        <Button nativeButton={false} render={<Link href={`/settings?next=${encodeURIComponent(returnTo)}`} />} size="sm" className="w-full">
          API 키를 넣고 퀴즈 풀기
        </Button>
        <p className="mt-1.5 font-mono text-[10px] text-dim">퀴즈 출제·채점에 본인 Anthropic 키가 필요합니다</p>
      </div>
    );
  }

  async function start() {
    if (!settings) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "content-type": "application/json", ...llmHeaders(settings) },
        body: JSON.stringify({ analysisId, communityId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "문항을 만들지 못했습니다");
        setPending(false);
        return;
      }
      router.push(`/quiz/${data.id}?from=${encodeURIComponent(returnTo)}`);
    } catch {
      setError("서버에 연결하지 못했습니다");
      setPending(false);
    }
  }

  return (
    <div className="mt-3.5">
      <Button type="button" size="sm" className="w-full" disabled={pending} onClick={start}>
        {pending ? "코드를 읽고 문항 만드는 중…" : "이 개념 퀴즈 풀기"}
      </Button>
      <p className="mt-1.5 font-mono text-[10px] text-dim">
        {pending ? "보통 20~40초 걸립니다" : `3문항 · ${settings.model}`}
      </p>
      {error ? <p className="mt-1.5 font-mono text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
