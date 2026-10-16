export const API_BASE = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/$/, "");

export type Uuid = string;

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    submission_id?: Uuid;
    request_id?: string;
  };
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;
  constructor(status: number, body: ApiErrorBody | null, message?: string) {
    super(message ?? body?.error?.message ?? `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

import type { components } from "./generated/api-schema";
type Schema = components["schemas"];
export type PublicUser = Schema["PublicUser"];
export type PrivateUser = Schema["PrivateUser"];
export type MeResponse = Schema["MeOut"];
export type Topic = Schema["TopicOut"];
export type ThreadSummary = Schema["ThreadOut"];
export type ThreadDetail = Schema["ThreadOut"];
export type Reply = Schema["ReplyOut"];
export type Submission = Schema["SubmissionOut"];
export type NotificationItem = Schema["NotificationOut"];
export type NotificationsPage = Schema["NotificationList"];
export type BlockItem = Schema["BlockOut"];
export type ReportItem = Schema["ReportOut"];
export type AdminAction = Schema["ActionOut"];
export type VoteResult = Schema["VoteOut"];
export type AcceptedAnswerResult = Schema["AcceptedOut"];
export interface Page<T> {
  items: T[];
  next_offset: number | null;
}
export interface ModeratedResult<T> {
  submission: Submission;
  content: T | null;
}

type TokenGetter = () => Promise<string | null>;
let getAccessToken: TokenGetter = async () => null;
let authGeneration = 0;
let authScope: string | undefined = "anonymous";
const retryKeys = new Map<string, string>();

export function clearIdempotencyMemory() {
  retryKeys.clear();
}

export function setTokenGetter(fn: TokenGetter, scope?: string) {
  if (scope === undefined || scope !== authScope) authGeneration++;
  authScope = scope;
  getAccessToken = fn;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { idempotency?: boolean } = {},
): Promise<T> {
  const generation = authGeneration;
  const tokenGetter = getAccessToken;
  const requireCurrentSession = () => {
    if (generation !== authGeneration)
      throw new ApiError(401, {
        error: {
          code: "session_changed",
          message: "Your session changed. Please retry the action.",
        },
      });
  };
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  let retryKey: string | null = null;
  if (init.idempotency) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${init.method}:${path}:${init.body ?? ""}`),
    );
    requireCurrentSession();
    retryKey =
      "rivock.idempotency." +
      Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(retryKey);
    } catch {
      /* Memory fallback. */
    }
    const key = stored ?? retryKeys.get(retryKey) ?? newIdempotencyKey();
    retryKeys.set(retryKey, key);
    try {
      sessionStorage.setItem(retryKey, key);
    } catch {
      /* Retry within this tab remains safe. */
    }
    headers.set("Idempotency-Key", key);
  }
  requireCurrentSession();
  const token = await tokenGetter();
  requireCurrentSession();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "omit",
  });
  requireCurrentSession();
  const data = await parseBody(res);
  requireCurrentSession();
  if (retryKey && res.status < 500 && res.status !== 429) {
    retryKeys.delete(retryKey);
    try {
      sessionStorage.removeItem(retryKey);
    } catch {
      /* Memory was cleared. */
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, (data as ApiErrorBody) ?? null);
  }
  return data as T;
}

