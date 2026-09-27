/** 출제된 코드 발췌 후처리 (순수 함수) */

const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|#(?!!)|<!--)/;

/**
 * 발췌 정리 (실제 키로 돌려 본 결과 두 가지가 나왔다).
 *   1. 발췌 맨 위의 주석 덩어리는 뺀다 — 파일 머리 주석은 대개 "이 파일이 무엇을 하는지"를
 *      요약하고 있어 역할을 묻는 질문의 답이 그대로 보였다. 코드 사이 주석은 둔다
 *   2. 줄 범위를 실제 옮긴 코드 줄 수에 맞춘다 — 머리글은 L23–57인데 코드는 51줄에서 끝났다
 */
export function tidyExcerpt(
  excerpt: { file: string; startLine: number; endLine: number; code: string },
  fileLines: number,
): { file: string; startLine: number; endLine: number; code: string } {
  const codeLines = excerpt.code.replace(/\s+$/, "").split("\n");
  const isNoise = (line: string) => COMMENT_LINE.test(line) || !line.trim();
  let skip = 0;
  while (skip < codeLines.length && isNoise(codeLines[skip]!)) skip++;
  // 전부 주석이면 손대지 않는다 (주석 자체를 묻는 문항일 수 있다)
  if (skip >= codeLines.length) skip = 0;
  const kept = codeLines.slice(skip);
  const startLine = Math.min(excerpt.startLine + skip, fileLines);
  const endLine = Math.min(startLine + kept.length - 1, fileLines);
  return { file: excerpt.file, startLine, endLine, code: kept.join("\n") };
}
