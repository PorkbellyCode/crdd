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

const KIND_LABEL = {
  flow: "흐름을 설명할 수 있는가",
  why: "설계 이유를 설명할 수 있는가",
  impact: "바꾸면 어디가 영향을 받는지 아는가",
} as const;

const LEVEL_LABEL = {
  awareness: "역할을 아는가",
  understanding: "동작을 설명할 수 있는가",
  reasoning: "설계 이유를 설명할 수 있는가",
} as const;

const SUBMIT_TIMEOUT_MS = 65_000; // 서버 maxDuration(60초)보다 조금 길게

const NO_KEY = (
  <>
    API 키가 없습니다.{" "}
    <Link href="/settings" className="underline underline-offset-2">
      설정에서 키를 넣어 주세요
    </Link>
    .
  </>
);

const GIVE_UP_LABEL = { first: "힌트 보기", hint: "설명 보기", explanation: "포기하고 넘어가기" } as const;
const SCORE_NOW = {
  first: "지금 맞히면 1.0점",
  hint: "지금 맞히면 0.6점",
  explanation: "지금 맞히면 0.3점",
} as const;

const STAGE_PROMPT = {
  first: "답변",
  hint: "힌트를 보고 다시 답해 보세요",
  explanation: "설명을 읽었다면, 이제 자기 말로 다시 설명해 보세요",
} as const;

function CodeExcerpt({ excerpt }: { excerpt: QuizView["questions"][number]["codeExcerpt"] }) {
  return (
    <figure className="mt-3 overflow-hidden rounded-lg border border-border">
      <figcaption className="flex justify-between border-b border-border bg-chrome px-3 py-1.5 text-xs">
        <span className="text-foreground">{excerpt.file}</span>
        <span className="text-dim">
          L{excerpt.startLine}–{excerpt.endLine}
        </span>
      </figcaption>
      <pre className="max-h-96 overflow-auto bg-editor text-[12.5px] leading-[1.7]">
        {excerpt.code.split("\n").map((line, i) => (
          <div key={i} className="flex">
            <span className="w-11 shrink-0 bg-gutter pr-3 text-right text-dim select-none">
              {excerpt.startLine + i}
            </span>
            <code className="pr-4 pl-3">{line || " "}</code>
          </div>
        ))}
      </pre>
    </figure>
  );
}

