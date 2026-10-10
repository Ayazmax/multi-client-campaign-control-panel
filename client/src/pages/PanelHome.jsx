import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchHealth } from "../lib/api.js";

export function PanelHome() {
  const [health, setHealth] = useState({ state: "loading" });

  useEffect(() => {
    let active = true;
    fetchHealth()
      .then((body) => {
        if (active) setHealth({ state: "ready", body });
      })
      .catch(() => {
        if (active) setHealth({ state: "offline" });
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
          </div>
          <HealthBadge health={health} />
        </header>
        <section className="empty-card">
          <h2>No campaign websites yet</h2>
          <p>
            This panel will list client sites after example data is seeded.
            Publishing, languages, and shared edits come in later phases.
          </p>
          <Link className="text-link" to="/s/example">
            Open the public site shell
          </Link>
        </section>
      </main>
    </div>
  );
}

function HealthBadge({ health }) {
  if (health.state === "loading") {
    return <p className="badge">Checking API…</p>;
  }
  if (health.state === "offline") {
    return <p className="badge badge-down">API unreachable</p>;
  }
  if (health.body.database === "up") {
    return <p className="badge badge-up">Database connected</p>;
  }
  return <p className="badge badge-down">Database unavailable</p>;
}
