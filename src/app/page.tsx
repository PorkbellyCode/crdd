import Link from "next/link";
import { auth, signIn } from "@/auth";
import AnalyzeForm from "@/components/AnalyzeForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STEPS = [
  {
    n: "01",
    title: "레포 연결",
    body: "public 레포의 구조와 의존성을 읽어 Knowledge Graph를 만듭니다.",
  },
  {
    n: "02",
    title: "프로젝트 퀴즈",
    body: "그래프·코드·커밋 메시지를 근거로 이 프로젝트에 대해 질문합니다.",
  },
  {
    n: "03",
    title: "부채 탕감",
    body: "설명하지 못한 영역을 학습하고 다시 검증합니다.",
  },
];

export default async function Home() {
  const session = await auth();
  async function signInToAnalyze() {
    "use server";
    await signIn("github", { redirectTo: "/" });
  }

  return (
    <main className="mx-auto max-w-5xl px-5 pt-10 pb-16">
      <p className="eyebrow mb-2.5">CRDD · Code Recognition Debt Deductor</p>
      <h1 className="text-[clamp(24px,3.4vw,34px)] leading-tight font-bold tracking-tight text-balance">
        AI가 짠 코드,
        <br />
        당신은 설명할 수 있나요?
      </h1>
      <p className="mt-2.5 max-w-[64ch] text-sm text-muted-foreground">
        레포를 연결하면 구조를 그래프로 그리고, 프로젝트 자체를 근거로 질문합니다. 설명하지
        못한 영역이 당신의 인지부채입니다.
      </p>

      <AnalyzeForm signedIn={Boolean(session?.user?.id)} signInAction={signInToAnalyze} />

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step) => (
          <Card key={step.n} className="gap-1.5 p-4">
            <span className="font-mono text-[11px] text-primary">{step.n}</span>
            <b className="text-sm font-semibold">{step.title}</b>
            <p className="text-xs leading-relaxed text-dim">{step.body}</p>
          </Card>
        ))}
      </div>

      <p className="mt-7">
        <Button nativeButton={false} render={<Link href="/demo" />} variant="secondary">
          porklog 데모 보기 →
        </Button>
      </p>
    </main>
  );
}
