import Link from "next/link";
import { auth, signIn } from "@/auth";
import { Stat, StatStrip } from "@/components/Stat";
import { Card } from "@/components/ui/card";
import { getUserProjects } from "@/db/repo";
import { overallDebtRatio } from "@/lib/crdd/score";

export const metadata = { title: "내 프로젝트 · CRDD" };

function when(sec: number): string {
  return new Date(sec * 1000).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" });
}

export default async function MyProjectsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <main className="mx-auto max-w-5xl px-5 pt-10 pb-16">
        <p className="eyebrow mb-2.5">My projects</p>
        <h1 className="text-2xl font-bold tracking-tight">로그인이 필요합니다</h1>
        <p className="mt-2.5 max-w-[60ch] text-sm text-muted-foreground">
          로그인하면 어느 브라우저에서든 내 프로젝트와 부채비율을 이어서 볼 수 있습니다.
          로그인 전에 이 브라우저에서 푼 퀴즈 기록은 계정으로 옮겨집니다.
        </p>
        <form
          className="mt-5"
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/me" });
          }}
        >
          <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            GitHub로 로그인
          </button>
        </form>
      </main>
    );
  }

  const projects = await getUserProjects(userId);

  return (
    <main className="mx-auto max-w-5xl px-5 pt-10 pb-16">
      <p className="eyebrow mb-2.5">My projects</p>
      <h1 className="text-2xl font-bold tracking-tight">내 프로젝트</h1>

      {projects.length === 0 ? (
        <p className="mt-2.5 max-w-[60ch] text-sm text-muted-foreground">
          아직 퀴즈를 푼 프로젝트가 없습니다.{" "}
          <Link href="/" className="underline underline-offset-2">
            레포를 분석하고
          </Link>{" "}
          개념을 골라 퀴즈를 풀어 보세요.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {projects.map((project) => {
            const measured = project.concepts.filter((c) => project.debt[c.id] != null);
            const overall = overallDebtRatio(
              project.concepts.map((c) => {
                const value = project.debt[c.id];
                return { files: c.files, score: value == null ? null : 100 - value };
              }),
            );
            return (
              <Card key={project.analysisId} className="gap-0 p-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-base font-semibold tracking-tight">{project.repo}</h2>
                  <span className="font-mono text-[11px] text-dim">@ {project.commit}</span>
                  {project.jobId ? (
                    <Link href={`/a/${project.jobId}`} className="ml-auto font-mono text-[11px] underline underline-offset-2">
                      지도 열기 →
                    </Link>
                  ) : null}
                </div>

                <StatStrip className="my-3">
                  <Stat value={`${overall}%`} label="overall 부채비율" />
                  <Stat value={`${measured.length}/${project.concepts.length}`} label="측정한 개념" />
                  <Stat value={project.recent.length} label="최근 퀴즈" />
                </StatStrip>

                <div className="eyebrow mb-1.5 text-[9.5px]">최근 퀴즈</div>
                <ul className="flex flex-col gap-1">
                  {project.recent.map((quiz) => (
                    <li key={quiz.id} className="flex flex-wrap gap-x-3 font-mono text-[11px] text-muted-foreground">
                      <Link href={`/quiz/${quiz.id}${project.jobId ? `?from=/a/${project.jobId}` : ""}`} className="text-foreground underline-offset-2 hover:underline">
                        {quiz.conceptName}
                      </Link>
                      <span>
                        {quiz.status !== "done"
                          ? "진행 중"
                          : quiz.result
                            ? `${quiz.result.debtBefore === null ? "미측정" : `${quiz.result.debtBefore}%`} → ${quiz.result.debtAfter}%`
                            : "완료"}
                      </span>
                      <span className="text-dim">{when(quiz.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
