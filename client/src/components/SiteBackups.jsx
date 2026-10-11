import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchBackup, fetchBackups, restoreBackup } from "../lib/api.js";
import { ChangeTable } from "./ChangeTable.jsx";
import { PanelFrame } from "./PanelFrame.jsx";

export function SiteBackups() {
  const { slug } = useParams();
  const [body, setBody] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchBackups(slug)
      .then((next) => {
        if (active) setBody(next);
      })
      .catch((caught) => {
        if (active) setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <PanelFrame back title="Backups" lede={body ? body.site.name : "Loading backups."}>
      {error ? <p className="form-error">{error}</p> : null}
      {!body && !error ? <p className="page-loading">Loading backups…</p> : null}
      {body?.backups.length === 0 ? <p className="empty-line">This website has no backup yet.</p> : null}
      <div className="history-list">
        {body?.backups.map((backup) => (
          <article key={backup.id} className="history-row">
            <p>{backup.label}</p>
            <p className="site-meta">Saved by {backup.actor}</p>
            <Link to={`/app/sites/${slug}/backups/${backup.id}`}>Review this backup</Link>
          </article>
        ))}
      </div>
    </PanelFrame>
  );
}

export function BackupReview() {
  const { slug, backupId } = useParams();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchBackup(slug, backupId)
      .then((body) => {
        if (active) setPreview(body);
      })
      .catch((caught) => {
        if (active) setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, [slug, backupId]);

  function onConfirm() {
    setBusy(true);
    setError("");
    restoreBackup(slug, backupId)
      .then((body) => setDone(body.sentence))
      .catch((caught) => setError(caught.message))
      .finally(() => setBusy(false));
  }

  return (
    <PanelFrame back title="Restore a backup" lede={preview ? preview.warning : "Loading this backup."}>
      {error ? <p className="form-error">{error}</p> : null}
      {!preview && !error ? <p className="page-loading">Loading this backup…</p> : null}
      {preview ? (
        <section className="editor-card record-card">
          <h2>{preview.backup.label}</h2>
          <p className="site-meta">Saved by {preview.backup.actor}</p>
          <ChangeTable changes={preview.changes} empty="The website already matches this backup." />
          {done ? <p className="form-notice">{done}</p> : (
            <div className="editor-actions">
              <button type="button" className="solid-button" disabled={busy} onClick={onConfirm}>
                {busy ? "Restoring…" : "Restore this backup"}
              </button>
            </div>
          )}
          <div className="editor-actions">
            <Link to={`/app/sites/${slug}/backups`}>All backups</Link>
            <Link to={`/app/sites/${slug}`}>Website</Link>
          </div>
        </section>
      ) : null}
    </PanelFrame>
  );
}
