import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchPanelSite, fetchPublicSite } from "../lib/api.js";

export function PublicSite({ preview = false }) {
  const { siteSlug } = useParams();
  const [state, setState] = useState({ status: "loading" });
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    const load = preview ? fetchPanelSite(siteSlug) : fetchPublicSite(siteSlug);
    load
      .then((body) => {
        if (!active) return;
        const site = body.site;
        const first = preview
          ? site.languages.find((item) => item.status === "published")?.code ||
            site.languages[0]?.code
          : site.languages[0]?.code;
        setLanguage(first || "en");
        setState({ status: "ready", site });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: error.status === 404 ? "missing" : "error",
          message: error.message,
        });
      });
    return () => {
      active = false;
    };
  }, [preview, siteSlug]);

  if (state.status === "loading") {
    return <p className="page-loading">Loading website…</p>;
  }
  if (state.status === "missing") {
    return (
      <div className="public-shell">
        <main className="public-empty">
          <p className="eyebrow">{preview ? "Staff preview" : "Public page"}</p>
          <h1>{preview ? "You cannot open this website" : "This website is not public"}</h1>
          <p>
            {preview
              ? "It is missing, or your account has no access to this client."
              : "Visitors only see a website after it has been published. Draft languages stay off this page."}
          </p>
          <Link className="text-link" to="/app">
            Back to operations
          </Link>
        </main>
      </div>
    );
  }
  if (state.status === "error") {
    return <p className="page-loading">{state.message}</p>;
  }

  return preview ? (
    <StaffPreview site={state.site} language={language} onLanguage={setLanguage} />
  ) : (
    <PublishedSummary site={state.site} language={language} onLanguage={setLanguage} />
  );
}

function PublishedSummary({ site, language, onLanguage }) {
  const fields = site.fields[language] || {};
  const offer = site.offers[0]?.languages?.[language];
  return (
    <div className="public-shell">
      <header className="public-bar">
        <p className="wordmark">{site.name}</p>
        <LanguageSwitch
          languages={site.languages}
          language={language}
          onLanguage={onLanguage}
        />
      </header>
      <main className="public-summary">
        <p className="eyebrow">Published page</p>
        <h1>{fields["home.h1"] || site.name}</h1>
        <p className="hero-title">{fields["home.hero.title"]}</p>
        <p>{fields["home.hero.subtitle"]}</p>
        {offer ? (
          <p className="offer-line">
            {offer.label}: {offer.price}
          </p>
        ) : null}
        <p className="site-meta">
          {fields["contact.phone"]}
          {fields["contact.email"] ? ` · ${fields["contact.email"]}` : ""}
        </p>
        <p className="phase-note">
          The full Home, Offers, and Contact template is the next phase. This page
          shows only published fields.
        </p>
        <Link className="text-link" to="/app">
          Back to operations
        </Link>
      </main>
    </div>
  );
}

function StaffPreview({ site, language, onLanguage }) {
  const current = site.languages.find((item) => item.code === language);
  const hero = site.fields.find(
    (field) => field.key === "home.hero.title" && field.language === language,
  );
  const privateLine = site.fields.find((field) => field.key === "contact.private_line");
  return (
    <div className="public-shell">
      <header className="public-bar">
        <p className="wordmark">{site.name}</p>
        <p className="preview-flag">Draft preview</p>
        <LanguageSwitch
          languages={site.languages}
          language={language}
          onLanguage={onLanguage}
          showStatus
        />
      </header>
      <main className="public-summary">
        <p className="eyebrow">Staff preview · {site.client.name}</p>
        <h1>{hero?.draftValue || site.name}</h1>
        <p>
          {current?.status === "published"
            ? "This language is on the public site."
            : "This language is still a draft. Visitors cannot see it."}
        </p>
        {privateLine ? (
          <p className="site-meta">Private line, staff only: {privateLine.draftValue}</p>
        ) : (
          <p className="site-meta">No private contact line on this website.</p>
        )}
        {site.internalNotes ? <p className="site-meta">{site.internalNotes}</p> : null}
        <Link className="text-link" to="/app">
          Back to operations
        </Link>
      </main>
    </div>
  );
}

function LanguageSwitch({ languages, language, onLanguage, showStatus = false }) {
  if (languages.length === 0) return null;
  return (
    <div className="language-switch">
      {languages.map((item) => (
        <button
          key={item.code}
          type="button"
          className={item.code === language ? "language-on" : ""}
          onClick={() => onLanguage(item.code)}
        >
          {item.nativeName || item.name}
          {showStatus ? ` · ${item.status}` : ""}
        </button>
      ))}
    </div>
  );
}
