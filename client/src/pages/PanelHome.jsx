import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { fetchHealth, fetchPanelSites } from "../lib/api.js";

export function PanelHome() {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState({ state: "loading" });
  const [workspaces, setWorkspaces] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchHealth()
      .then((body) => {
        if (active) setHealth({ state: "ready", body });
      })
      .catch(() => {
        if (active) setHealth({ state: "offline" });
      });
    fetchPanelSites()
      .then((body) => {
        if (active) setWorkspaces(body.workspaces);
      })
      .catch((caught) => {
        if (active) setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="panel-shell">
      <aside className="panel-rail">
        <p className="wordmark">Operations</p>
        <p className="rail-note">Campaign websites</p>
        <nav>
          <span className="nav-current">Websites</span>
        </nav>
      </aside>
      <main className="panel-main">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Control panel</p>
            <h1>Websites</h1>
            <p className="lede">{roleLine(user)}</p>
          </div>
          <div className="header-actions">
            <HealthBadge health={health} />
            <button type="button" className="quiet-button" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        </header>
        {error ? <p className="form-error">{error}</p> : null}
        {workspaces
          ? workspaces.map((workspace) => (
              <section key={workspace.id} className="workspace-block">
                <h2>
                  {workspace.name}
                  <span className="role-label">{workspace.role}</span>
                </h2>
                {workspace.sites.length === 0 ? (
                  <p className="empty-line">No websites in this workspace yet.</p>
                ) : (
                  <ul className="site-list">
                    {workspace.sites.map((site) => (
                      <li key={site.id} className="site-row">
                        <div>
                          <p className="site-name">{site.name}</p>
                          <p className="site-meta">{site.client.name}</p>
                          <ul className="language-list">
                            {site.languages.map((language) => (
                              <li key={language.code}>
                                {language.nativeName || language.name}
                                <span> {language.status}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="site-actions">
                          <p className={`badge badge-${site.status}`}>{site.status}</p>
                          <Link to={`/s/${site.slug}/preview`}>Preview</Link>
                          <Link to={`/s/${site.slug}`}>Public page</Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          : <p className="page-loading">Loading websites…</p>}
      </main>
    </div>
  );
}

function roleLine(user) {
  return user.memberships
    .map((membership) => `${membership.role} in ${membership.workspace.name}`)
    .join(" · ");
}

function HealthBadge({ health }) {
  if (health.state === "loading") return <p className="badge">Checking API…</p>;
  if (health.state === "offline") return <p className="badge badge-down">API unreachable</p>;
  if (health.body.database === "up") return <p className="badge badge-up">Database connected</p>;
  return <p className="badge badge-down">Database unavailable</p>;
}
