/**
 * 로그인 (Auth.js v5) — GitHub OAuth.
 *
 * 신원 확인만 한다. 레포 권한(scope)은 요청하지 않는다 — 분석 대상은 public 레포뿐이고
 * 코드는 raw 파일로 따로 받는다. GitHub 토큰도 저장하지 않는다.
 *
 * 세션은 JWT(쿠키)로 두고 DB 어댑터를 쓰지 않는다. 계정 행(users)은 로그인할 때
 * 직접 upsert한다. 사용자 ID는 `github:<GitHub 계정 번호>` — 아이디(login)를
 * 바꿔도 유지된다.
 *
 * 필요한 환경변수: AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET
 */
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { cookies } from "next/headers";
import { mergeAnonymousRecords } from "@/db/merge-repo";
import { upsertUser } from "@/db/user-repo";
import { USER_COOKIE, isAnonymousId } from "@/lib/user-cookie";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: { strategy: "jwt" },
  // Fly.io 프록시 뒤에서 도는 컨테이너라 호스트 헤더를 신뢰한다 (Vercel 밖에서는 필수)
  trustHost: true,
  callbacks: {
    async jwt({ token, account, profile }) {
      // account·profile은 로그인 직후 한 번만 들어온다
      if (account?.provider === "github" && profile) {
        const userId = `github:${account.providerAccountId}`;
        token.uid = userId;
        await upsertUser({
          id: userId,
          provider: "github",
          providerAccountId: account.providerAccountId,
          login: typeof profile.login === "string" ? profile.login : null,
          name: profile.name ?? null,
          image: typeof profile.avatar_url === "string" ? profile.avatar_url : null,
        });
        await adoptAnonymousRecords(userId);
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});

/**
 * 로그인 전에 이 브라우저에서 푼 퀴즈·점수를 계정으로 옮기고 익명 쿠키를 지운다.
 * 실패해도 로그인은 막지 않는다 — 기록은 익명 ID에 그대로 남아 다음 로그인 때 다시 시도된다.
 */
async function adoptAnonymousRecords(accountId: string) {
  try {
    const store = await cookies();
    const anonymousId = store.get(USER_COOKIE)?.value;
    if (!anonymousId || !isAnonymousId(anonymousId)) return;
    await mergeAnonymousRecords(anonymousId, accountId);
    store.delete(USER_COOKIE);
  } catch (error) {
    console.error("익명 기록 병합 실패", error instanceof Error ? error.message : "unknown");
  }
}
