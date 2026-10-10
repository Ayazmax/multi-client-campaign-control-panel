import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export function PanelFrame({ title, lede, actions, children }) {
  const { logout } = useAuth();
  return (
    <div className="panel-shell">
      <aside className="panel-rail">
        <p className="wordmark">Operations</p>
        <p className="rail-note">Campaign websites</p>
        <nav>
          <Link to="/app">Websites</Link>
        </nav>
      </aside>
      <main className="panel-main">
        <header className="panel-header">
          <div>
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
