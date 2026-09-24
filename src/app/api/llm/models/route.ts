import { NextResponse } from "next/server";
import { defaultModel } from "@/lib/llm/providers";
import { readLlmKey, readLlmProvider } from "@/lib/llm/request";
import { llmClient } from "@/lib/llm/server";
import { LlmError } from "@/lib/llm/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 키 확인 — 모델 목록을 받아오면 유효한 키다. 키는 저장하지 않는다 */
export async function POST(request: Request) {
  try {
    const provider = readLlmProvider(request);
    const apiKey = readLlmKey(request, provider);
    const models = await llmClient(provider).listModels(apiKey);
    if (models.length === 0) {
      throw new LlmError("이 키로 쓸 수 있는 대화 모델을 찾지 못했습니다.", 400);
    }
    return NextResponse.json(
      { models, defaultModel: defaultModel(provider, models) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof LlmError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "키를 확인하지 못했습니다" }, { status: 500 });
  }
}
