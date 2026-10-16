import { describe, expect, it } from "vitest";
import { cpLen, isAllowedHttpUrl, validateUsername, LIMITS } from "./limits";

describe("validation helpers", () => {
  it("counts code points not UTF-16 units", () => {
    expect(cpLen("hi")).toBe(2);
    expect(cpLen("👍")).toBe(1);
    expect(cpLen("a".repeat(LIMITS.query + 1))).toBe(LIMITS.query + 1);
  });

  it("validates usernames and http(s) links only", () => {
    expect(validateUsername("ab")).toMatch(/3/);
    expect(validateUsername("good_user")).toBeNull();
    expect(isAllowedHttpUrl("https://example.com/x")).toBe(true);
    expect(isAllowedHttpUrl("http://example.com")).toBe(true);
    expect(isAllowedHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedHttpUrl("data:text/html,hi")).toBe(false);
  });
});
