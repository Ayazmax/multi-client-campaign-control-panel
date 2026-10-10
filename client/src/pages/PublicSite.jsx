import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { fetchPanelSite, fetchPublicSite } from "../lib/api.js";
import { CampaignSite } from "./CampaignSite.jsx";

export function PublicSite({ preview = false }) {
  const { siteSlug, page } = useParams();
  const [params, setParams] = useSearchParams();
  const requested = params.get("lang");
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    const load = preview ? fetchPanelSite(siteSlug) : fetchPublicSite(siteSlug);
    load
      .then((body) => {
        if (active) setState({ status: "ready", site: body.site });
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

  useEffect(() => {
    if (state.status !== "ready" || !requested) return;
    const allowed = visibleLanguages(state.site, preview);
    if (allowed.some((item) => item.code === requested)) return;
    const next = new URLSearchParams(params);
    next.delete("lang");
    setParams(next, { replace: true });
  }, [params, preview, requested, setParams, state]);

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
              : "Visitors only see a website after it has been published."}
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

  const languages = visibleLanguages(state.site, preview);
  const language = languages.some((item) => item.code === requested)
    ? requested
    : languages.find((item) => item.status !== "draft")?.code || languages[0]?.code || "en";

  function onLanguage(code) {
    const next = new URLSearchParams(params);
    const fallback = languages.find((item) => item.status !== "draft")?.code || languages[0]?.code;
    if (code === fallback) next.delete("lang");
    else next.set("lang", code);
    setParams(next);
  }

  return (
    <CampaignSite
      site={state.site}
      page={page || "home"}
      language={language}
      languages={languages}
      preview={preview}
      onLanguage={onLanguage}
    />
  );
}

function visibleLanguages(site, preview) {
  if (preview) return site.languages;
  return site.languages.filter((item) => item.status !== "draft");
}
