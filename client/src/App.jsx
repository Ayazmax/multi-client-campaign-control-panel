import { Navigate, Route, Routes } from "react-router-dom";
import { PanelHome } from "./pages/PanelHome.jsx";
import { PublicSite } from "./pages/PublicSite.jsx";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/app" element={<PanelHome />} />
      <Route path="/s/:siteSlug" element={<PublicSite />} />
      <Route path="/s/:siteSlug/preview" element={<PublicSite preview />} />
    </Routes>
  );
}
