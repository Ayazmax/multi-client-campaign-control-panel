import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { fetchPanelSite, publishSite, saveSite } from "../lib/api.js";
import { PanelFrame } from "./PanelFrame.jsx";

const SECTIONS = [
  { key: "home", title: "Home" },
  { key: "offers", title: "Offers page" },
  { key: "contact", title: "Contact" },
];

export function SiteEditor() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [site, setSite] = useState(null);
  const [language, setLanguage] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPanelSite(slug)
      .then((body) => {
        if (!active) return;
        setSite(body.site);
        setLanguage(body.site.languages[0]?.code || "en");
      })
      .catch((caught) => {
        if (active) setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const role = site
    ? user.memberships.find((item) => item.workspace.slug === site.workspace.slug)?.role
    : "";
  const canEdit = role === "owner" || role === "editor";
  const canPublish = role === "owner" || role === "reviewer";

  function updateTheme(key, value) {
    setSite((current) => ({ ...current, theme: { ...current.theme, [key]: value } }));
  }

  function updateField(key, draftValue) {
    setSite((current) => ({
      ...current,
      fields: current.fields.map((field) =>
        field.key === key && field.language === language ? { ...field, draftValue } : field,
      ),
    }));
  }

  function updateOffer(key, value) {
    setSite((current) => ({
      ...current,
      offers: current.offers.map((offer) =>
        offer.language === language ? { ...offer, [key]: value } : offer,
      ),
    }));
  }

  async function onSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = await saveSite(site.slug, {
        theme: site.theme,
        fields: site.fields
          .filter((field) => !field.sensitive)
          .map((field) => ({
            key: field.key,
            language: field.language,
            draftValue: field.draftValue,
            revision: field.revision,
          })),
        offers: site.offers.map((offer) => ({
          code: offer.code,
          language: offer.language,
          draftLabel: offer.draftLabel,
          draftPrice: offer.draftPrice,
          revision: offer.revision,
        })),
      });
      setSite(body.site);
      setNotice("Draft saved.");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    setPublishing(true);
    setError("");
    try {
      const body = await publishSite(site.slug);
      setSite(body.site);
      setNotice(body.sentence);
      setConfirming(false);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPublishing(false);
    }
  }

  const visibleFields = site
    ? site.fields.filter((field) => field.language === language && !field.sensitive)
    : [];
  const offer = site?.offers.find((item) => item.language === language);

  return (
    <PanelFrame
      title={site?.name || "Website"}
      lede={site ? `${site.client.name} · ${site.status}` : "Loading the draft."}
      actions={
        site ? (
          <Link to={`/s/${site.slug}/preview`}>Preview</Link>
        ) : null
      }
    >
      {!site && error ? <p className="form-error">{error}</p> : null}
      {!site && !error ? <p className="page-loading">Loading website…</p> : null}
      {site ? (
        <form className="editor-form" onSubmit={onSave}>
          <section className="editor-card">
            <h2>Branding</h2>
            <div className="field-grid">
              <ColorField
                label="Primary colour"
                value={site.theme?.primaryColor || "#000000"}
                disabled={!canEdit}
                onChange={(value) => updateTheme("primaryColor", value)}
              />
              <ColorField
                label="Secondary colour"
                value={site.theme?.secondaryColor || "#000000"}
                disabled={!canEdit}
                onChange={(value) => updateTheme("secondaryColor", value)}
              />
              <ColorField
                label="Accent colour"
                value={site.theme?.accentColor || "#000000"}
                disabled={!canEdit}
                onChange={(value) => updateTheme("accentColor", value)}
              />
              <label>
                Font
                <input
                  value={site.theme?.fontFamily || ""}
                  disabled={!canEdit}
                  onChange={(event) => updateTheme("fontFamily", event.target.value)}
                />
              </label>
              <label>
                Logo address
                <input
                  value={site.theme?.logoUrl || ""}
                  disabled={!canEdit}
                  placeholder="https://"
                  onChange={(event) => updateTheme("logoUrl", event.target.value)}
                />
              </label>
            </div>
          </section>

          {site.languages.length > 1 ? (
            <div className="lang-tabs" role="tablist">
              {site.languages.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className={item.code === language ? "lang-tab is-active" : "lang-tab"}
                  onClick={() => setLanguage(item.code)}
                >
                  {item.nativeName || item.name}
                </button>
              ))}
            </div>
          ) : null}

          {SECTIONS.map((section) => (
            <section key={section.key} className="editor-card">
              <h2>{section.title}</h2>
              <div className="field-grid">
                {section.key === "offers" && offer ? (
                  <>
                    <label>
                      Offer name
                      <input
                        value={offer.draftLabel || ""}
                        disabled={!canEdit}
                        onChange={(event) => updateOffer("draftLabel", event.target.value)}
                      />
                    </label>
                    <label>
                      Offer price
                      <input
                        value={offer.draftPrice || ""}
                        disabled={!canEdit}
                        onChange={(event) => updateOffer("draftPrice", event.target.value)}
                      />
                    </label>
                  </>
                ) : null}
                {visibleFields
                  .filter((field) => field.pageKey === section.key)
                  .map((field) => (
                    <FieldControl
                      key={field.key}
                      field={field}
                      disabled={!canEdit}
                      onChange={(value) => updateField(field.key, value)}
                    />
                  ))}
              </div>
            </section>
          ))}

          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}

          <div className="editor-actions">
            {canEdit ? (
              <button type="submit" className="solid-button" disabled={saving}>
                {saving ? "Saving…" : "Save draft"}
              </button>
            ) : (
              <p className="site-meta">An editor or owner saves changes.</p>
            )}
            <Link to={`/s/${site.slug}/preview`}>Preview</Link>
            {site.status === "live" ? <Link to={`/s/${site.slug}`}>Public page</Link> : null}
          </div>

          {canPublish ? (
            <section className="editor-card">
              <h2>Publish</h2>
              {confirming ? (
                <>
                  <p>
                    This writes a snapshot and makes the draft the public page for {site.name}.
                  </p>
                  <div className="editor-actions">
                    <button type="button" className="solid-button" disabled={publishing} onClick={onPublish}>
                      {publishing ? "Publishing…" : "Publish now"}
                    </button>
                    <button type="button" className="quiet-button" onClick={() => setConfirming(false)}>
                      Back
                    </button>
                  </div>
                </>
              ) : (
                <button type="button" className="solid-button" onClick={() => setConfirming(true)}>
                  Publish
                </button>
              )}
            </section>
          ) : (
            <p className="site-meta">An owner or reviewer publishes this website.</p>
          )}
        </form>
      ) : null}
    </PanelFrame>
  );
}

function ColorField({ label, value, disabled, onChange }) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <label>
      {label}
      <span className="color-row">
        <input
          type="color"
          value={hex}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
        />
        <input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

function FieldControl({ field, disabled, onChange }) {
  const long = /subtitle|description|intro|address/.test(field.key);
  const image = field.key.endsWith("image");
  return (
    <label>
      {field.label}
      {long ? (
        <textarea
          rows={3}
          value={field.draftValue}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type={image ? "url" : "text"}
          value={field.draftValue}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
