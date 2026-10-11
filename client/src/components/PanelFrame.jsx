import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { notePanelVisit, panelBackTarget, stepBack } from "../lib/panelTrail.js";

export function PanelNav({ section }) {
  return (
    <>
      {section === "websites" ? (
        <span className="nav-current">Websites</span>
      ) : (
        <Link className="nav-quiet" to="/app">Websites</Link>
      )}
      {section === "bulk" ? (
        <span className="nav-current">Update several</span>
      ) : (
        <Link className="nav-quiet" to="/app/bulk">Update several</Link>
      )}
    </>
  );
}

export function PanelFrame({ title, lede, actions, section = "websites", back = false, children }) {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  useEffect(() => {
    notePanelVisit(path);
  }, [path]);

  const destination = back ? panelBackTarget(path) : null;

  function onBack() {
    const target = stepBack(path);
    if (target) navigate(target);
  }

  return (
    <div className="panel-shell">
      <aside className="panel-rail">
        <p className="wordmark">Operations</p>
        <p className="rail-note">Campaign websites</p>
        <nav>
          <PanelNav section={section} />
        </nav>
      </aside>
      <main className="panel-main">
        <header className="panel-header">
          <div>
            {destination ? (
              <button type="button" className="back-link" onClick={onBack}>
                Back
              </button>
            ) : null}
            <p className="eyebrow">Control panel</p>
            <h1>{title}</h1>
            {lede ? <p className="lede">{lede}</p> : null}
          </div>
          <div className="header-actions">
            {actions}
            <button type="button" className="quiet-button" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