function Note({ title, children, tone }: { title: string; children: React.ReactNode; tone: "hint" | "explain" | "feedback" }) {
  const color = tone === "hint" ? "var(--debt-warn)" : tone === "explain" ? "var(--primary)" : "var(--dim)";
  return (
    <div className="mt-3 rounded-md border-l-2 bg-secondary/60 px-3 py-2" style={{ borderColor: color }}>
      <div className="mb-1 text-xs font-bold" style={{ color }}>
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
  const [error, setError] = useState<React.ReactNode>(null);

  const index = quiz.current;
  const active = index >= 0 ? quiz.questions[index] : null;

  async function submit(giveUp: boolean) {
    if (!active) return;
    // 포기는 서버가 LLM을 부르지 않으므로 키와 무관하게 허용한다. 키 검사는 일반 답변만
    if (!giveUp) {
      if (settings === undefined) return; // 키 확인 중 — 버튼도 잠겨 있다
      if (settings === null) {
        setError(NO_KEY);
        return;
      }
    }
    if (giveUp && active.stage === "explanation" && !window.confirm("이 문항을 포기하면 0점으로 끝납니다. 계속할까요?")) {
      return;
    }
    setPending(giveUp ? "giveup" : "answer");
    setError(null);
    const sentAttempts = active.attempts.length;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
    try {
      const response = await fetch(`/api/quiz/${quiz.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(settings ? llmHeaders(settings) : {}) },
        body: JSON.stringify({
          index,
          attempts: sentAttempts,
          stage: active.stage,
          answer: giveUp ? "" : answer,
          giveUp,
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        // 서버가 최신 상태를 알려 주면 그 자리에서 맞춘다. 사용자가 쓴 답은 지우지 않는다
        if (data.quiz) setQuiz(data.quiz);
        setError(data.error ?? "채점하지 못했습니다");
      } else {
        setQuiz(data);
        setAnswer("");
      }
    } catch {
      // 응답을 못 받았어도 서버는 처리를 끝냈을 수 있다 — 실제 상태로 맞춘다
      try {
        const response = await fetch(`/api/quiz/${quiz.id}`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const latest: QuizView = await response.json();
        setQuiz(latest);
        const advanced =
          latest.current !== index || (latest.questions[index]?.attempts.length ?? 0) !== sentAttempts;
        if (advanced) setAnswer("");
        setError(
          advanced
            ? "응답을 받지 못했지만 제출은 처리됐습니다. 최신 상태로 맞췄습니다."
            : "응답을 받지 못했습니다. 답은 그대로 두었으니 다시 제출해 주세요.",
        );
      } catch {
        setError("서버에 연결하지 못했습니다");
      }
    } finally {
      clearTimeout(timer);
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
            <p className="flex flex-wrap gap-x-3 text-xs text-dim">
              <span>
                문항 {i + 1}/{quiz.total}
              </span>
              <span>{question.kind ? KIND_LABEL[question.kind] : LEVEL_LABEL[question.level]}</span>
            </p>
            <h2 className="mt-2 text-[15px] leading-relaxed font-semibold">{question.question}</h2>
            <CodeExcerpt excerpt={question.codeExcerpt} />

            {/* 시간 순서대로: 답변 1 → 놓친 포인트 → 답변 2 → 설명 → 답변 3.
                힌트는 첫 답변 뒤에, 설명은 두 번째 답변 뒤에 열린 것이므로 그 자리에 둔다 */}
            {question.attempts.map((attempt, n) => (
              <div key={n} className="mt-3">
                <p className="text-xs text-dim">
                  내 답변 {n + 1}
                  {attempt.passed ? ", 통과" : ""}
                </p>
                <p className="mt-1 text-[13px] whitespace-pre-wrap text-muted-foreground">
                  {attempt.answer || "(모르겠어요)"}
                </p>
                {attempt.feedback && attempt.answer ? (
                  <Note title="채점" tone="feedback">
                    {attempt.feedback}
                  </Note>
                ) : null}
                {n === 0 && question.hint && !attempt.passed ? (
                  <Note title="놓친 포인트" tone="hint">
                    {question.hint}
                  </Note>
                ) : null}
                {n === 1 && question.explanation && !attempt.passed ? (
                  <Note title="설명" tone="explain">
                    {question.explanation}
                  </Note>
                ) : null}
              </div>
            ))}

            {/* 설명 단계 전에 끝난 문항(첫 시도·힌트 후 정답)은 마지막에 참고용 설명 */}
            {question.explanation && question.outcome && question.attempts.length < 2 ? (
              <Note title="설명" tone="explain">
                {question.explanation}
              </Note>
            ) : null}
            {question.explanation &&
            question.outcome &&
            question.attempts.length === 2 &&
            question.attempts[1]!.passed ? (
              <Note title="설명" tone="explain">
                {question.explanation}
              </Note>
            ) : null}

            {question.outcome ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5 text-[11px]">
                  <span className="size-2 rounded-full" style={{ background: OUTCOME_COLOR[question.outcome] }} />
                  {OUTCOME_LABEL[question.outcome]}
                </Badge>
                {question.rubric ? (
                  <ul className="mt-1 w-full list-disc pl-5 text-xs text-muted-foreground">
                    {question.rubric.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
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
                <label htmlFor="answer" className="mb-1.5 block text-xs text-muted-foreground">
                  {STAGE_PROMPT[question.stage]}
                  {lastAttempt ? ` (${question.attempts.length + 1}번째 시도)` : ""}
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
                  <Button type="submit" disabled={pending !== null || settings === undefined || !answer.trim()}>
                    {pending === "answer" ? "채점 중…" : settings === undefined ? "확인 중…" : "제출"}
                  </Button>
                  <Button type="button" variant="secondary" disabled={pending !== null} onClick={() => void submit(true)}>
                    {pending === "giveup" ? "처리 중…" : GIVE_UP_LABEL[question.stage]}
                  </Button>
                  <span className="ml-auto text-[11px] text-dim">
                    {SCORE_NOW[question.stage]}
                  </span>
                </div>
                {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
              </form>
            ) : null}
          </Card>
        );
      })}

      {quiz.status === "done" ? (
        <Card className="gap-2 p-4">
          <h2 className="text-base font-semibold">퀴즈를 마쳤습니다</h2>
          {quiz.result ? (
            <div className="flex items-baseline gap-2">
              <span className="text-lg text-muted-foreground">
                {quiz.result.debtBefore === null ? "미측정" : `${quiz.result.debtBefore}%`}
              </span>
              <span className="text-dim" aria-label="에서">&gt;</span>
              <b className="text-3xl font-bold tracking-tight tabular">{quiz.result.debtAfter}%</b>
              <span className="text-xs text-muted-foreground">부채비율</span>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {quiz.questions.map((q) => (q.outcome ? OUTCOME_LABEL[q.outcome] : "—")).join(", ")}
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
