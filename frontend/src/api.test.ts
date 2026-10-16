import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { api, ApiError, setTokenGetter, clearIdempotencyMemory } from "./api";
beforeEach(() => {
  sessionStorage.clear();
  clearIdempotencyMemory();
  vi.stubGlobal("crypto", webcrypto);
  setTokenGetter(async () => null);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each([false, true])(
  "reuses an idempotency key after uncertain network failure (storage blocked=%s)",
  async (blocked) => {
    if (blocked) {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("Storage disabled");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Storage disabled");
      });
      vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new Error("Storage disabled");
      });
    }
    setTokenGetter(async () => "synthetic-token");
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Network failed"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            submission: { id: "s", status: "pending" },
            content: null,
          }),
          { status: 202 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const body = {
      type: "question" as const,
      topic_id: "t",
      title: "Test",
      body_markdown: "Draft",
    };
    await expect(api.createThread(body)).rejects.toThrow("Network failed");
    const result = await api.createThread(body);
    expect(result.submission.status).toBe("pending");
    const first = new Headers(fetch.mock.calls[0][1].headers),
      second = new Headers(fetch.mock.calls[1][1].headers);
    expect(first.get("Idempotency-Key")).toBe(second.get("Idempotency-Key"));
    expect(second.get("Authorization")).toBe("Bearer synthetic-token");
    expect(Object.keys(sessionStorage)).toHaveLength(0);
  },
);

it("does not publish an old draft as a new account after async request preparation", async () => {
  let finish: (value: ArrayBuffer) => void = () => {};
  vi.stubGlobal("crypto", {
    subtle: {
      digest: () =>
        new Promise<ArrayBuffer>((resolve) => {
          finish = resolve;
        }),
    },
  });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  setTokenGetter(async () => "old-account-token");
  const pending = api.createReply("thread", {
    body_markdown: "Old account private draft",
  });
  setTokenGetter(async () => "new-account-token");
  finish(new ArrayBuffer(32));
  await expect(pending).rejects.toMatchObject({
    status: 401,
    body: { error: { code: "session_changed" } },
  });
  expect(fetch).not.toHaveBeenCalled();
});

it("does not return a previous account's private response after switching sessions", async () => {
  let finish: (value: Response) => void = () => {};
  let started: () => void = () => {};
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      started();
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    }),
  );
  const pending = api.getMe();
  await startedPromise;
  setTokenGetter(async () => "new-account-token");
  finish(new Response(JSON.stringify({ private: "Previous account" })));
  await expect(pending).rejects.toMatchObject({
    status: 401,
    body: { error: { code: "session_changed" } },
  });
});
it("exposes rejection and owned submission reference without claiming publication", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "policy_rejected",
            message: "Revise this text",
            submission_id: "private-id",
          },
        }),
        { status: 422 },
      ),
    ),
  );
  try {
    await api.createReply("t", { body_markdown: "Draft" });
    throw new Error("Expected rejection");
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).body?.error.submission_id).toBe("private-id");
  }
});
it("does not send a protected request anonymously when token acquisition fails", async () => {
  setTokenGetter(async () => {
    throw new Error("Please sign in again");
  });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(api.getMe()).rejects.toThrow("sign in again");
  expect(fetch).not.toHaveBeenCalled();
});
