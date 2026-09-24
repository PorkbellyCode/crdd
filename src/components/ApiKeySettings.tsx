"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LLM_KEY_HEADER } from "@/lib/llm/headers";
import {
  clearLlmSettings,
  loadLlmSettings,
  maskKey,
  saveLlmSettings,
  type LlmSettings,
} from "@/lib/llm/client";

interface ModelInfo {
  id: string;
  name: string;
}

/** 모델 목록은 최신순. 출제·채점에는 Sonnet 급이 비용과 품질의 균형이 맞다 */
function defaultModel(models: ModelInfo[]): string {
  return (models.find((m) => m.id.includes("sonnet")) ?? models[0])?.id ?? "";
}

export default function ApiKeySettings() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [saved, setSaved] = useState<LlmSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [model, setModel] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const current = loadLlmSettings();
    setSaved(current);
    if (current) setModel(current.model);
  }, []);

  async function verify(key: string) {
    setStatus("checking");
    setMessage(null);
    try {
      const response = await fetch("/api/llm/models", {
        method: "POST",
        headers: { [LLM_KEY_HEADER]: key },
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "키를 확인하지 못했습니다");
        return;
      }
      setModels(data.models);
      setModel((current) =>
        data.models.some((m: ModelInfo) => m.id === current) ? current : defaultModel(data.models),
      );
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage("서버에 연결하지 못했습니다");
    }
  }

  function save() {
    const key = apiKey.trim() || saved?.apiKey;
    if (!key || !model) return;
    const settings = { apiKey: key, model };
    if (!saveLlmSettings(settings)) {
      setStatus("error");
      setMessage("이 브라우저에 저장할 수 없습니다 (사생활 보호 모드인지 확인해 주세요)");
      return;
    }
    setSaved(settings);
    setApiKey("");
    setMessage("저장했습니다");
    if (next && next.startsWith("/")) router.push(next);
  }

  function remove() {
    clearLlmSettings();
    setSaved(null);
    setModels(null);
    setModel("");
    setMessage("이 브라우저에서 키를 지웠습니다");
  }

  return (
    <Card className="max-w-2xl gap-4 p-5">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Anthropic API 키</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          퀴즈 출제와 채점에 쓰입니다. 키는 <b className="text-foreground">이 브라우저에만</b>{" "}
          저장되고, 퀴즈 요청마다 함께 전송되어 그 요청 안에서만 쓰입니다. 서버는 키를 DB나
          로그에 남기지 않습니다. 비용은 키 소유자 계정에 청구됩니다.
        </p>
      </div>

      {saved ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 font-mono text-[11px]">
          <span className="text-muted-foreground">저장됨</span>
          <b className="font-medium">{maskKey(saved.apiKey)}</b>
          <span className="text-dim">· {saved.model}</span>
          <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={remove}>
            지우기
          </Button>
        </div>
      ) : null}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const key = apiKey.trim() || saved?.apiKey;
          if (key) void verify(key);
        }}
      >
        <Input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={saved ? "새 키로 바꾸려면 입력 (비우면 저장된 키로 모델만 다시 불러옴)" : "sk-ant-…"}
          aria-label="Anthropic API 키"
          className="min-w-0 flex-1 basis-64 font-mono"
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={status === "checking" || (!apiKey.trim() && !saved)}
        >
          {status === "checking" ? "확인 중…" : "키 확인"}
        </Button>
      </form>

      {models ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="model" className="eyebrow">
            모델
          </label>
          <select
            id="model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.id})
              </option>
            ))}
          </select>
          <Button type="button" onClick={save} disabled={!model}>
            저장{next ? "하고 돌아가기" : ""}
          </Button>
        </div>
      ) : null}

      {message ? (
        <p
          className={
            status === "error"
              ? "font-mono text-[11px] text-destructive"
              : "font-mono text-[11px] text-muted-foreground"
          }
        >
          {message}
        </p>
      ) : null}
    </Card>
  );
}
