import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./auth.jsx";
import { Login } from "./pages/Login.jsx";
import { PanelHome } from "./pages/PanelHome.jsx";
import { PublicSite } from "./pages/PublicSite.jsx";

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
        <Route path="/s/:siteSlug" element={<PublicSite />} />
        <Route
          path="/s/:siteSlug/preview"
          element={
            <RequireAuth>
              <PublicSite preview />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
