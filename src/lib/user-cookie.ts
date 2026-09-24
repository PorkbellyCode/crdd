/** 익명 기기 ID 쿠키 규약. auth.ts와 user.ts가 같이 쓴다 (둘 사이 순환 import를 피하려고 분리) */
export const USER_COOKIE = "crdd_uid";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isAnonymousId(value: string): boolean {
  return UUID_PATTERN.test(value);
}
