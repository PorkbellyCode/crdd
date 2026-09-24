import { NextResponse } from "next/server";
import { LlmError } from "@/lib/llm/types";

export class QuizError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "QuizError";
  }
}

/** 라우트 공통 에러 응답. 알 수 없는 에러의 원문은 내보내지 않는다 (키가 섞일 여지를 없앤다) */
export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof LlmError || error instanceof QuizError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(fallback, error instanceof Error ? error.name : "unknown");
  return NextResponse.json({ error: fallback }, { status: 500 });
}
