import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Bookmark,
  Home,
  Menu,
  PenSquare,
  Settings,
  Shield,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import styles from "../styles/layout.module.css";

function useTopics() {
  return useQuery({
    queryKey: ["topics"],
    queryFn: () => api.getTopics(false),
  });
}

export function Layout() {
  const { configured, account, user, signIn, signOut, authMessage, me } =
    useAuth();
  const topics = useTopics();
  const info = useQuery({
    queryKey: ["info"],
    queryFn: () => api.getInfo(),
    staleTime: 60000,
  });
  const unread = useQuery({
    queryKey: ["unread"],
    queryFn: () => api.unreadCount(),
    enabled: !!user && user.status === "active",
    refetchInterval: () =>
      document.visibilityState === "visible" ? 30000 : false,
  });
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (me?.onboarding_required && account) navigate("/onboarding");
  }, [me, account, navigate]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const nav = [
    { to: "/", label: "Feed", icon: Home, end: true },
    { to: "/new", label: "New", icon: PenSquare },
    { to: "/saved", label: "Saved", icon: Bookmark },
    { to: "/notifications", label: "Alerts", icon: Bell },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="appShell">
      <aside className={styles.sidebar} aria-label="Primary">
        <Link to="/" className={styles.brand}>
          Rivock
        </Link>
        <nav className={styles.nav}>
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.linkActive : ""}`
              }
            >
              <Icon size={18} aria-hidden /> {label}
              {to === "/notifications" && !!unread.data?.count && (
                <span className="badge">{unread.data.count}</span>
              )}
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.linkActive : ""}`
              }
            >
              <Shield size={18} aria-hidden /> Admin
            </NavLink>
          )}
        </nav>
        <div className={styles.topics}>
          <p className="muted">Topics</p>
          {topics.isLoading && <p className="muted">Loading topics…</p>}
          {topics.error && <p className="muted">Topics unavailable.</p>}
          {topics.data
            ?.filter((t) => t.is_active)
            .map((t) => (
              <NavLink
                key={t.id}
                to={`/t/${t.slug}`}
                className={({ isActive }) =>
                  `${styles.link} ${isActive ? styles.linkActive : ""}`
                }
              >
                {t.name}
              </NavLink>
            ))}
        </div>
      </aside>

      <div>
        <header className={styles.mobileBar}>
          <Link to="/" className={styles.brand}>
            Rivock
          </Link>
          <div
            className={styles.menu}
            ref={menuRef}
            onKeyDown={(event) => {
              if (event.key === "Escape" && open) {
                event.stopPropagation();
                setOpen(false);
                menuButtonRef.current?.focus();
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setOpen(false);
            }}
          >
            <button
              type="button"
              className="btn"
              ref={menuButtonRef}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((v) => !v)}
            >
              <Menu size={18} aria-hidden /> Menu
            </button>
            {open && (
              <nav
                className={styles.menuPanel}
                id="mobile-menu"
                aria-label="Topics and account"
              >
                {topics.data?.map((t) => (
                  <Link
                    key={t.id}
                    to={`/t/${t.slug}`}
                    onClick={() => setOpen(false)}
                  >
                    {t.name}
                  </Link>
                ))}
                {user?.role === "admin" && (
                  <Link to="/admin" onClick={() => setOpen(false)}>
                    Admin
                  </Link>
                )}
                {user ? (
                  <>
                    <Link
                      to={`/u/${user.username}`}
                      onClick={() => setOpen(false)}
                    >
                      Profile
                    </Link>
                    <Link to="/submissions" onClick={() => setOpen(false)}>
                      Submissions
                    </Link>
                    <button type="button" onClick={() => void signOut()}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!configured) {
                        window.alert(authMessage);
                        return;
                      }
                      void signIn();
                    }}
                  >
                    Sign in
                  </button>
                )}
              </nav>
            )}
          </div>
        </header>

        <div className="main">
          {import.meta.env.VITE_APP_ENVIRONMENT === "preview" && (
            <p className="badge" role="status">
              Rivock Preview — a test site. Please use fictional content.
            </p>
          )}
          <div
            className="row"
            style={{ justifyContent: "space-between", marginBottom: "1rem" }}
          >
            <div />
            <div className="row">
              {user ? (
                <>
                  <Link to={`/u/${user.username}`}>{user.username}</Link>
                  <Link to="/submissions">Submissions</Link>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void signOut()}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={() => {
                    if (!configured) {
                      window.alert(authMessage);
                      return;
                    }
                    void signIn();
                  }}
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
          {!configured && (
            <p className="muted" style={{ marginTop: 0 }}>
              You can explore public conversations. Sign-in is not available
              yet.
            </p>
          )}
          {configured && authMessage && <p role="status">{authMessage}</p>}
          {user && user.status !== "active" && (
            <p role="status">
              Your account is {user.status}. Participation is unavailable.
            </p>
          )}
          {info.data?.local_fixture_moderation && (
            <p className="badge" role="status">
              Local demo: moderation checks use a deterministic fixture.
            </p>
          )}
          <Outlet />
          <footer style={{ marginTop: "2rem" }}>
            <Link to="/privacy">Privacy and participation</Link>
          </footer>
        </div>

        <nav className={styles.mobileNav} aria-label="Mobile">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={18} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
