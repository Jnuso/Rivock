import { lazy, Suspense } from "react";
import { Loading } from "./components/States";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { FeedPage } from "./pages/FeedPage";
import { PrivacyPage } from "./pages/PrivacyPage";
const ThreadPage = lazy(() =>
  import("./pages/ThreadPage").then((m) => ({ default: m.ThreadPage })),
);
const ComposerPage = lazy(() =>
  import("./pages/ComposerPage").then((m) => ({ default: m.ComposerPage })),
);
const OnboardingPage = lazy(() =>
  import("./pages/OnboardingPage").then((m) => ({ default: m.OnboardingPage })),
);
const SubmissionsListPage = lazy(() =>
  import("./pages/SubmissionsPage").then((m) => ({
    default: m.SubmissionsListPage,
  })),
);
const SubmissionDetailPage = lazy(() =>
  import("./pages/SubmissionsPage").then((m) => ({
    default: m.SubmissionDetailPage,
  })),
);
const SavedPage = lazy(() =>
  import("./pages/SavedPage").then((m) => ({ default: m.SavedPage })),
);
const NotificationsPage = lazy(() =>
  import("./pages/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const AdminPage = lazy(() =>
  import("./pages/AdminPage").then((m) => ({ default: m.AdminPage })),
);

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<FeedPage />} />
            <Route path="t/:topicSlug" element={<FeedPage />} />
            <Route path="threads/:id" element={<ThreadPage />} />
            <Route
              path="threads/:id/edit"
              element={<ComposerPage mode="edit" />}
            />
            <Route path="new" element={<ComposerPage mode="new" />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="submissions" element={<SubmissionsListPage />} />
            <Route path="submissions/:id" element={<SubmissionDetailPage />} />
            <Route path="saved" element={<SavedPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="u/:username" element={<ProfilePage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
