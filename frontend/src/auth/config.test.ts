import { afterEach, expect, it, vi } from "vitest";
import { clerkFrontendOrigin, readClerkConfig } from "./config";
const key = (host: string) => "pk_test_" + btoa(host + "$");
afterEach(() => vi.unstubAllEnvs());
it("reads the public instance hostname without accepting URLs or CSP injection", () => {
  expect(clerkFrontendOrigin(key("synthetic.clerk.accounts.dev"))).toBe(
    "https://synthetic.clerk.accounts.dev",
  );
  for (const host of [
    "evil.invalid/path",
    "user@evil.invalid",
    "evil.invalid:443",
    "evil.invalid;unsafe-inline",
    "https://evil.invalid",
    "evil.invalid?next=x",
  ]) {
    expect(clerkFrontendOrigin(key(host))).toBeNull();
  }
  expect(clerkFrontendOrigin("secret_synthetic")).toBeNull();
  expect(clerkFrontendOrigin("pk_test_notbase64")).toBeNull();
});
it("allows public browsing without a configured key", () => {
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
  expect(readClerkConfig()).toBeNull();
  const publishableKey = key("synthetic.clerk.accounts.dev");
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", publishableKey);
  expect(readClerkConfig()).toEqual({
    publishableKey,
    frontendOrigin: "https://synthetic.clerk.accounts.dev",
  });
});
