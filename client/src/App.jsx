import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./auth.jsx";
import { CloneCampaign } from "./pages/CloneCampaign.jsx";
import { Login } from "./pages/Login.jsx";
import { PanelHome } from "./pages/PanelHome.jsx";
import { PublicSite } from "./pages/PublicSite.jsx";
import { SiteEditor } from "./pages/SiteEditor.jsx";

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
