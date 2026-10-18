import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import {
  API_BASE,
  api,
  ApiError,
  setTokenGetter,
  clearIdempotencyMemory,
} from "./api";
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

it("sends feed filters, search and pagination together as encoded query parameters", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ items: [], next_offset: null })),
    );
  vi.stubGlobal("fetch", fetch);
  await api.getThreads({
    topic: "education",
    type: "question",
    answer_status: "unanswered",
    q: "office & hours",
    sort: "newest",
    offset: 20,
    limit: 20,
  });
  const url = new URL(fetch.mock.calls[0][0]);
  expect(Object.fromEntries(url.searchParams)).toEqual({
    topic: "education",
    type: "question",
    answer_status: "unanswered",
    q: "office & hours",
    sort: "newest",
    offset: "20",
    limit: "20",
  });
});

it("sends reply order with its page offset and preserves the existing limit argument", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ items: [], next_offset: null })),
    );
  vi.stubGlobal("fetch", fetch);
  await api.getReplies("thread", 20, 5, "oldest");
  const url = new URL(fetch.mock.calls[0][0]);
  expect(url.pathname).toBe("/api/v1/threads/thread/replies");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    offset: "20",
    limit: "5",
    sort: "oldest",
  });
});

it.each([false, true])(
  "sends explicit notification read=%s changes",
  async (read) => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "note", read }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetch);
    await api.markRead("note", read);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      API_BASE + "/me/notifications/note",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ read }),
      }),
    );
  },
);

it("preserves the existing markRead default for older callers", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ id: "note", read: true }), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetch);
  await api.markRead("note");
  expect(fetch.mock.calls[0][1].body).toBe(JSON.stringify({ read: true }));
});

it("encodes saved search with pagination without changing its text", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ items: [], next_offset: null }), {
        status: 200,
      }),
    );
  vi.stubGlobal("fetch", fetch);
  await api.getSaved(20, 7, "office & lecture");
  const url = new URL(fetch.mock.calls[0][0]);
  expect(url.pathname).toBe("/api/v1/me/saved");
  expect(url.searchParams.get("offset")).toBe("20");
  expect(url.searchParams.get("limit")).toBe("7");
  expect(url.searchParams.get("q")).toBe("office & lecture");
});
it("omits an empty saved search for existing callers", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ items: [], next_offset: null }), {
        status: 200,
      }),
    );
  vi.stubGlobal("fetch", fetch);
  await api.getSaved();
  expect(new URL(fetch.mock.calls[0][0]).searchParams.has("q")).toBe(false);
});
