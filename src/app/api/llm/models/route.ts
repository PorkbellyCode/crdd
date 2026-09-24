import { NextResponse } from "next/server";
import { LlmError, listModels } from "@/lib/llm/anthropic";
import { readLlmKey } from "@/lib/llm/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 키 확인 — 모델 목록을 받아오면 유효한 키다. 키는 저장하지 않는다 */
export async function POST(request: Request) {
  try {
    const apiKey = readLlmKey(request);
    const models = await listModels(apiKey);
    return NextResponse.json({ models }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof LlmError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "키를 확인하지 못했습니다" }, { status: 500 });
  }
}
