import { describe, expect, test } from "bun:test";
import { isSensitivePath, selectQuizFiles } from "./source";

describe("isSensitivePath", () => {
  test("env·키 파일은 제외", () => {
    expect(isSensitivePath(".env")).toBe(true);
    expect(isSensitivePath("apps/web/.env.local")).toBe(true);
    expect(isSensitivePath("certs/server.pem")).toBe(true);
    expect(isSensitivePath("src/lib/env.ts")).toBe(false);
    expect(isSensitivePath("src/lib/auth.ts")).toBe(false);
  });
});

describe("selectQuizFiles", () => {
  const files = ["docs/guide.md", "src/a.ts", "src/b.ts", "src/c.ts", "tests/a.test.ts", ".env"];

  test("대표 심볼 파일 → normal → peripheral 순, 시크릿 제외", () => {
    expect(selectQuizFiles(files, ["src/c.ts", "src/a.ts"], 10)).toEqual([
      "src/c.ts",
      "src/a.ts",
      "src/b.ts",
      "docs/guide.md",
      "tests/a.test.ts",
    ]);
  });

  test("concept 밖의 파일은 대표 심볼에 있어도 넣지 않는다", () => {
    expect(selectQuizFiles(files, ["src/other.ts"], 2)).toEqual(["src/a.ts", "src/b.ts"]);
  });
});
