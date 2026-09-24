import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import KeyStatus from "@/components/KeyStatus";

/** 상단 띠 — 홈·데모·키 상태·로그인 */
export default async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 font-mono text-[11px]">
        <Link href="/" className="font-semibold text-foreground">
          CRDD
        </Link>
        <Link href="/demo" className="text-muted-foreground hover:text-foreground">
          데모
        </Link>
        {user ? (
          <Link href="/me" className="text-muted-foreground hover:text-foreground">
            내 프로젝트
          </Link>
        ) : null}

        <span className="ml-auto" />
        <KeyStatus />

        {user ? (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
            className="flex items-center gap-2"
          >
            {user.image ? (
              // GitHub 아바타 — next/image 원격 도메인 설정 없이 쓰려고 img를 그대로 쓴다
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="size-5 rounded-full" />
            ) : null}
            <span className="text-foreground">{user.name ?? "로그인됨"}</span>
            <button type="submit" className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              로그아웃
            </button>
          </form>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("github");
            }}
          >
            <button type="submit" className="rounded-md border border-border px-2 py-1 text-foreground hover:bg-secondary">
              GitHub로 로그인
            </button>
          </form>
        )}
      </nav>
    </header>
  );
}
