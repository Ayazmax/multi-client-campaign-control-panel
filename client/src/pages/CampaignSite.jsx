import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FontFaces } from "../components/FontFaces.jsx";
import { notePanelVisit, stepBack } from "../lib/panelTrail.js";

const NAV = {
  en: { home: "Home", offers: "Offers", contact: "Contact" },
  ta: { home: "முகப்பு", offers: "சலுகைகள்", contact: "தொடர்பு" },
  si: { home: "මුල් පිටුව", offers: "දීමනා", contact: "සම්බන්ධ කරන්න" },
};

const CTA = {
  en: { offers: "View offers", contact: "Get in touch", ribbon: "View offer" },
  ta: { offers: "சலுகைகளைப் பாருங்கள்", contact: "தொடர்பு கொள்ளுங்கள்", ribbon: "சலுகையைப் பாருங்கள்" },
  si: { offers: "දීමනා බලන්න", contact: "සම්බන්ධ වන්න", ribbon: "දීමනාව බලන්න" },
};

const PAGES = ["home", "offers", "contact"];

export function CampaignSite({
  site,
  page,
  language,
  languages,
  preview = false,
  onLanguage,
}) {
  const copy = fieldMap(site, language, preview);
  const offer = offerFor(site, language, preview);
  const labels = NAV[language] || NAV.en;
  const cta = CTA[language] || CTA.en;
  const knownPage = PAGES.includes(page);
  const pageKey = knownPage ? page : "home";
  const title = knownPage
    ? copy[`${pageKey}.seo.title`] || site.name
    : `Page not found | ${site.name}`;
  const description = knownPage ? copy[`${pageKey}.seo.description`] || "" : "";
  const heading = knownPage ? copy[`${pageKey}.h1`] || site.name : "This page is not on the website";
  const location = useLocation();
  const navigate = useNavigate();
  const currentLanguage = languages.find((item) => item.code === language);
  const theme = site.theme || {};
  const links = {
    home: href(site.slug, "home", language, preview, languages),
    offers: href(site.slug, "offers", language, preview, languages),
    contact: href(site.slug, "contact", language, preview, languages),
  };

  useEffect(() => {
    if (preview) notePanelVisit(location.pathname);
  }, [location.pathname, preview]);

  useEffect(() => {
    document.title = preview ? `Preview: ${title}` : title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [description, preview, title]);

  return (
    <div
      className="campaign"
      style={{
        "--brand": theme.primaryColor || "#0f6e56",
        "--brand-ink": theme.secondaryColor || "#1c1915",
        "--brand-accent": theme.accentColor || "#e2a33a",
        "--brand-font": `"${theme.fontFamily || "Source Serif 4"}"`,
      }}
    >
      <FontFaces families={[theme.fontFamily || "Source Serif 4"]} />
      {site.analytics?.gaMeasurementId || site.analytics?.gtmContainerId ? (
        <p className="analytics-head">
          <span>Demo only. These IDs are not sent to Google.</span>
          {site.analytics.gaMeasurementId ? <span>Analytics {site.analytics.gaMeasurementId}</span> : null}
          {site.analytics.gtmContainerId ? <span>Tag Manager {site.analytics.gtmContainerId}</span> : null}
        </p>
      ) : null}
      {preview ? (
        <p className="preview-banner">
          <button
            type="button"
            onClick={() => {
              const target = stepBack(location.pathname);
              if (target) navigate(target);
            }}
          >
            Back
          </button>
          <span>
            Draft preview
            {currentLanguage?.status === "draft"
              ? ` · ${currentLanguage.nativeName || currentLanguage.name} is not on the public site`
              : ""}
          </span>
        </p>
      ) : null}
      <header className="campaign-header">
        <Link className="campaign-logo" to={links.home}>
          {theme.logoUrl ? <img src={theme.logoUrl} alt="" /> : null}
          <span>{site.name}</span>
        </Link>
        <nav className="campaign-nav" aria-label="Pages">
          {PAGES.map((key) => (
            <Link
              key={key}
              to={links[key]}
              aria-current={key === page ? "page" : undefined}
            >
              {labels[key]}
            </Link>
          ))}
        </nav>
        <div className="campaign-tools">
          <div className="campaign-langs">
            {languages.map((item) => (
              <button
                key={item.code}
                type="button"
                className={item.code === language ? "language-on" : ""}
                onClick={() => onLanguage(item.code)}
              >
                {item.nativeName || item.name}
                {preview && item.status === "draft" ? " · draft" : ""}
              </button>
            ))}
          </div>
          <Link className="btn btn-solid" to={links.contact}>
            {cta.contact}
          </Link>
        </div>
      </header>
      <main>
        {knownPage ? (
          <PageBody
            page={pageKey}
            copy={copy}
            offer={offer}
            heading={heading}
            cta={cta}
            links={links}
          />
        ) : (
          <article className="page-intro">
            <h1>{heading}</h1>
          </article>
        )}
      </main>
      {knownPage && pageKey !== "contact" ? (
        <ClosingBand copy={copy} cta={cta} contactHref={links.contact} />
      ) : null}
      <footer className="campaign-footer">
        <Link to={links.home}>{site.name}</Link>
        <nav aria-label="Footer">
          {PAGES.map((key) => (
            <Link key={key} to={links[key]}>
              {labels[key]}
            </Link>
          ))}
        </nav>
        <p>
          {copy["contact.email"] ? (
            <a href={`mailto:${copy["contact.email"]}`}>{copy["contact.email"]}</a>
          ) : null}
          {copy["contact.phone"] ? <span>{copy["contact.phone"]}</span> : null}
        </p>
      </footer>
    </div>
  );
}

function PageBody({ page, copy, offer, heading, cta, links }) {
  if (page === "offers") {
    return (
      <article>
        <section className="page-intro">
          <h1>{heading}</h1>
          <p>{copy["offers.intro"]}</p>
        </section>
        {offer ? (
          <section className="offer-feature">
            <div>
              <p className="offer-kicker">{offer.label}</p>
              <p className="offer-price">{offer.price}</p>
            </div>
            {copy["home.hero.image"] ? (
              <img src={copy["home.hero.image"]} alt="" />
            ) : null}
          </section>
        ) : null}
      </article>
    );
  }
  if (page === "contact") {
    return (
      <article className="contact-layout">
        <div>
          <h1>{heading}</h1>
          <p>{copy["contact.intro"]}</p>
        </div>
        <address className="contact-card">
          {copy["contact.phone"] ? <a href={`tel:${copy["contact.phone"]}`}>{copy["contact.phone"]}</a> : null}
          {copy["contact.email"] ? <a href={`mailto:${copy["contact.email"]}`}>{copy["contact.email"]}</a> : null}
          {copy["contact.address"] ? <p>{copy["contact.address"]}</p> : null}
        </address>
      </article>
    );
  }
  const headline = copy["home.hero.title"] || heading;
  return (
    <article>
      <section className="hero">
        {copy["home.hero.image"] ? (
          <img className="hero-photo" src={copy["home.hero.image"]} alt="" />
        ) : null}
        <div className="hero-copy">
          <h1>{headline}</h1>
          <p>{copy["home.hero.subtitle"]}</p>
          <div className="hero-actions">
            <Link className="btn btn-solid" to={links.offers}>
              {cta.offers}
            </Link>
            <Link className="btn btn-ghost" to={links.contact}>
              {cta.contact}
            </Link>
          </div>
        </div>
      </section>
      {offer ? (
        <p className="offer-ribbon">
          <span>
            {offer.label}
            <strong>{offer.price}</strong>
          </span>
          <Link to={links.offers}>{cta.ribbon}</Link>
        </p>
      ) : null}
    </article>
  );
}

function ClosingBand({ copy, cta, contactHref }) {
  if (!copy["contact.intro"] && !copy["contact.h1"]) return null;
  return (
    <section className="closing-band">
      <h2>{copy["contact.h1"]}</h2>
      <p>{copy["contact.intro"]}</p>
      <Link className="btn btn-light" to={contactHref}>
        {cta.contact}
      </Link>
    </section>
  );
}

function href(slug, page, language, preview, languages) {
  const defaultLanguage = languages.find((item) => item.status !== "draft")?.code || languages[0]?.code;
  const stem = preview ? `/s/${slug}/preview` : `/s/${slug}`;
  const path = page === "home" ? stem : `${stem}/${page}`;
  if (!language || language === defaultLanguage) return path;
  return `${path}?lang=${language}`;
}

function fieldMap(site, language, preview) {
  if (!Array.isArray(site.fields)) return site.fields?.[language] || {};
  const map = {};
  for (const field of site.fields) {
    if (field.language !== language || field.sensitive) continue;
    const value = preview ? field.draftValue : field.publishedValue;
    if (value) map[field.key] = value;
  }
  return map;
}

function offerFor(site, language, preview) {
  const offers = site.offers || [];
  if (offers[0]?.languages) return offers[0].languages[language] || null;
  const row = offers.find((item) => item.language === language);
  if (!row) return null;
  const price = preview ? row.draftPrice : row.publishedPrice;
  const label = (preview ? row.draftLabel : row.publishedLabel) || row.name;
  if (!price) return null;
  return { label, price };
}
