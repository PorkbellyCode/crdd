import { describe, expect, test } from "bun:test";
import { describeInvalidRequest } from "./describe";

describe("describeInvalidRequest", () => {
  test("잔액 부족은 충전 안내로", () => {
    expect(
      describeInvalidRequest("Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing"),
    ).toContain("크레딧 잔액이 부족합니다");
  });
  test("다른 원인은 제공자 문장을 붙인다", () => {
    expect(describeInvalidRequest("tool_choice is not supported")).toBe(
      "LLM 요청이 거절되었습니다: tool_choice is not supported",
    );
  });
  test("키처럼 보이는 문자열은 가린다", () => {
    expect(describeInvalidRequest("bad key sk-ant-api03-abcdefghijk")).not.toContain("abcdefghijk");
  });
});
