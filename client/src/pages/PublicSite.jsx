import { Link, useParams } from "react-router-dom";

export function PublicSite({ preview = false }) {
  const { siteSlug } = useParams();

  return (
    <div className="public-shell">
      <header className="public-bar">
        <p className="wordmark">Campaign site</p>
        <p className="slug">{siteSlug}</p>
        {preview ? <p className="preview-flag">Draft preview</p> : null}
      </header>
      <main className="public-empty">
        <p className="eyebrow">{preview ? "Staff preview" : "Public page"}</p>
        <h1>Nothing is published for this website yet</h1>
        <p>
          {preview
            ? "Draft preview will show unpublished content to signed-in staff. Sign-in is not part of this phase."
            : "Visitors will see the master template here once a website is published from the control panel."}
        </p>
        <Link className="text-link" to="/app">
          Back to operations
        </Link>
      </main>
    </div>
  );
}
