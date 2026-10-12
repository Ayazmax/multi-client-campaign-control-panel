import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchHistory } from "../lib/api.js";
import { PanelFrame } from "./PanelFrame.jsx";

export function HistoryList() {
  const [params, setParams] = useSearchParams();
  const site = params.get("site") || "";
  const [sites, setSites] = useState([]);
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchHistory(site)
      .then((body) => {
        if (!active) return;
        setSites(body.sites);
        setEvents(body.events);
        setError("");
      })
      .catch((caught) => {
        if (!active) return;
        setEvents([]);
        setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, [site]);

  return (
    <PanelFrame section="history" help="restore" title="History" lede="What changed, where, who, and when.">
      <label className="history-filter">
        Website
        <select
          value={site}
          onChange={(event) => {
            const next = event.target.value;
            setParams(next ? { site: next } : {});
          }}
        >
          <option value="">All websites</option>
          {sites.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {events === null ? <p className="page-loading">Loading history…</p> : null}
      {events?.length === 0 ? <p className="empty-line">Nothing has been recorded for this view.</p> : null}
      <div className="history-list">
        {events?.map((event) => (
          <article key={event.id} className="history-row">
            <p>{event.sentence}</p>
            {event.offers.length ? (
              <ul className="history-offers">
                {event.offers.map((offer) => (
                  <li key={`${event.id}-${offer.language}-${offer.price}`}>
                    {offer.label} · {offer.language} · {offer.price}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="history-meta">
              {event.sites.length ? <p className="site-meta">{event.sites.map((item) => item.name).join(", ")}</p> : null}
              {event.live ? <p className="badge badge-live">Live</p> : null}
              {event.canRestore && event.site ? (
                <Link to={`/app/sites/${event.site.slug}/restore/${event.snapshotId}`}>Restore this version</Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </PanelFrame>
  );
}
