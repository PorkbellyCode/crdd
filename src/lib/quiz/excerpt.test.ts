import { describe, expect, test } from "bun:test";
import { tidyExcerpt } from "./excerpt";

describe("tidyExcerpt", () => {
  test("발췌 맨 위의 주석 덩어리를 빼고 시작 줄을 옮긴다", () => {
    const out = tidyExcerpt(
      {
        file: "a.mjs",
        startLine: 1,
        endLine: 5,
        code: "// DB에 쓰지 않고 검증까지만 하는 드라이런\n// create-digest-post.ts를 거치지 않음\nimport x from 'x';\nconst y = 1;\n// 중간 주석은 둔다",
      },
      100,
    );
    expect(out.startLine).toBe(3);
    expect(out.endLine).toBe(5);
    expect(out.code.startsWith("import x")).toBe(true);
    expect(out.code).toContain("// 중간 주석은 둔다");
  });

  test("머리글 줄 범위를 실제 코드 줄 수에 맞춘다", () => {
    const code = Array.from({ length: 29 }, (_, i) => `line${i}`).join("\n");
    const out = tidyExcerpt({ file: "b.ts", startLine: 23, endLine: 57, code }, 200);
    expect(out.startLine).toBe(23);
    expect(out.endLine).toBe(51);
  });

  test("전부 주석인 발췌는 그대로 둔다", () => {
    const out = tidyExcerpt({ file: "c.ts", startLine: 10, endLine: 11, code: "// a\n// b" }, 50);
    expect(out.startLine).toBe(10);
    expect(out.code).toBe("// a\n// b");
  });

  test("주석 두 줄 + 코드 한 줄이면 코드 한 줄만 남긴다", () => {
    const out = tidyExcerpt({ file: "e.ts", startLine: 5, endLine: 7, code: "// a\n// b\nrun();" }, 50);
    expect(out).toEqual({ file: "e.ts", startLine: 7, endLine: 7, code: "run();" });
  });

  test("셔뱅(#!)은 주석으로 보지 않는다", () => {
    const out = tidyExcerpt({ file: "d.sh", startLine: 1, endLine: 2, code: "#!/usr/bin/env node\nrun();" }, 10);
    expect(out.startLine).toBe(1);
  });
});
