/**
 * 현재 사용자 ID (서버 전용).
 *
 *   로그인했으면  → 계정 ID (`github:<번호>`, src/auth.ts)
 *   안 했으면     → 익명 기기 ID (httpOnly 쿠키의 무작위 UUID)
 *
 * 익명 ID는 처음 퀴즈를 만들 때 심는다. 계정이 아니라서 브라우저를 바꾸거나 쿠키를
 * 지우면 기록이 안 보인다. ID 자체가 곧 권한이므로(추측 불가능한 UUID) 화면·URL·
 * 로그에 내보내지 않는다.
 */
import "server-only";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { isAnonymousId, USER_COOKIE } from "./user-cookie";

export { USER_COOKIE };
/** 브라우저가 허용하는 쿠키 수명 상한(400일) */
const MAX_AGE_SEC = 400 * 24 * 60 * 60;

/** 쿠키의 익명 ID만 읽는다 */
export async function getAnonymousId(): Promise<string | null> {
  const value = (await cookies()).get(USER_COOKIE)?.value;
  return value && isAnonymousId(value) ? value : null;
}

/** 로그인한 계정 ID. 로그인 안 했으면 null */
export async function getAccountId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** 읽기만 한다. 로그인도 안 했고 쿠키도 없는 첫 방문이면 null */
export async function getUserId(): Promise<string | null> {
  return (await getAccountId()) ?? (await getAnonymousId());
}

/** 없으면 익명 ID를 만들어 심는다. 기록을 남기는 요청(퀴즈 생성)에서만 부른다 */
export async function ensureUserId(): Promise<string> {
  const account = await getAccountId();
  if (account) return account;
  const existing = await getAnonymousId();
  const id = existing ?? crypto.randomUUID();
  // 있어도 다시 심어 수명을 연장한다 — 자주 오는 사용자의 기록이 400일 뒤 사라지지 않게
  (await cookies()).set(USER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
  return id;
}
