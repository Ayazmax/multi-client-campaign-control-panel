import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { cloneSite, fetchPanelSite } from "../lib/api.js";
import { PanelFrame } from "./PanelFrame.jsx";

export function CloneCampaign() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [source, setSource] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPanelSite(slug)
      .then((body) => {
        if (!active) return;
        setSource(body.site);
        setName(`${body.site.name} copy`);
      })
      .catch((caught) => {
        if (active) setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = await cloneSite(slug, name);
      navigate(`/app/sites/${body.site.slug}`);
    } catch (caught) {
      setError(caught.message);
      setBusy(false);
    }
  }

  return (
    <PanelFrame
      back
      title="Create campaign"
      lede={source ? `From ${source.name}` : "Copy a website into a new draft."}
    >
      {source ? (
        <form className="editor-card" onSubmit={onSubmit}>
          <p>
            The new website starts as a draft. Public wording, offers, and colours are copied.
            Private notes and analytics IDs stay behind. {source.name} is left unchanged.
          </p>
          <label>
            Campaign name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="editor-actions">
            <button type="submit" className="solid-button" disabled={busy}>
              {busy ? "Creating…" : "Create draft"}
            </button>
            <Link to="/app">Cancel</Link>
          </div>
        </form>
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : (
        <p className="page-loading">Loading website…</p>
      )}
    </PanelFrame>
  );
}
