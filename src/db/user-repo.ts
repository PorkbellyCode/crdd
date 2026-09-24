/**
 * 계정 저장. Auth.js DB 어댑터 대신 로그인 콜백에서 직접 부른다.
 */
import { db } from "./index";
import { users } from "./schema";

export async function upsertUser(input: {
  id: string;
  provider: string;
  providerAccountId: string;
  login: string | null;
  name: string | null;
  image: string | null;
}) {
  const now = Math.floor(Date.now() / 1000);
  await db
    .insert(users)
    .values({ ...input, lastLoginAt: now })
    .onConflictDoUpdate({
      target: users.id,
      set: { login: input.login, name: input.name, image: input.image, lastLoginAt: now },
    });
}