const q = (
  params: Record<string, string | number | boolean | undefined | null>,
) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const api = {
  getInfo: () => apiFetch<Schema["InfoOut"]>("/info"),
  adminInspect: (kind: "threads" | "replies", id: string) =>
    apiFetch<Schema["AdminContentOut"]>(`/admin/${kind}/${id}`),
  adminStatus: () => apiFetch<Schema["AdminStatusOut"]>("/admin/status"),
  adminPause: (paused: boolean, reason: string) =>
    apiFetch<Schema["PauseOut"]>("/admin/pause", {
      method: "PUT",
      body: JSON.stringify({ paused, reason }),
    }),
  createTopic: (body: { slug: string; name: string; sort_order: number }) =>
    apiFetch<Topic>("/admin/topics", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  editTopic: (
    id: string,
    body: { name?: string; sort_order?: number; is_active?: boolean },
  ) =>
    apiFetch<Topic>(`/admin/topics/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  getMe: () => apiFetch<MeResponse>("/me"),
  createMe: (username: string) =>
    apiFetch<PrivateUser>("/me", {
      method: "POST",
      body: JSON.stringify({ username }),
      idempotency: true,
    }),
  patchMe: (body: Schema["ProfileEdit"]) =>
    apiFetch<ModeratedResult<PrivateUser>>("/me", {
      method: "PATCH",
      body: JSON.stringify(body),
      idempotency: true,
    }),
  deleteMe: (confirm_username: string) =>
    apiFetch<null>("/me", {
      method: "DELETE",
      body: JSON.stringify({ confirm_username }),
    }),
  getTopics: (include_archived = false) =>
    apiFetch<Topic[]>(`/topics${q({ include_archived })}`),
  getThreads: (params: {
    topic?: string;
    q?: string;
    sort?: string;
    offset?: number;
    limit?: number;
  }) => apiFetch<Page<ThreadSummary>>(`/threads${q(params)}`),
  getThread: (id: string) => apiFetch<ThreadDetail>(`/threads/${id}`),
  createThread: (body: Schema["ThreadCreate"]) =>
    apiFetch<ModeratedResult<ThreadDetail>>("/threads", {
      method: "POST",
      body: JSON.stringify(body),
      idempotency: true,
    }),
  patchThread: (
    id: string,
    body: {
      base_revision: number;
      topic_id: string;
      title: string;
      body_markdown: string;
    },
  ) =>
    apiFetch<ModeratedResult<ThreadDetail>>(`/threads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      idempotency: true,
    }),
  deleteThread: (id: string) =>
    apiFetch<null>(`/threads/${id}`, { method: "DELETE" }),
  getReplies: (threadId: string, offset = 0, limit = 20) =>
    apiFetch<Page<Reply>>(
      `/threads/${threadId}/replies${q({ offset, limit })}`,
    ),
  getChildren: (replyId: string, offset = 0, limit = 20) =>
    apiFetch<Page<Reply>>(
      `/replies/${replyId}/children${q({ offset, limit })}`,
    ),
  createReply: (
    threadId: string,
    body: { body_markdown: string; response_to_reply_id?: string },
  ) =>
    apiFetch<ModeratedResult<Reply>>(`/threads/${threadId}/replies`, {
      method: "POST",
      body: JSON.stringify(body),
      idempotency: true,
    }),
  patchReply: (
    id: string,
    body: { base_revision: number; body_markdown: string },
  ) =>
    apiFetch<ModeratedResult<Reply>>(`/replies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      idempotency: true,
    }),
  deleteReply: (id: string) =>
    apiFetch<null>(`/replies/${id}`, { method: "DELETE" }),
  voteThread: (id: string, value: 1 | -1) =>
    apiFetch<VoteResult>(`/threads/${id}/vote`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
  clearThreadVote: (id: string) =>
    apiFetch<VoteResult>(`/threads/${id}/vote`, { method: "DELETE" }),
  voteReply: (id: string, value: 1 | -1) =>
    apiFetch<VoteResult>(`/replies/${id}/vote`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
  clearReplyVote: (id: string) =>
    apiFetch<VoteResult>(`/replies/${id}/vote`, { method: "DELETE" }),
  acceptAnswer: (threadId: string, reply_id: string) =>
    apiFetch<AcceptedAnswerResult>(`/threads/${threadId}/accepted-answer`, {
      method: "PUT",
      body: JSON.stringify({ reply_id }),
    }),
  clearAccepted: (threadId: string) =>
    apiFetch<AcceptedAnswerResult>(`/threads/${threadId}/accepted-answer`, {
      method: "DELETE",
    }),
  getSaved: (offset = 0, limit = 20) =>
    apiFetch<Page<ThreadSummary>>(`/me/saved${q({ offset, limit })}`),
  saveThread: (id: string) =>
    apiFetch<null>(`/threads/${id}/save`, { method: "PUT" }),
  unsaveThread: (id: string) =>
    apiFetch<null>(`/threads/${id}/save`, { method: "DELETE" }),
  getSubmissions: (
    params: { status?: string; offset?: number; limit?: number } = {},
  ) => apiFetch<Page<Submission>>(`/me/submissions${q(params)}`),
  getSubmission: (id: string) => apiFetch<Submission>(`/me/submissions/${id}`),
  getReplyContext: (id: string) =>
    apiFetch<Schema["ReplyContextOut"]>(`/replies/${id}/context`),
  cancelSubmission: (id: string) =>
    apiFetch<null>(`/me/submissions/${id}`, { method: "DELETE" }),
  getNotifications: (
    params: { unread_only?: boolean; offset?: number; limit?: number } = {},
  ) => apiFetch<NotificationsPage>(`/me/notifications${q(params)}`),
  unreadCount: () =>
    apiFetch<{ count: number }>("/me/notifications/unread-count"),
  markRead: (id: string) =>
    apiFetch<NotificationItem>(`/me/notifications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ read: true }),
    }),
  readAll: (through: string) =>
    apiFetch<null>("/me/notifications/read-all", {
      method: "POST",
      body: JSON.stringify({ through }),
    }),
  getUser: (username: string) => apiFetch<PublicUser>(`/users/${username}`),
  getContributions: (
    username: string,
    type: "threads" | "replies",
    offset = 0,
    limit = 20,
  ) =>
    apiFetch<Page<ThreadSummary | Reply>>(
      `/users/${username}/contributions${q({ type, offset, limit })}`,
    ),
  getBlocks: () => apiFetch<BlockItem[]>("/me/blocks"),
  blockUser: (userId: string) =>
    apiFetch<null>(`/me/blocks/${userId}`, { method: "PUT" }),
  unblockUser: (userId: string) =>
    apiFetch<null>(`/me/blocks/${userId}`, { method: "DELETE" }),
  report: (body: {
    thread_id?: string;
    reply_id?: string;
    user_id?: string;
    reason: string;
    detail?: string;
  }) =>
    apiFetch<{ id: Uuid }>("/reports", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminReports: (
    params: { status?: string; offset?: number; limit?: number } = {},
  ) => apiFetch<Page<ReportItem>>(`/admin/reports${q(params)}`),
  decideReport: (
    id: string,
    status: "resolved" | "dismissed",
    reason: string,
  ) =>
    apiFetch<ReportItem>(`/admin/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    }),
  adminSubmissions: (
    params: { status?: string; offset?: number; limit?: number } = {},
  ) => apiFetch<Page<Submission>>(`/admin/submissions${q(params)}`),
  adminDecision: (id: string, decision: "approve" | "reject", reason: string) =>
    apiFetch<Submission>(`/admin/submissions/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, reason }),
      idempotency: true,
    }),
  adminRetry: (id: string) =>
    apiFetch<Submission>(`/admin/submissions/${id}/retry`, {
      method: "POST",
      idempotency: true,
    }),
  removeThread: (id: string, reason: string) =>
    apiFetch<null>(`/admin/threads/${id}/remove`, {
      method: "POST",
      body: JSON.stringify({ reason }),
      idempotency: true,
    }),
  restoreThread: (id: string, reason: string) =>
    apiFetch<null>(`/admin/threads/${id}/restore`, {
      method: "POST",
      body: JSON.stringify({ reason }),
      idempotency: true,
    }),
  removeReply: (id: string, reason: string) =>
    apiFetch<null>(`/admin/replies/${id}/remove`, {
      method: "POST",
      body: JSON.stringify({ reason }),
      idempotency: true,
    }),
  restoreReply: (id: string, reason: string) =>
    apiFetch<null>(`/admin/replies/${id}/restore`, {
      method: "POST",
      body: JSON.stringify({ reason }),
      idempotency: true,
    }),
  suspendUser: (id: string, reason: string) =>
    apiFetch<null>(`/admin/users/${id}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason }),
      idempotency: true,
    }),
  restoreUser: (id: string, reason: string) =>
    apiFetch<null>(`/admin/users/${id}/restore`, {
      method: "POST",
      body: JSON.stringify({ reason }),
      idempotency: true,
    }),
  clearBio: (id: string, reason: string) =>
    apiFetch<null>(`/admin/users/${id}/clear-bio`, {
      method: "POST",
      body: JSON.stringify({ reason }),
      idempotency: true,
    }),
  adminActions: (offset = 0, limit = 20) =>
    apiFetch<Page<AdminAction>>(`/admin/actions${q({ offset, limit })}`),
};
