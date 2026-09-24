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
import { upsertUser } from "@/db/user-repo";

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
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});
