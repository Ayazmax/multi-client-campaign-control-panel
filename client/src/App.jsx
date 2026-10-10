import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./auth.jsx";
import { CloneCampaign } from "./components/CloneCampaign.jsx";
import { PanelHome } from "./components/PanelHome.jsx";
import { SiteEditor } from "./components/SiteEditor.jsx";
import { Login } from "./pages/Login.jsx";
import { PublicSite } from "./pages/PublicSite.jsx";

// Routes only. The website list is components/PanelHome.jsx.
// The campaign form is components/SiteEditor.jsx.
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
