import { CircleUserRound, LogIn, LogOut } from "lucide-react";
import { auth, signIn, signOut } from "@/auth";
import KeyStatus from "@/components/KeyStatus";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * 하단 상태 바 — 에디터에서 "지금 상태"를 보는 자리. 계정, API 키, 테마.
 * 화면 아래에 고정되고, 본문은 layout에서 그만큼 아래 여백을 둔다.
 * 탭 바와 마찬가지로 창 양 끝에 붙는다 — 왼쪽은 계정, 오른쪽은 키와 테마.
 */
export default async function StatusBar() {
  const session = await auth();
  const user = session?.user;

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 bg-statusbar text-[12px] text-statusbar-foreground">
      <div className="flex h-7 items-stretch px-2">
        {user ? (
          <form
            className="flex"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit" className="flex items-center gap-1.5 px-2 hover:bg-white/15" title="로그아웃">
              <CircleUserRound className="size-3.5" aria-hidden />
              <span>{user.name ?? "로그인됨"}</span>
              <LogOut className="size-3 opacity-70" aria-label="로그아웃" />
            </button>
          </form>
        ) : (
          <form
            className="flex"
            action={async () => {
              "use server";
              await signIn("github");
            }}
          >
            <button type="submit" className="flex items-center gap-1.5 px-2 hover:bg-white/15">
              <LogIn className="size-3.5" aria-hidden />
              GitHub로 로그인
            </button>
          </form>
        )}
        <span className="flex-1" />
        <KeyStatus />
        <ThemeToggle />
      </div>
    </footer>
  );
}
