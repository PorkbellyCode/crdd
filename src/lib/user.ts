/**
 * 익명 기기 ID — 로그인(P3) 전까지의 사용자 구분 (서버 전용).
 *
 * 처음 퀴즈를 만들 때 무작위 UUID를 httpOnly 쿠키로 심고, 점수·이력·퀴즈를 그
 * ID로 나눈다. 계정이 아니라서 브라우저를 바꾸거나 쿠키를 지우면 기록이 안 보인다.
 * 로그인이 붙으면 이 ID의 기록을 계정으로 옮기는 식으로 이어 붙인다.
 *
 * ID 자체가 곧 권한이므로(추측 불가능한 UUID) 화면·URL·로그에 내보내지 않는다.
 */
import "server-only";
import { cookies } from "next/headers";

export const USER_COOKIE = "crdd_uid";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** 브라우저가 허용하는 쿠키 수명 상한(400일) */
const MAX_AGE_SEC = 400 * 24 * 60 * 60;

/** 읽기만 한다. 아직 쿠키가 없는 첫 방문이면 null */
export async function getUserId(): Promise<string | null> {
  const value = (await cookies()).get(USER_COOKIE)?.value;
  return value && UUID_PATTERN.test(value) ? value : null;
}

/** 없으면 만들어 심는다. 기록을 남기는 요청(퀴즈 생성)에서만 부른다 */
export async function ensureUserId(): Promise<string> {
  const existing = await getUserId();
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
