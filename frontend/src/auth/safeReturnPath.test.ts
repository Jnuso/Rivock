import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./safeReturnPath";

describe("safeReturnPath", () => {
  it("accepts a local path", () => {
    expect(safeReturnPath("/dashboard")).toBe("/dashboard");
    expect(safeReturnPath("/onboarding?x=1#top")).toBe("/onboarding?x=1#top");
  });

  it("rejects open redirects and junk", () => {
    expect(safeReturnPath("//evil.com")).toBeNull();
    expect(safeReturnPath("https://evil.com")).toBeNull();
    expect(safeReturnPath("\\evil")).toBeNull();
    expect(safeReturnPath("dashboard")).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath("")).toBeNull();
  });
});
