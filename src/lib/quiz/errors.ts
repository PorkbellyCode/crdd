import { NextResponse } from "next/server";
import { LlmError } from "@/lib/llm/types";
import type { QuizView } from "./types";

export class QuizError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /**
     * 함께 내보낼 최신 화면 상태. 경합(409)처럼 "화면이 서버와 다르다"는 에러에 담아,
     * 클라이언트가 재조회 없이 그 자리에서 자기 state를 덮어쓸 수 있게 한다.
     */
    readonly quiz?: QuizView,
  ) {
    super(message);
    this.name = "QuizError";
  }
}

/** 라우트 공통 에러 응답. 알 수 없는 에러의 원문은 내보내지 않는다 (키가 섞일 여지를 없앤다) */
export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof QuizError) {
    // quiz는 있을 때만 넣는다 — 기존 { error } 형태를 그대로 쓰는 쪽과 충돌하지 않게
    return NextResponse.json(
      error.quiz ? { error: error.message, quiz: error.quiz } : { error: error.message },
      { status: error.status },
    );
  }
  if (error instanceof LlmError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  // 원인 추적용: 이름·message·스택 첫 프레임만 남긴다 (LLM 응답 원문이나 키가 섞이지 않게 cause 등은 제외)
  if (error instanceof Error) {
    const frame = error.stack?.split("\n").find((line) => line.trim().startsWith("at "))?.trim();
    // SyntaxError는 message에 응답 본문 조각이 들어갈 수 있어 뺀다. 그 외는 첫 줄만 남긴다 (drizzle은 둘째 줄부터 params가 붙는다)
    const message = error instanceof SyntaxError ? "" : (error.message.split("\n")[0] ?? "").slice(0, 200);
    console.error(fallback, error.name, message, frame ?? "");
  } else {
    console.error(fallback, "unknown");
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}
