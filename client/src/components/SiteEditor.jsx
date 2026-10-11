// Campaign form. Branding, text, offers, contact, languages, and publish controls live here.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { addSiteLanguage, createBackup, fetchPanelSite, importTranslation, publishSite, saveSite } from "../lib/api.js";
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
  const [missing, setMissing] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [language, setLanguage] = useState("");
  const [languageToAdd, setLanguageToAdd] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    let active = true;
    fetchPanelSite(slug)
      .then((body) => {
        if (!active) return;
        remember(body);
        setLanguage(body.site.languages[0]?.code || "en");
        const used = new Set(body.site.languages.map((item) => item.code));
        setLanguageToAdd(body.catalog.find((item) => !used.has(item.code))?.code || "");
      })
      .catch((caught) => {
        if (active) setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  function remember(body) {
    setSite(body.site);
    setMissing(body.missing || []);
    if (body.catalog) setCatalog(body.catalog);
    return body;
  }

  const role = site
    ? user.memberships.find((item) => item.workspace.slug === site.workspace.slug)?.role
    : "";
  const canEdit = role === "owner" || role === "editor";
  const canPublish = role === "owner" || role === "reviewer";
  const destination = site
    ? user.memberships.find((item) => item.role === "owner" && item.workspace.id !== site.workspace.id)
    : null;

  async function onBackup() {
    setError("");
    setNotice("");
    try {
      const body = await createBackup(slug);
      setNotice(body.sentence);
    } catch (caught) {
      setError(caught.message);
    }
  }

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

  async function sendSave(revisions) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await remember(await saveSite(site.slug, payloadFrom(site, revisions)));
      setConflict(null);
      setNotice("Draft saved.");
    } catch (caught) {
      if (caught.conflict) setConflict(caught.conflict);
      else setError(caught.message);
    } finally {
      setSaving(false);
    }
  }

  async function onSave(event) {
    event.preventDefault();
    await sendSave();
  }

  async function onReload() {
    setError("");
    setNotice("");
    try {
      remember(await fetchPanelSite(site.slug));
      setConflict(null);
      setNotice("Reloaded their version.");
    } catch (caught) {
      setError(caught.message);
    }
  }

  async function onPublish() {
    setPublishing(true);
    setError("");
    try {
      const body = remember(
        await publishSite(site.slug, site.status === "draft" ? undefined : language),
      );
      setNotice(body.sentence);
      setConfirming(false);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPublishing(false);
    }
  }

  async function onAddLanguage() {
    setError("");
    setNotice("");
    try {
      const body = remember(await addSiteLanguage(site.slug, languageToAdd));
      setLanguage(languageToAdd);
      const added = body.catalog.find((item) => item.code === languageToAdd);
      const next = body.catalog.find((item) => !body.site.languages.some((row) => row.code === item.code));
      setLanguageToAdd(next?.code || "");
      setNotice(`${added?.name || "The language"} is a draft. Visitors cannot switch to it until it is published.`);
    } catch (caught) {
      setError(caught.message);
    }
  }

  async function sendImport(parsed) {
    setImporting(true);
    setError("");
    setNotice("");
    try {
      const languageCode = typeof parsed?.language === "string" ? parsed.language : language;
      const fields = parsed?.fields && typeof parsed.fields === "object" ? parsed.fields : parsed;
      const body = remember(await importTranslation(site.slug, { language: languageCode, fields }));
      setLanguage(languageCode);
      const skipped = body.ignored?.length ? ` ${body.ignored.length} keys were skipped.` : "";
      setNotice(`Imported ${body.filled} slots. ${body.missingCount} are still missing.${skipped}`);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setImporting(false);
    }
  }

  async function onImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await sendImport(JSON.parse(await file.text()));
    } catch {
      setError("That file is not valid JSON.");
    }
  }

  async function onSuppliedFile() {
    const parsed = await fetch("/samples/lanka-homes-si.json").then((response) => response.json());
    await sendImport(parsed);
  }

  const visibleFields = site
    ? site.fields.filter((field) => field.language === language && !field.sensitive)
    : [];
  const offer = site?.offers.find((item) => item.language === language);
  const currentLanguage = site?.languages.find((item) => item.code === language);
  const available = catalog.filter((item) => !site?.languages.some((row) => row.code === item.code));
  const publishOnly = site?.status !== "draft";
  const included = site ? fieldsToPublish(site, language, !publishOnly) : [];
  const previewHref = site ? `/s/${site.slug}/preview?lang=${language}` : "/app";

  return (
    <PanelFrame
      back
      title={site?.name || "Website"}
      lede={site ? `${site.client.name} · ${site.status}` : "Loading the draft."}
      actions={site ? <Link to={previewHref}>Preview</Link> : null}
    >
      {!site && error ? <p className="form-error">{error}</p> : null}
      {!site && !error ? <p className="page-loading">Loading website…</p> : null}
      {site ? (
        <>
        <section className="editor-card site-safeguards">
          <h2>History and copies</h2>
          <div className="editor-actions">
            <Link to={`/app/history?site=${site.slug}`}>History</Link>
            {role === "owner" ? (
              <>
                <button type="button" className="solid-button" onClick={onBackup}>
                  Back up this website
                </button>
                <Link to={`/app/sites/${site.slug}/backups`}>Restore a backup</Link>
                {destination ? <Link to={`/app/sites/${site.slug}/move`}>Move to {destination.workspace.name}</Link> : null}
              </>
            ) : null}
          </div>
        </section>
        <form className="editor-form site-review" onSubmit={onSave}>
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

          <section className="editor-card">
            <h2>Languages</h2>
            <ul className="language-list">
              {site.languages.map((item) => (
                <li key={item.code}>
                  <button type="button" className="texty" onClick={() => setLanguage(item.code)}>
                    {item.nativeName || item.name}
                  </button>
                  <span> {item.status}</span>
                </li>
              ))}
            </ul>
            {canEdit && available.length > 0 ? (
              <div className="editor-actions">
                <label>
                  Add a language
                  <select value={languageToAdd} onChange={(event) => setLanguageToAdd(event.target.value)}>
                    {available.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.nativeName || item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="solid-button" onClick={onAddLanguage} disabled={!languageToAdd}>
                  Add language
                </button>
              </div>
            ) : null}
            {canEdit ? (
              <div className="field-grid">
                <label>
                  Import a translation file
                  <input type="file" accept="application/json,.json" onChange={onImportFile} disabled={importing} />
                </label>
                <p>
                  The file is JSON keyed by field id, such as home.hero.title. It fills the draft for that
                  language. Private fields are skipped.
                </p>
                {site.slug === "lanka-homes" ? (
                  <button type="button" className="solid-button" onClick={onSuppliedFile} disabled={importing}>
                    {importing ? "Importing…" : "Import supplied Sinhala file"}
                  </button>
                ) : null}
              </div>
            ) : null}
            <h3>Missing translations</h3>
            {missing.length === 0 ? (
              <p>Every slot has a draft.</p>
            ) : (
              <ul className="missing-list">
                {missing.map((item) => (
                  <li key={`${item.languageCode}-${item.key}`}>
                    <span>{item.language}</span>
                    <span>{item.page}</span>
                    <span>{item.field}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to={previewHref}>Preview {currentLanguage?.nativeName || "this language"}</Link>
          </section>

          {site.languages.length > 1 ? (
            <div className="lang-tabs span-row" role="tablist">
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

          {!canPublish ? (
            <p className="site-meta review-note span-row">An owner or reviewer publishes this website.</p>
          ) : null}

          {conflict ? (
            <section className="editor-card conflict-card span-row">
              <h2>Someone else saved this</h2>
              <p>
                {conflict.savedBy?.length ? conflict.savedBy.join(" and ") : "Someone else"} saved this while you were editing.
                Nothing was overwritten.
              </p>
              {conflict.rows?.length ? (
                <table className="conflict-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Language</th>
                      <th>Your version</th>
                      <th>Their version</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflict.rows.map((row) => (
                      <tr key={`${row.kind}-${row.languageCode}-${row.key}`}>
                        <td>{row.label}</td>
                        <td>{row.language}</td>
                        <td>{row.yours}</td>
                        <td>{row.theirs}{row.savedBy ? ` · ${row.savedBy}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>Your copy is out of date.</p>
              )}
              <div className="editor-actions">
                <button type="button" className="solid-button" disabled={saving} onClick={() => sendSave(conflict.revisions)}>
                  {saving ? "Saving…" : "Keep mine"}
                </button>
                <button type="button" className="quiet-button" onClick={onReload}>
                  Reload
                </button>
              </div>
            </section>
          ) : null}

          {error ? <p className="form-error span-row">{error}</p> : null}
          {notice ? <p className="form-notice span-row">{notice}</p> : null}

          <div className="editor-actions span-row">
            {canEdit ? (
              <button type="submit" className="solid-button" disabled={saving}>
                {saving ? "Saving…" : "Save draft"}
              </button>
            ) : (
              <p className="site-meta">An editor or owner saves changes.</p>
            )}
            <Link to={previewHref}>Preview</Link>
            {site.status === "live" ? <Link to={`/s/${site.slug}`}>Public page</Link> : null}
          </div>
        </form>
        {canPublish ? (
          <div className="publish-dock">
            {confirming ? (
              <div className="publish-confirm">
                <div>
                  <p>
                    Publish {site.name}
                    {publishOnly ? ` in ${currentLanguage?.name || "this language"} only. The other languages stay as they are.` : "."}
                  </p>
                  {included.length ? (
                    <ul className="publish-fields">
                      {included.map((row) => (
                        <li key={`${row.language}-${row.label}`}>
                          <span>{row.label}</span>
                          <span>{row.language}</span>
                          <span>{row.value}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>The public page already matches this draft.</p>
                  )}
                </div>
                <div className="editor-actions">
                  <button type="button" className="solid-button" disabled={publishing} onClick={onPublish}>
                    {publishing ? "Publishing…" : "Publish now"}
                  </button>
                  <button type="button" className="quiet-button" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="solid-button" onClick={() => setConfirming(true)}>
                {publishOnly ? `Publish ${currentLanguage?.nativeName || "language"}` : "Publish"}
              </button>
            )}
          </div>
        ) : null}
        </>
      ) : null}
    </PanelFrame>
  );
}

function payloadFrom(site, revisions = []) {
  const revisionFor = (kind, languageCode, key, fallback) => {
    const hit = revisions.find(
      (row) => row.kind === kind && row.languageCode === languageCode && row.key === key,
    );
    return hit ? hit.revision : fallback;
  };
  return {
    theme: site.theme,
    fields: site.fields
      .filter((field) => !field.sensitive)
      .map((field) => ({
        key: field.key,
        language: field.language,
        draftValue: field.draftValue,
        revision: revisionFor("field", field.language, field.key, field.revision),
      })),
    offers: site.offers.map((item) => ({
      code: item.code,
      language: item.language,
      draftLabel: item.draftLabel,
      draftPrice: item.draftPrice,
      revision: revisionFor("offer", item.language, item.code, item.revision),
    })),
  };
}

function fieldsToPublish(site, language, wholeSite) {
  const codes = wholeSite ? site.languages.map((item) => item.code) : [language];
  const rows = [];
  for (const code of codes) {
    const name = site.languages.find((item) => item.code === code)?.name || code;
    for (const field of site.fields) {
      if (field.language !== code || field.sensitive) continue;
      if ((field.draftValue || "") === (field.publishedValue || "")) continue;
      rows.push({ label: field.label, language: name, value: field.draftValue || "Empty" });
    }
    for (const offer of site.offers) {
      if (offer.language !== code) continue;
      if ((offer.draftLabel || "") !== (offer.publishedLabel || "")) {
        rows.push({ label: `${offer.name} name`, language: name, value: offer.draftLabel || "Empty" });
      }
      if ((offer.draftPrice || "") !== (offer.publishedPrice || "")) {
        rows.push({ label: `${offer.name} price`, language: name, value: offer.draftPrice || "Empty" });
      }
    }
  }
  return rows;
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
