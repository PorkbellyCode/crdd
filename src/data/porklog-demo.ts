/**
 * 데모용 예시 부채비율.
 *
 * 실제 측정값이 아니다. 퀴즈 루프(P2)가 붙기 전까지 화면을 검증하기 위한
 * 값이고, 화면에도 "예시"라고 밝힌다. 구조(그래프)는 porklog의 진짜 데이터다.
 * null = 콜드 스타트(퀴즈 미실시).
 */
export const EXAMPLE_DEBT: Record<number, number | null> = {
  0: 18, // Table
  1: 58, // Post Actions
  2: 72, // Tech Digest
  3: 24, // Site
  4: 33, // Categories
  5: 46, // Toc
  6: 37, // Stack
  7: 41, // Auth
  8: null, // Fetch Feeds — 콜드 스타트
  9: 21, // Chart
  10: 63, // Admin Stats
  11: 52, // Auth Client
  12: 29, // Markdown Editor
};
