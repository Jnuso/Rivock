import { ClerkProvider, useAuth as useClerkAuth, useClerk } from "@clerk/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  api,
  setTokenGetter,
  type MeResponse,
  type PrivateUser,
  ApiError,
  clearIdempotencyMemory,
} from "../api";
import {
  readClerkConfig,
  RETURN_PATH_KEY,
  type ClerkPublicConfig,
} from "./config";
import { safeReturnPath } from "./safeReturnPath";
import { clearDraftMemory } from "../lib/drafts";

const UNAVAILABLE =
  "Sign-in is unavailable. You can still browse public pages.";
const EXPIRED = "Your session expired. Please sign in again to continue.";
type AuthContextValue = {
  configured: boolean;
  config: ClerkPublicConfig | null;
  account: { id: string } | null;
  me: MeResponse | null;
  user: PrivateUser | null;
  loading: boolean;
  signIn: (returnPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  refreshMe: () => Promise<MeResponse | null>;
  authMessage: string | null;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function clearRivockDrafts(): void {
  clearDraftMemory();
  clearIdempotencyMemory();
  const clear = (store: Storage) => {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (
        key?.startsWith("rivock.draft") ||
        key?.startsWith("rivock.idempotency")
      )
        keys.push(key);
    }
    for (const key of keys) store.removeItem(key);
    store.removeItem(RETURN_PATH_KEY);
  };
  try {
    clear(localStorage);
  } catch {
    /* Storage may be disabled. */
  }
  try {
    clear(sessionStorage);
  } catch {
    /* Memory was still cleared. */
  }
}

function UnconfiguredAuth({ children }: { children: ReactNode }) {
  useEffect(() => {
    setTokenGetter(async () => null, "anonymous");
  }, []);
  return (
    <AuthContext.Provider
      value={{
        configured: false,
        config: null,
        account: null,
        me: null,
        user: null,
        loading: false,
        signIn: async () => {},
        signOut: async () => {},
        getAccessToken: async () => null,
        refreshMe: async () => null,
        authMessage: UNAVAILABLE,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => readClerkConfig(), []);
  if (!config) return <UnconfiguredAuth>{children}</UnconfiguredAuth>;
  return (
    <ClerkProvider
      publishableKey={config.publishableKey}
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <ClerkBridge config={config}>{children}</ClerkBridge>
    </ClerkProvider>
  );
}

function ClerkBridge({
  config,
  children,
}: {
  config: ClerkPublicConfig;
  children: ReactNode;
}) {
  const { isLoaded, userId, sessionId, getToken } = useClerkAuth({
    treatPendingAsSignedOut: true,
  });
  const clerk = useClerk();
  const qc = useQueryClient();
  const identity = `${userId ?? "anonymous"}:${sessionId ?? "none"}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const previous = useRef<{ identity: string; userId: string | null } | null>(
    null,
  );
  const signedOut = useRef(false);
  const requestId = useRef(0);
  const [localSignOut, setLocalSignOut] = useState(false);
  const [synchronized, setSynchronized] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    if (signedOut.current || !isLoaded || !userId) return null;
    const started = currentIdentity.current;
    try {
      if (started !== identity) throw new Error(EXPIRED);
      const token = await getToken();
      if (started !== currentIdentity.current || signedOut.current)
        throw new Error(EXPIRED);
      if (!token) throw new Error(EXPIRED);
      return token;
    } catch {
      // A failed authenticated request never silently retries as an anonymous request.
      if (started === currentIdentity.current && !signedOut.current)
        setAuthMessage(EXPIRED);
      throw new ApiError(401, {
        error: { code: "sign_in_required", message: EXPIRED },
      });
    }
  }, [isLoaded, userId, getToken, identity]);

  const refreshMe = useCallback(async (): Promise<MeResponse | null> => {
    const started = currentIdentity.current;
    const request = ++requestId.current;
    if (signedOut.current) return null;
    setLoading(true);
    try {
      const next = await api.getMe();
      if (
        started !== currentIdentity.current ||
        signedOut.current ||
        request !== requestId.current
      )
        return null;
      setMe(next);
      setAuthMessage(null);
      return next;
    } catch (error) {
      if (
        started !== currentIdentity.current ||
        signedOut.current ||
        request !== requestId.current
      )
        return null;
      setMe(null);
      setAuthMessage(
        error instanceof ApiError && [401, 403].includes(error.status)
          ? EXPIRED
          : "Your profile could not be loaded. Please try again.",
      );
      return null;
    } finally {
      if (started === currentIdentity.current && request === requestId.current)
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      setTokenGetter(async () => null, "anonymous");
      return;
    }
    const old = previous.current;
    if (old?.identity !== identity) {
      let lastUser = old?.userId ?? null;
      try {
        lastUser ??= sessionStorage.getItem("rivock.auth.lastUser");
      } catch {
        /* Memory comparison still works. */
      }
      if (lastUser && lastUser !== userId) clearRivockDrafts();
      try {
        if (userId) sessionStorage.setItem("rivock.auth.lastUser", userId);
        else sessionStorage.removeItem("rivock.auth.lastUser");
      } catch {
        /* Public identity marker only; no token storage here. */
      }
      void qc.cancelQueries();
      qc.clear();
      setMe(null);
      if (old?.userId !== userId) {
        signedOut.current = false;
        setLocalSignOut(false);
      }
      previous.current = { identity, userId: userId ?? null };
    }
    setTokenGetter(getAccessToken, identity);
    setSynchronized(identity);
    if (userId && !signedOut.current) void refreshMe();
    else {
      setMe(null);
      setLoading(false);
    }
    return () => {
      setTokenGetter(async () => null, "anonymous");
    };
  }, [isLoaded, identity, userId, getAccessToken, refreshMe, qc]);

  useEffect(() => {
    if (!me?.user || window.location.pathname === "/onboarding") return;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(RETURN_PATH_KEY);
      sessionStorage.removeItem(RETURN_PATH_KEY);
    } catch {
      /* Disabled storage. */
    }
    const path = safeReturnPath(stored);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (path && path !== current && path !== "/onboarding")
      window.location.replace(path);
  }, [me?.user?.id]);

  const signIn = useCallback(
    async (returnPath?: string) => {
      if (!isLoaded) {
        setAuthMessage(UNAVAILABLE);
        return;
      }
      const path =
        safeReturnPath(returnPath) ??
        safeReturnPath(
          `${window.location.pathname}${window.location.search}${window.location.hash}`,
        ) ??
        "/";
      try {
        sessionStorage.setItem(RETURN_PATH_KEY, path);
      } catch {
        /* Redirect still uses the explicit safe URL. */
      }
      signedOut.current = false;
      setLocalSignOut(false);
      setAuthMessage(null);
      const destination = new URL(path, window.location.origin).href;
      try {
        await clerk.redirectToSignIn({
          signInForceRedirectUrl: destination,
          signUpForceRedirectUrl: destination,
        });
      } catch {
        setAuthMessage(UNAVAILABLE);
      }
    },
    [clerk, isLoaded],
  );

  const signOut = useCallback(async () => {
    signedOut.current = true;
    requestId.current++;
    setLocalSignOut(true);
    setLoading(false);
    setMe(null);
    void qc.cancelQueries();
    qc.clear();
    clearRivockDrafts();
    setTokenGetter(async () => null, "anonymous");
    setAuthMessage(null);
    try {
      await clerk.signOut({ redirectUrl: window.location.origin });
    } catch {
      setAuthMessage(
        "Sign-out could not reach the sign-in service. Please retry signing out.",
      );
    }
  }, [clerk, qc]);

  const account = useMemo(
    () => (userId && !localSignOut ? { id: userId } : null),
    [userId, localSignOut],
  );
  if (isLoaded && synchronized !== identity)
    return <p role="status">Updating sign-in…</p>;
  return (
    <AuthContext.Provider
      value={{
        configured: true,
        config,
        account,
        me,
        user: localSignOut ? null : (me?.user ?? null),
        loading: !isLoaded || loading,
        signIn,
        signOut,
        getAccessToken,
        refreshMe,
        authMessage: !isLoaded
          ? "Sign-in is loading or unavailable. You can still browse public pages."
          : authMessage,
      }}
    >
      <div key={account?.id ?? "anonymous"}>{children}</div>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
