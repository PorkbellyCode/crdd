"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AnswerOutcome } from "@/lib/crdd/types";
import { llmHeaders, useLlmSettings } from "@/lib/llm/client";
import type { QuizView } from "@/lib/quiz/types";

const OUTCOME_LABEL: Record<AnswerOutcome, string> = {
  first_try: "첫 시도 정답",
  after_hint: "힌트 후 정답",
  after_explanation: "설명 후 정답",
  unresolved: "미해결",
};

const OUTCOME_COLOR: Record<AnswerOutcome, string> = {
  first_try: "var(--debt-ok)",
  after_hint: "var(--debt-warn)",
  after_explanation: "var(--debt-warn)",
  unresolved: "var(--debt-crit)",
};

const STAGE_PROMPT = {
  first: "답변",
  hint: "힌트를 보고 다시 답해 보세요",
  explanation: "설명을 읽었다면, 이제 자기 말로 다시 설명해 보세요",
} as const;

function CodeExcerpt({ excerpt }: { excerpt: QuizView["questions"][number]["codeExcerpt"] }) {
  return (
    <figure className="mt-3 overflow-hidden rounded-md border border-border">
      <figcaption className="border-b border-border bg-secondary px-3 py-1.5 font-mono text-[10.5px] text-muted-foreground">
        {excerpt.file} · L{excerpt.startLine}–{excerpt.endLine}
      </figcaption>
      <pre className="max-h-96 overflow-auto bg-background p-3 font-mono text-[12px] leading-relaxed">
        <code>{excerpt.code}</code>
      </pre>
    </figure>
  );
}

function Note({ title, children, tone }: { title: string; children: React.ReactNode; tone: "hint" | "explain" | "feedback" }) {
  const color = tone === "hint" ? "var(--debt-warn)" : tone === "explain" ? "var(--primary)" : "var(--dim)";
  return (
    <div className="mt-3 rounded-md border-l-2 bg-secondary/60 px-3 py-2" style={{ borderColor: color }}>
      <div className="eyebrow mb-1 text-[9.5px]" style={{ color }}>
        {title}
      </div>
      <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{children}</div>
    </div>
  );
}

export default function QuizRunner({ initial, returnTo }: { initial: QuizView; returnTo: string | null }) {
  const settings = useLlmSettings();
  const [quiz, setQuiz] = useState(initial);
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState<"answer" | "giveup" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const index = quiz.current;
  const active = index >= 0 ? quiz.questions[index] : null;

  async function submit(giveUp: boolean) {
    if (!settings && !giveUp) {
      setError("API 키가 없습니다. 설정에서 키를 넣어 주세요.");
      return;
    }
    setPending(giveUp ? "giveup" : "answer");
    setError(null);
    try {
      const response = await fetch(`/api/quiz/${quiz.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(settings ? llmHeaders(settings) : {}) },
        body: JSON.stringify({ index, answer: giveUp ? "" : answer, giveUp }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "채점하지 못했습니다");
      } else {
        setQuiz(data);
        setAnswer("");
      }
    } catch {
      setError("서버에 연결하지 못했습니다");
    }
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-3.5">
      {quiz.questions.map((question, i) => {
        if (i > index && index !== -1) return null;
        const isActive = i === index;
        const lastAttempt = question.attempts.at(-1);
        return (
          <Card key={i} className="gap-0 p-4">
            <p className="eyebrow">
              Quiz — {quiz.conceptName} ({question.level}) · {i + 1}/{quiz.total}
            </p>
            <h2 className="mt-2 text-[15px] leading-relaxed font-semibold">{question.question}</h2>
            <CodeExcerpt excerpt={question.codeExcerpt} />

            {question.attempts.map((attempt, n) => (
              <div key={n} className="mt-3">
                <p className="font-mono text-[10.5px] text-dim">
                  내 답변 {n + 1}
                  {attempt.passed ? " · 통과" : ""}
                </p>
                <p className="mt-1 text-[13px] whitespace-pre-wrap text-muted-foreground">
                  {attempt.answer || "(모르겠어요)"}
                </p>
                {attempt.feedback && attempt.answer ? (
                  <Note title="채점" tone="feedback">
                    {attempt.feedback}
                  </Note>
                ) : null}
              </div>
            ))}

            {question.hint && (isActive || question.outcome) ? (
              <Note title="놓친 포인트" tone="hint">
                {question.hint}
              </Note>
            ) : null}
            {question.explanation && (question.stage === "explanation" || question.outcome) ? (
              <Note title="설명" tone="explain">
                {question.explanation}
              </Note>
            ) : null}

            {question.outcome ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5 font-mono text-[10px]">
                  <span className="size-2 rounded-full" style={{ background: OUTCOME_COLOR[question.outcome] }} />
                  {OUTCOME_LABEL[question.outcome]}
                </Badge>
                {question.rubric ? (
                  <span className="font-mono text-[10.5px] text-dim">
                    핵심 포인트: {question.rubric.join(" · ")}
                  </span>
                ) : null}
              </div>
            ) : null}

            {isActive && active ? (
              <form
                className="mt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit(false);
                }}
              >
                <label htmlFor="answer" className="eyebrow mb-1.5 block text-[10px]">
                  {STAGE_PROMPT[question.stage]}
                  {lastAttempt ? ` · ${question.attempts.length + 1}번째 시도` : ""}
                </label>
                <Textarea
                  id="answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="3~6문장으로, 코드에 근거해서 설명해 보세요"
                  disabled={pending !== null}
                  maxLength={4000}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={pending !== null || !answer.trim()}>
                    {pending === "answer" ? "채점 중…" : "제출"}
                  </Button>
                  <Button type="button" variant="secondary" disabled={pending !== null} onClick={() => void submit(true)}>
                    {pending === "giveup" ? "넘어가는 중…" : "모르겠어요"}
                  </Button>
                  <span className="ml-auto font-mono text-[10px] text-dim">
                    첫 시도 1.0 · 힌트 후 0.6 · 설명 후 0.3
                  </span>
                </div>
                {error ? <p className="mt-2 font-mono text-[11px] text-destructive">{error}</p> : null}
              </form>
            ) : null}
          </Card>
        );
      })}

      {quiz.status === "done" ? (
        <Card className="gap-2 p-4">
          <p className="eyebrow">Done</p>
          <h2 className="text-base font-semibold">퀴즈를 마쳤습니다</h2>
          {quiz.result ? (
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-lg text-muted-foreground">
                {quiz.result.debtBefore === null ? "미측정" : `${quiz.result.debtBefore}%`}
              </span>
              <span className="text-dim">→</span>
              <b className="text-3xl font-semibold tracking-tight tabular">{quiz.result.debtAfter}%</b>
              <span className="eyebrow">부채비율</span>
            </div>
          ) : null}
          <p className="font-mono text-[11px] text-muted-foreground">
            {quiz.questions.map((q) => (q.outcome ? OUTCOME_LABEL[q.outcome] : "—")).join(" · ")}
          </p>
          <p className="text-xs leading-relaxed text-dim">
            점수는 이 개념에서 푼 모든 퀴즈를 합산하고, 확인되지 않은 가상의 문항 4개를 얹어
            계산합니다. 한 번 잘 풀었다고 부채가 0이 되지는 않습니다.
          </p>
          {returnTo ? (
            <Button nativeButton={false} render={<Link href={returnTo} />} variant="secondary" className="mt-2 self-start">
              지도로 돌아가기
            </Button>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
