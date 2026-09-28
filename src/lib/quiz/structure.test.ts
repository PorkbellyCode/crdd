import { describe, expect, test } from "bun:test";
import map from "@/data/porklog-map.json";
import type { MapData } from "@/lib/crdd/types";
import { conceptStructure, isAuxiliaryFile, renderStructure } from "./structure";

const data = map as MapData;
const techDigest = data.concepts.findIndex((c) => c.name === "Tech Digest");

describe("conceptStructure (porklog 실측)", () => {
  const structure = conceptStructure(data, techDigest);

  test("진입점은 cron 라우트 — 보조 스크립트가 아니다", () => {
    expect(structure.entries).toEqual(["src/app/api/cron/tech-digest/route.ts"]);
  });

  test("재료 파일은 진입점 → 흐름 순이고 scripts/는 맨 뒤", () => {
    expect(structure.rankedFiles[0]).toBe("src/app/api/cron/tech-digest/route.ts");
    const firstScript = structure.rankedFiles.findIndex(isAuxiliaryFile);
    expect(structure.rankedFiles.slice(firstScript).every(isAuxiliaryFile)).toBe(true);
  });

  test("상위 5개 재료에 흐름의 뒷단(요약·저장)이 들어간다", () => {
    const top = structure.rankedFiles.slice(0, 5);
    expect(top).toContain("src/lib/tech-digest/summarize.ts");
    expect(top).toContain("src/lib/tech-digest/create-digest-post.ts");
  });

  test("라우트가 수집 → 요약 → 저장을 호출하는 흐름이 요약에 담긴다", () => {
    const text = renderStructure(structure);
    expect(text).toContain("GET() @tech-digest/route.ts → fetchWeeklyTechNews()");
    expect(text).toContain("createDigestPost()");
    expect(text).toContain("[Post Actions]");
  });
});

describe("isAuxiliaryFile", () => {
  test("스크립트·테스트는 보조, 앱 코드는 아니다", () => {
    expect(isAuxiliaryFile("scripts/run.mjs")).toBe(true);
    expect(isAuxiliaryFile("src/lib/a.test.ts")).toBe(true);
    expect(isAuxiliaryFile("src/lib/scripting.ts")).toBe(false);
  });
});
