import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./auth.jsx";
import { BulkUpdate } from "./components/BulkUpdate.jsx";
import { CloneCampaign } from "./components/CloneCampaign.jsx";
import { HistoryList } from "./components/HistoryList.jsx";
import { MoveSite } from "./components/MoveSite.jsx";
import { PanelHome } from "./components/PanelHome.jsx";
import { RestoreVersion } from "./components/RestoreVersion.jsx";
import { BackupReview, SiteBackups } from "./components/SiteBackups.jsx";
import { SiteEditor } from "./components/SiteEditor.jsx";
import { Login } from "./pages/Login.jsx";
import { PublicSite } from "./pages/PublicSite.jsx";

// Routes only. The website list is components/PanelHome.jsx.
// The campaign form is components/SiteEditor.jsx.
// A change across websites is components/BulkUpdate.jsx.
// The public website is pages/CampaignSite.jsx.
export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/app/login" element={<Login />} />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <PanelHome />
            </RequireAuth>
          }
        />
        <Route
          path="/app/bulk"
          element={
            <RequireAuth>
              <BulkUpdate />
            </RequireAuth>
          }
        />
        <Route
          path="/app/history"
          element={
            <RequireAuth>
              <HistoryList />
            </RequireAuth>
          }
        />
        <Route
          path="/app/sites/:slug/restore/:snapshotId"
          element={
            <RequireAuth>
              <RestoreVersion />
            </RequireAuth>
          }
        />
        <Route
          path="/app/sites/:slug/backups/:backupId"
          element={
            <RequireAuth>
              <BackupReview />
            </RequireAuth>
          }
        />
        <Route
          path="/app/sites/:slug/backups"
          element={
            <RequireAuth>
              <SiteBackups />
            </RequireAuth>
          }
        />
        <Route
          path="/app/sites/:slug/move"
          element={
            <RequireAuth>
              <MoveSite />
            </RequireAuth>
          }
        />
        <Route
          path="/app/sites/:slug/clone"
          element={
            <RequireAuth>
              <CloneCampaign />
            </RequireAuth>
          }
        />
        <Route
          path="/app/sites/:slug"
          element={
            <RequireAuth>
              <SiteEditor />
            </RequireAuth>
          }
        />
        <Route
          path="/s/:siteSlug/preview/:page?"
          element={
            <RequireAuth>
              <PublicSite preview />
            </RequireAuth>
          }
        />
        <Route path="/s/:siteSlug/:page?" element={<PublicSite />} />
      </Routes>
    </AuthProvider>
  );
}
