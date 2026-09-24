/**
 * BYOK 키 전달 규약 — 브라우저와 서버가 같이 쓴다.
 *
 * 키는 사용자 브라우저(localStorage)에만 있고, LLM이 필요한 요청마다 이 헤더로
 * 실려 온다. 서버는 그 요청 안에서 LLM을 부르는 데만 쓰고 DB·로그·에러 메시지
 * 어디에도 남기지 않는다.
 */
export const LLM_PROVIDER_HEADER = "x-crdd-llm-provider";
export const LLM_KEY_HEADER = "x-crdd-llm-key";
export const LLM_MODEL_HEADER = "x-crdd-llm-model";
