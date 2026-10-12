import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchVersion, restoreVersion } from "../lib/api.js";
import { ChangeTable } from "./ChangeTable.jsx";
import { PanelFrame } from "./PanelFrame.jsx";

export function RestoreVersion() {
  const { slug, snapshotId } = useParams();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchVersion(slug, snapshotId)
      .then((body) => {
        if (active) setPreview(body);
      })
      .catch((caught) => {
        if (active) setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, [slug, snapshotId]);

  function onConfirm() {
    setBusy(true);
    setError("");
    restoreVersion(slug, snapshotId)
      .then((body) => setDone(body.sentence))
      .catch((caught) => setError(caught.message))
      .finally(() => setBusy(false));
  }

  return (
    <PanelFrame back help="restore" title="Restore a version" lede={preview ? preview.warning : "Loading this version."}>
      {error ? <p className="form-error">{error}</p> : null}
      {!preview && !error ? <p className="page-loading">Loading this version…</p> : null}
      {preview ? (
        <section className="editor-card record-card">
          <h2>{preview.live ? "This version is live" : "Earlier version"}</h2>
          <p>{preview.sentence}</p>
          <ChangeTable changes={preview.changes} empty="This version matches what is published now." />
          {done ? (
            <p className="form-notice">{done}</p>
          ) : preview.live ? null : (
            <div className="editor-actions">
              <button type="button" className="solid-button" disabled={busy} onClick={onConfirm}>
                {busy ? "Restoring…" : "Restore this version"}
              </button>
            </div>
          )}
          <div className="editor-actions">
            <Link to={`/app/history?site=${slug}`}>History</Link>
            <Link to={`/app/sites/${slug}`}>Website</Link>
            <Link to={`/s/${slug}`}>Public page</Link>
          </div>
        </section>
      ) : null}
    </PanelFrame>
  );
}
