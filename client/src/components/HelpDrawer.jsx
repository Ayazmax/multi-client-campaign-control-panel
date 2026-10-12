import { useEffect, useState } from "react";

const HELP = {
  websites: {
    title: "Websites",
    paragraphs: [
      "Each workspace lists only the clients your account can open. Another client's websites do not appear in this list.",
      "Open a website to review or edit it. Create campaign copies a published website into a new draft. The original site stays as it is.",
    ],
  },
  clone: {
    title: "Create a campaign",
    paragraphs: [
      "This copies public wording, offers, and colours into a new draft.",
      "Private notes, analytics IDs, and private contact lines stay on the original website.",
      "The original website is not changed. Publish the new draft when a reviewer is ready.",
    ],
  },
  editor: {
    title: "This website",
    paragraphs: [
      "Publishing: an editor saves a draft. An owner or reviewer publishes. The confirm step names the website and the fields that will go on the public page. Visitors do not see a draft.",
      "Translations: add a language, then import a JSON file keyed by field id, such as home.hero.title. Missing slots are listed on this page. That language stays off the public site until it is published.",
      "Simulate failed launch records a failure and leaves the public page on the last successful publish.",
    ],
  },
  bulk: {
    title: "Update several websites",
    paragraphs: [
      "Change one shared detail, such as the Festive Fibre Plan price or a contact phone.",
      "Tick the websites and the languages that should change. Anything left unticked stays as it is.",
      "The review lists every chosen site, language, the current value, and the next value. Save as a draft to keep the public pages unchanged, or publish the change.",
    ],
  },
  restore: {
    title: "Restore an earlier version",
    paragraphs: [
      "History says what changed, where, who, and when. The version marked Live is the one on the public page.",
      "Choose an earlier version and read the current value beside the value that will replace it.",
      "The public page updates only when you confirm. The restore is written into history as a new event.",
    ],
  },
  backup: {
    title: "Restore a backup",
    paragraphs: [
      "A backup is a database copy of this website. It is not a file in another store.",
      "The screen lists what will be restored and what on the website will be replaced. Home, Offers, and Contact stay in place.",
      "Nothing is replaced until you confirm.",
    ],
  },
  move: {
    title: "Move a website",
    paragraphs: [
      "Moving sends this website to the other workspace. Pages are not rebuilt.",
      "Read the internal notes, analytics IDs, and private fields that will be left behind. They do not travel with the site.",
      "Confirm only after that list is what you expect.",
    ],
  },
};

export function HelpButton({ topic }) {
  const copy = HELP[topic];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!copy) return null;

  return (
    <>
      <button type="button" className="quiet-button" onClick={() => setOpen(true)}>
        Help
      </button>
      {open ? (
        <div className="help-layer" role="presentation" onClick={() => setOpen(false)}>
          <aside
            className="help-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">Help</p>
            <h2 id="help-title">{copy.title}</h2>
            {copy.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <button type="button" className="solid-button" onClick={() => setOpen(false)}>
              Close
            </button>
          </aside>
        </div>
      ) : null}
    </>
  );
}
