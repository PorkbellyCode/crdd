"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useState } from "react";
import QuizRunner from "@/components/QuizRunner";
import type { QuizView } from "@/lib/quiz/types";

function QuizPageInner({ id }: { id: string }) {
  const from = useSearchParams().get("from");
  const returnTo = from && from.startsWith("/") ? from : null;
  const [quiz, setQuiz] = useState<QuizView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/quiz/${id}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!alive) return;
        if (response.ok) setQuiz(data);
        else setError(data.error ?? "퀴즈를 불러오지 못했습니다");
      })
      .catch(() => alive && setError("서버에 연결하지 못했습니다"));
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <main className="mx-auto max-w-3xl px-5 pt-10 pb-16">
      {error ? (
        <>
          <h1 className="text-2xl font-bold tracking-tight">{error}</h1>
          <p className="mt-4 font-mono text-[11px] text-dim">
            <Link href={returnTo ?? "/"} className="underline underline-offset-2">
              돌아가기
            </Link>
          </p>
        </>
      ) : quiz ? (
        <>
          <p className="eyebrow mb-2.5">Quiz · {quiz.commit}</p>
          <h1 className="mb-5 text-2xl font-bold tracking-tight">{quiz.conceptName}</h1>
          <QuizRunner initial={quiz} returnTo={returnTo} />
        </>
      ) : (
        <p className="font-mono text-[11px] text-dim">불러오는 중…</p>
      )}
    </main>
  );
}

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <QuizPageInner id={id} />
    </Suspense>
  );
}
