"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AnalyzeForm() {
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

  return (
    <form onSubmit={submit} style={{ maxWidth: 620, marginTop: 24 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          id="repo"
          name="repo"
          className="field"
          value={repo}
          onChange={(event) => setRepo(event.target.value)}
          placeholder="github.com/owner/repo"
          aria-label="분석할 public GitHub 레포 주소"
          disabled={pending}
        />
        <button className="btn primary" type="submit" disabled={pending || repo.trim() === ""}>
          {pending ? "시작하는 중…" : "분석 시작"}
        </button>
      </div>
      {error ? (
        <p className="note" style={{ color: "var(--crit)", marginTop: 8 }}>
          {error}
        </p>
      ) : null}
      <p className="note" style={{ marginTop: 10 }}>
        public 레포만 지원합니다 · 소스는 분석 직후 삭제하고 그래프와 파일 해시만 보관합니다
      </p>
    </form>
  );
}
