"use client";

import { ExternalLink } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maskKey, saveStored, useStoredLlm } from "@/lib/llm/client";
import { LLM_KEY_HEADER, LLM_PROVIDER_HEADER } from "@/lib/llm/headers";
import { PROVIDER_ORDER, PROVIDERS, type ModelInfo, type ProviderId } from "@/lib/llm/providers";
import { withActive, withEntry, withoutEntry } from "@/lib/llm/settings";

const selectClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-editor px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function ApiKeySettings() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const stored = useStoredLlm();

  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [model, setModel] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  // 처음 열 때는 사용 중인 제공자를 보여준다
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!stored || initialized) return;
    if (stored.active) setProvider(stored.active);
    setInitialized(true);
  }, [stored, initialized]);

  const info = PROVIDERS[provider];
  const saved = stored?.entries[provider];
  const isActive = stored?.active === provider;

  function changeProvider(next: ProviderId) {
    setProvider(next);
    setApiKey("");
    setModels(null);
    setModel("");
    setStatus("idle");
    setMessage(null);
  }

  async function verify(key: string) {
    setStatus("checking");
    setMessage(null);
    try {
      const response = await fetch("/api/llm/models", {
        method: "POST",
        headers: { [LLM_PROVIDER_HEADER]: provider, [LLM_KEY_HEADER]: key },
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "키를 확인하지 못했습니다");
        return;
      }
      const list = data.models as ModelInfo[];
      setModels(list);
      setModel(saved && list.some((m) => m.id === saved.model) ? saved.model : data.defaultModel);
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage("서버에 연결하지 못했습니다");
    }
  }

  function save() {
    if (!stored) return;
    const key = apiKey.trim() || saved?.apiKey;
    if (!key || !model) return;
    if (!saveStored(withEntry(stored, provider, { apiKey: key, model }))) {
      setStatus("error");
      setMessage("이 브라우저에 저장할 수 없습니다. 사생활 보호 모드인지 확인해 주세요.");
      return;
    }
    setApiKey("");
    setModels(null);
    setMessage(`${info.label} 키를 저장하고 사용 중으로 바꿨습니다.`);
    if (next && next.startsWith("/")) router.push(next);
  }

  function use() {
    if (!stored) return;
    saveStored(withActive(stored, provider));
    setMessage(`${info.label} 키를 사용합니다.`);
    if (next && next.startsWith("/")) router.push(next);
  }

  function remove() {
    if (!stored) return;
    saveStored(withoutEntry(stored, provider));
    setModels(null);
    setMessage(`이 브라우저에서 ${info.label} 키를 지웠습니다.`);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5 rounded-lg border border-border bg-editor p-5">
      <p className="text-xs leading-relaxed text-muted-foreground">
        퀴즈 출제와 채점에 쓰입니다. 키는 <b className="text-foreground">이 브라우저에만</b> 저장되고,
        퀴즈 요청마다 함께 전송되어 그 요청 안에서만 쓰입니다. 서버는 키를 DB나 로그에 남기지 않습니다.
        비용은 키 소유자 계정에 청구됩니다.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="provider" className="text-xs text-muted-foreground">
          제공자
        </label>
        <select
          id="provider"
          value={provider}
          onChange={(event) => changeProvider(event.target.value as ProviderId)}
          className={selectClass}
        >
          {PROVIDER_ORDER.map((id) => (
            <option key={id} value={id}>
              {PROVIDERS[id].label}
              {stored?.active === id ? " (사용 중)" : stored?.entries[id] ? " (저장됨)" : ""}
            </option>
          ))}
        </select>
        {provider === "openrouter" ? (
          <p className="text-[11px] text-dim">키 하나로 Claude, GPT, Gemini 등 여러 회사 모델을 고를 수 있습니다.</p>
        ) : null}
      </div>

      {saved ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs">
          <span className="text-muted-foreground">저장된 키</span>
          <b className="font-medium">{maskKey(saved.apiKey)}</b>
          <span className="text-dim">{saved.model}</span>
          <span className="ml-auto flex gap-1">
            {isActive ? (
              <span className="px-2 py-1 text-[11px] text-primary">사용 중</span>
            ) : (
              <Button type="button" size="sm" variant="secondary" onClick={use}>
                이 키 사용
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={remove}>
              지우기
            </Button>
          </span>
        </div>
      ) : null}

      <form
        className="flex flex-col gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          const key = apiKey.trim() || saved?.apiKey;
          if (key) void verify(key);
        }}
      >
        <label htmlFor="api-key" className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{saved ? "새 키로 바꾸기" : "API 키"}</span>
          <a
            href={info.keyUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-primary underline-offset-4 hover:underline"
          >
            키 만들기
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={saved ? "비워 두면 저장된 키로 모델 목록을 다시 불러옵니다" : info.keyPlaceholder}
            className="h-9 min-w-0 flex-1 basis-64 bg-editor"
          />
          <Button
            type="submit"
            variant="secondary"
            className="h-9"
            disabled={status === "checking" || (!apiKey.trim() && !saved)}
          >
            {status === "checking" ? "확인하는 중…" : "키 확인"}
          </Button>
        </div>
      </form>

      {models ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="model" className="text-xs text-muted-foreground">
            모델 ({models.length}개)
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              id="model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className={`${selectClass} flex-1 basis-64`}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name === m.id ? m.id : `${m.name} (${m.id})`}
                </option>
              ))}
            </select>
            <Button type="button" className="h-9" onClick={save} disabled={!model}>
              {next ? "저장하고 돌아가기" : "저장"}
            </Button>
          </div>
          <p className="text-[11px] text-dim">
            출제와 채점은 도구 호출(구조화된 응답)을 씁니다. 작은 모델은 문항 품질이 떨어질 수 있습니다.
          </p>
        </div>
      ) : null}

      {message ? (
        <p className={status === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{message}</p>
      ) : null}
    </div>
  );
}
