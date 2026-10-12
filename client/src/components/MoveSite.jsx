import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchTransfer, transferSite } from "../lib/api.js";
import { PanelFrame } from "./PanelFrame.jsx";

export function MoveSite() {
  const { slug } = useParams();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchTransfer(slug)
      .then((body) => {
        if (active) setPreview(body);
      })
      .catch((caught) => {
        if (active) setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  function onConfirm() {
    setBusy(true);
    setError("");
    transferSite(slug)
      .then((body) => setDone(body.sentence))
      .catch((caught) => setError(caught.message))
      .finally(() => setBusy(false));
  }

  return (
    <PanelFrame back help="move" title="Move website" lede={preview ? preview.warning : "Loading the move."}>
      {error ? <p className="form-error">{error}</p> : null}
      {!preview && !error ? <p className="page-loading">Loading the move…</p> : null}
      {preview ? (
        <section className="editor-card record-card">
          <h2>
            {preview.site.name} to {preview.to}
          </h2>
          <p>
            {preview.client} stays the client. Home, Offers, and Contact are not rebuilt.
          </p>
          <h3>Left behind</h3>
          {preview.stripped.length ? (
            <ul className="leftover-list">
              {preview.stripped.map((row) => (
                <li key={`${row.label}-${row.language || ""}`}>
                  <span>{row.label}{row.language ? ` · ${row.language}` : ""}</span>
                  <span>{row.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>This website has no analytics IDs, internal notes, or private fields.</p>
          )}
          {done ? <p className="form-notice">{done}</p> : (
            <div className="editor-actions">
              <button type="button" className="solid-button" disabled={busy} onClick={onConfirm}>
                {busy ? "Moving…" : `Move to ${preview.to}`}
              </button>
            </div>
          )}
          <div className="editor-actions">
            <Link to={`/app/sites/${slug}`}>Website</Link>
            <Link to="/app">Websites</Link>
          </div>
        </section>
      ) : null}
    </PanelFrame>
  );
}
