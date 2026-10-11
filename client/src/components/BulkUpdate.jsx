// One change across websites. The choices, the excluded rows, and the review live here.
import { useEffect, useState } from "react";
import { applyBulk, fetchBulk } from "../lib/api.js";
import { PanelFrame } from "./PanelFrame.jsx";

const SUGGESTED = {
  "northwind-mobile": ["en"],
  "northwind-family": ["en", "ta"],
  "lanka-homes": ["en", "ta"],
  "island-eats": ["en"],
};

export function BulkUpdate() {
  const [matrix, setMatrix] = useState(null);
  const [item, setItem] = useState("offer.festive-fibre.price");
  const [value, setValue] = useState("Rs 3,999");
  const [selected, setSelected] = useState(() => new Set());
  const [ready, setReady] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchBulk(item)
      .then((body) => {
        if (!active) return;
        setMatrix(body);
        setSelected((current) => (current.size > 0 ? current : suggestedSelection(body.sites)));
        setReady(true);
      })
      .catch((caught) => {
        if (active) setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, [item]);

  const field = matrix?.items.find((entry) => entry.key === item)?.field || "Value";
  const rows = matrix ? reviewRows(matrix.sites, selected, value, field) : [];
  const included = rows.filter((row) => row.included);
  const chosenSites = matrix
    ? matrix.sites.filter((site) => site.languages.some((language) => selected.has(keyFor(site.slug, language.code))))
    : [];
  const canDraft = chosenSites.length > 0 && chosenSites.every((site) => site.canEdit);
  const canPublish = chosenSites.length > 0 && chosenSites.every((site) => site.canPublish);

  function toggle(slug, code) {
    const key = keyFor(slug, code);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setReviewing(false);
  }

  function toggleSite(site) {
    const keys = site.languages.map((language) => keyFor(site.slug, language.code));
    const allOn = keys.every((key) => selected.has(key));
    setSelected((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (allOn) next.delete(key);
        else next.add(key);
      }
      return next;
    });
    setReviewing(false);
  }

  async function onApply(mode) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = await applyBulk({
        item,
        value,
        mode,
        targets: targetsFrom(matrix.sites, selected),
      });
      setNotice(body.sentence);
      setMatrix(await fetchBulk(item));
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PanelFrame
      section="bulk"
      title="Update several websites"
      lede="Choose one shared detail, then choose the websites and languages. Everything else stays as it is."
    >
      {!matrix && !error ? <p className="page-loading">Loading websites…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {matrix ? (
        <div className="editor-form bulk-screen">
          <section className="editor-card">
            <h2>What changes</h2>
            <div className="bulk-options">
              {matrix.items.map((entry) => (
                <label key={entry.key} className="bulk-option">
                  <input
                    type="radio"
                    name="bulk-item"
                    checked={item === entry.key}
                    onChange={() => {
                      setItem(entry.key);
                      setValue(entry.key === "contact.phone" ? "" : "Rs 3,999");
                      setReviewing(false);
                      setNotice("");
                    }}
                  />
                  <span>{entry.label}</span>
                </label>
              ))}
            </div>
            <label className="bulk-value">
              New {field.toLowerCase()}
              <input value={value} onChange={(event) => { setValue(event.target.value); setReviewing(false); }} />
            </label>
          </section>

          <section className="editor-card">
            <h2>Where it changes</h2>
            <p>Tick a website to include every language on it, or tick only the languages you want.</p>
            <div className="bulk-lang-head" aria-hidden="true">
              <span>Language</span>
              <span>Status</span>
              <span>Current</span>
            </div>
            <div className="bulk-sites">
              {matrix.sites.map((site) => {
                const keys = site.languages.map((language) => keyFor(site.slug, language.code));
                const picked = keys.filter((key) => selected.has(key)).length;
                return (
                  <section key={site.slug} className="bulk-site">
                    <label className="bulk-check bulk-site-name">
                      <input
                        type="checkbox"
                        checked={keys.length > 0 && picked === keys.length}
                        ref={(node) => {
                          if (node) node.indeterminate = picked > 0 && picked < keys.length;
                        }}
                        onChange={() => toggleSite(site)}
                      />
                      <span>
                        {site.name}
                        {site.client !== site.name ? <span className="site-meta"> {site.client}</span> : null}
                      </span>
                    </label>
                    <ul className="bulk-langs">
                      {site.languages.map((language) => {
                        const on = selected.has(keyFor(site.slug, language.code));
                        return (
                          <li key={language.code} className={on ? "is-on" : ""}>
                            <label className="bulk-check">
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggle(site.slug, language.code)}
                              />
                              <span>{language.nativeName || language.name}</span>
                            </label>
                            <span className={language.status === "published" ? "badge badge-live" : "badge badge-draft"}>
                              {language.status}
                            </span>
                            <span className="bulk-now">{language.current || "Empty"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
            <div className="editor-actions">
              <button type="button" className="solid-button" disabled={!ready || included.length === 0} onClick={() => { setError(""); setReviewing(true); }}>
                Review
              </button>
              <span className="site-meta">{included.length} selected</span>
            </div>
          </section>

          {reviewing ? (
            <section className="editor-card bulk-review">
              <h2>Review</h2>
              <p>
                {included.length} selected. The other rows stay as they are.
              </p>
              <div className="bulk-table-wrap">
              <table className="bulk-table">
                <thead>
                  <tr>
                    <th>Website</th>
                    <th>Language</th>
                    <th>Field</th>
                    <th>Current</th>
                    <th>Next</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.slug}-${row.language}`} className={row.included ? "is-included" : "bulk-excluded"}>
                      <td>{row.site}</td>
                      <td>{row.language}</td>
                      <td>{row.field}</td>
                      <td>
                        {row.current}
                        {row.published && row.published !== row.current ? ` · public ${row.published}` : ""}
                      </td>
                      <td>{row.next}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {notice ? <p className="form-notice">{notice}</p> : null}
              <div className="editor-actions">
                {canDraft ? (
                  <button type="button" className="quiet-button" disabled={busy || !value.trim()} onClick={() => onApply("draft")}>
                    {busy ? "Saving…" : "Save as draft"}
                  </button>
                ) : null}
                {canPublish ? (
                  <button type="button" className="solid-button" disabled={busy || !value.trim()} onClick={() => onApply("publish")}>
                    {busy ? "Publishing…" : "Publish this change"}
                  </button>
                ) : (
                  <p className="site-meta">An owner or reviewer publishes this change.</p>
                )}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </PanelFrame>
  );
}

function keyFor(slug, code) {
  return `${slug}:${code}`;
}

function suggestedSelection(sites) {
  const selected = new Set();
  for (const site of sites) {
    for (const code of SUGGESTED[site.slug] || []) {
      if (site.languages.some((language) => language.code === code)) {
        selected.add(keyFor(site.slug, code));
      }
    }
  }
  return selected;
}

function targetsFrom(sites, selected) {
  return sites
    .map((site) => ({
      slug: site.slug,
      languages: site.languages
        .filter((language) => selected.has(keyFor(site.slug, language.code)))
        .map((language) => language.code),
    }))
    .filter((target) => target.languages.length > 0);
}

function reviewRows(sites, selected, value, field) {
  return sites.flatMap((site) =>
    site.languages.map((language) => {
      const included = selected.has(keyFor(site.slug, language.code));
      return {
        slug: site.slug,
        site: site.name,
        language: language.name,
        field,
        current: language.current || "Empty",
        published: language.published,
        included,
        next: included ? value || "Enter a value" : "Excluded",
      };
    }),
  );
}
