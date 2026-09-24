import Link from "next/link";
import { auth, signIn } from "@/auth";
import AnalyzeForm from "@/components/AnalyzeForm";
import CoverageSnippet from "@/components/CoverageSnippet";

const STEPS = [
  {
    title: "레포를 연결합니다",
    body: "public 레포의 import·호출 관계를 읽어 코드를 개념 단위로 묶습니다. LLM은 쓰지 않습니다.",
  },
  {
    title: "그 코드로 질문합니다",
    body: "개념 하나를 고르면 실제 코드를 근거로 세 문항을 냅니다. 틀리면 힌트, 그다음 설명이 열립니다.",
  },
  {
    title: "설명하지 못한 곳이 부채로 남습니다",
    body: "첫 시도 정답과 설명을 보고 맞힌 답은 점수가 다릅니다. 지도에서 부채가 높은 곳부터 갚아 나갑니다.",
  },
];

export default async function Home() {
  const session = await auth();
  async function signInToAnalyze() {
    "use server";
    await signIn("github", { redirectTo: "/" });
  }

  return (
    <main className="mx-auto max-w-6xl px-5 pt-12 pb-20">
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div>
          <h1 className="text-[clamp(28px,4.2vw,40px)] leading-[1.2] font-bold tracking-[-0.02em] text-balance">
            AI가 짠 코드,
            <br />
            설명할 수 있나요?
          </h1>
          <p className="mt-4 max-w-[46ch] text-muted-foreground">
            테스트 커버리지가 실행된 줄을 보여주듯, CRDD는 내가 설명할 수 있는 코드를 보여줍니다.
            레포를 연결하고 퀴즈를 풀면 설명하지 못한 부분이 부채비율로 드러납니다.
          </p>
          <AnalyzeForm signedIn={Boolean(session?.user?.id)} signInAction={signInToAnalyze} />
          <p className="mt-4 text-xs text-dim">
            먼저 둘러보려면{" "}
            <Link href="/demo" className="text-primary underline underline-offset-4">
              porklog 데모
            </Link>
            를 열어 보세요. 로그인 없이 볼 수 있습니다.
          </p>
        </div>

        <CoverageSnippet />
      </section>

      <section className="mt-20 max-w-3xl" aria-labelledby="how">
        <h2 id="how" className="text-base font-bold">
          동작 방식
        </h2>
        <ol className="mt-4 border-l border-border">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative pb-6 pl-6 last:pb-0">
              <span
                className="absolute top-0 -left-[11px] grid size-[21px] place-items-center rounded-full border border-border bg-background text-[11px] text-muted-foreground"
                aria-hidden
              >
                {i + 1}
              </span>
              <h3 className="font-bold">{step.title}</h3>
              <p className="mt-1 max-w-[64ch] text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
