import { StrictMode, type ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  loaded: true,
  userId: "user_alice" as string | null,
  sessionId: "sess_alice" as string | null,
  token: vi.fn(),
  logout: vi.fn(),
  redirect: vi.fn(),
  readMe: vi.fn(),
  config: vi.fn(),
  getter: async () => null as string | null,
}));
vi.mock("./config", () => ({
  RETURN_PATH_KEY: "test.return",
  readClerkConfig: state.config,
}));
vi.mock("@clerk/react", () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    isLoaded: state.loaded,
    userId: state.userId,
    sessionId: state.sessionId,
    getToken: state.token,
  }),
  useClerk: () => clerk,
}));
const clerk = { signOut: state.logout, redirectToSignIn: state.redirect };
vi.mock("../api", async (original) => {
  const actual = await original<typeof import("../api")>();
  return {
    ...actual,
    setTokenGetter: (fn: typeof state.getter) => {
      state.getter = fn;
    },
    api: {
      getMe: async () => {
        expect(await state.getter()).toBe("synthetic-token");
        return state.readMe();
      },
    },
  };
});
import { AuthProvider, useAuth } from "./AuthContext";
import { ApiError } from "../api";
import { readDraft, writeDraft, clearDraftMemory } from "../lib/drafts";
const profile = (name = "alice") => ({
  onboarding_required: false,
  user: {
    id: "local-" + name,
    username: name,
    role: "member",
    status: "active",
  },
});
function Probe() {
  const auth = useAuth();
  return (
    <>
      <p>{auth.user?.username ?? "anonymous"}</p>
      {auth.authMessage && <p>{auth.authMessage}</p>}
      <button onClick={() => void auth.signOut()}>Sign out</button>
      <button onClick={() => void auth.signIn("//evil.invalid")}>
        Sign in
      </button>
      <button onClick={() => void auth.refreshMe()}>Refresh profile</button>
    </>
  );
}
function ui(qc = new QueryClient()) {
  return (
    <StrictMode>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}
beforeEach(() => {
  state.loaded = true;
  state.userId = "user_alice";
  state.sessionId = "sess_alice";
  state.config.mockReturnValue({
    publishableKey: "synthetic-public",
    frontendOrigin: "https://synthetic.clerk.accounts.dev",
  });
  state.token.mockResolvedValue("synthetic-token");
  state.readMe.mockResolvedValue(profile());
  state.logout.mockResolvedValue(undefined);
  state.redirect.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  clearDraftMemory();
  vi.resetAllMocks();
});
it("loads a Clerk session in StrictMode and clears private caches/drafts on logout", async () => {
  const qc = new QueryClient();
  render(ui(qc));
  await screen.findByText("alice");
  qc.setQueryData(["saved"], { private: "synthetic" });
  writeDraft("private", "My private draft");
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() =>
    expect(state.logout).toHaveBeenCalledWith({
      redirectUrl: window.location.origin,
    }),
  );
  expect(qc.getQueryData(["saved"])).toBeUndefined();
  expect(readDraft("private")).toBe("");
  expect(await state.getter()).toBeNull();
  expect(screen.getByText("anonymous")).toBeVisible();
});
it("ignores a profile failure that arrives after sign-out", async () => {
  render(ui());
  await screen.findByText("alice");
  let rejectPending: (e: unknown) => void = () => {};
  state.readMe.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectPending = reject;
      }),
  );
  const calls = state.readMe.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Refresh profile" }));
  await waitFor(() => expect(state.readMe).toHaveBeenCalledTimes(calls + 1));
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await screen.findByText("anonymous");
  await act(async () =>
    rejectPending(
      new ApiError(401, {
        error: { code: "invalid_token", message: "Synthetic expiration" },
      }),
    ),
  );
  expect(screen.queryByText(/session expired/i)).toBeNull();
  expect(await state.getter()).toBeNull();
});
it("fails a signed-in token refresh without falling back to anonymous API access", async () => {
  state.token.mockResolvedValue(null);
  render(ui());
  await screen.findByText(/session expired/i);
  expect(state.readMe).not.toHaveBeenCalled();
  await expect(state.getter()).rejects.toThrow(/session expired/i);
});
it("drops old account data and ignores its late response when switching accounts", async () => {
  const qc = new QueryClient();
  const view = render(ui(qc));
  await screen.findByText("alice");
  let resolvePending: (data: unknown) => void = () => {};
  state.readMe.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolvePending = resolve;
      }),
  );
  const calls = state.readMe.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Refresh profile" }));
  await waitFor(() => expect(state.readMe).toHaveBeenCalledTimes(calls + 1));
  writeDraft("private", "Alice's private draft");
  qc.setQueryData(["saved"], { private: "alice" });
  state.userId = "user_bruce";
  state.sessionId = "sess_bruce";
  state.readMe.mockResolvedValue(profile("bruce"));
  view.rerender(ui(qc));
  await screen.findByText("bruce");
  await act(async () => resolvePending(profile("alice")));
  expect(screen.queryByText("alice")).toBeNull();
  expect(readDraft("private")).toBe("");
  expect(qc.getQueryData(["saved"])).toBeUndefined();
});
it("keeps sign-in return URLs on this origin", async () => {
  state.userId = null;
  state.sessionId = null;
  render(ui());
  fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
  await waitFor(() =>
    expect(state.redirect).toHaveBeenCalledWith({
      signInForceRedirectUrl: window.location.origin + "/",
      signUpForceRedirectUrl: window.location.origin + "/",
    }),
  );
  expect(sessionStorage.getItem("test.return")).toBe("/");
});
it("clears another user's persisted drafts after reloading into a different account", async () => {
  sessionStorage.setItem("rivock.auth.lastUser", "user_previous");
  writeDraft("private", "Previous private draft");
  render(ui());
  await screen.findByText("alice");
  expect(readDraft("private")).toBe("");
});
it("leaves public browsing available when no Clerk key is configured", async () => {
  state.config.mockReturnValue(null);
  render(ui());
  expect(screen.getByText(/Sign-in is unavailable/)).toBeVisible();
  expect(state.readMe).not.toHaveBeenCalled();
  expect(await state.getter()).toBeNull();
});
