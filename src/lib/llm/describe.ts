/**
 * Anthropic 400(invalid_request_error)을 사용자에게 보여줄 문장으로.
 * 원인이 여러 가지라(잔액 부족, 모델이 받지 않는 파라미터 등)
 * 제공자의 에러 문장을 짧게 잘라 붙인다. 이 문장에는 키가 들어 있지 않지만, 혹시 몰라
 * 키처럼 보이는 문자열은 가린다.
 */
export function describeInvalidRequest(message: string): string {
  if (/credit balance/i.test(message)) {
    return "크레딧 잔액이 부족합니다. Anthropic Console의 Billing에서 충전한 뒤 다시 시도해 주세요.";
  }
  const cleaned = message
    .replace(/sk-[A-Za-z0-9_-]{6,}/g, "sk-…")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return cleaned ? `LLM 요청이 거절되었습니다: ${cleaned}` : "LLM 요청이 거절되었습니다.";
}

