import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * DB 연결.
 *
 * 운영은 Turso(libsql://...), 로컬 개발은 파일(file:./local.db)로 같은 코드가
 * 돈다. 자격증명은 .env.local / Fly 시크릿에만 두고 레포에는 넣지 않는다.
 */
// CI는 빈 문자열("")을 넘긴다 — ??가 아니라 ||로 빈 값도 로컬 파일로 떨어뜨린다
const url = process.env.TURSO_DATABASE_URL || "file:./local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });
export { schema };
