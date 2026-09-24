"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AnalyzeForm({ signedIn, signInAction }: { signedIn: boolean; signInAction: () => Promise<void> }) {
  const router = useRouter();
  const [repo, setRepo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "분석을 시작할 수 없습니다");
        setPending(false);
        return;
      }
      router.push(`/a/${data.id}`);
    } catch {
      setError("서버에 연결하지 못했습니다");
      setPending(false);
    }
  }

  if (!signedIn) {
    return (
      <form action={signInAction} className="mt-6 max-w-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">GitHub로 로그인하고 분석하기</Button>
          <span className="font-mono text-[11px] text-dim">
            레포 분석은 로그인이 필요합니다 · 레포 권한은 요청하지 않습니다
          </span>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 max-w-2xl">
      <div className="flex flex-wrap gap-2">
        <Input
          id="repo"
          name="repo"
          value={repo}
          onChange={(event) => setRepo(event.target.value)}
          placeholder="github.com/owner/repo"
          aria-label="분석할 public GitHub 레포 주소"
          disabled={pending}
          className="min-w-0 flex-1 basis-64 font-mono"
        />
        <Button type="submit" disabled={pending || repo.trim() === ""}>
          {pending ? "시작하는 중…" : "분석 시작"}
        </Button>
      </div>
      {error ? <p className="mt-2 font-mono text-[11px] text-destructive">{error}</p> : null}
      <p className="mt-2.5 font-mono text-[11px] text-dim">
        public 레포만 지원합니다 · 소스는 분석 직후 삭제하고 그래프와 파일 해시만 보관합니다
      </p>
    </form>
  );
}
