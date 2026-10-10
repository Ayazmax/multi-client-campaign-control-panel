# Website Operations — Phase Plan

Status: Phase 3 is in place. Public websites use one template for Home, Offers, and Contact. Phases 4–10 are waiting for approval.

This plan turns the Round 2 assessment into a build sequence. The product is a control panel for non-technical marketing and operations staff, plus example campaign websites rendered from a master template. Website content lives in PostgreSQL. The public site reads only published content.

## Goal

A reviewer can open the app alone and complete this journey:

1. Create a new campaign by copying an existing website.
2. Change branding, images, content, offers, and contact details.
3. Preview it, then publish it, without changing the original site or copying private client data.
4. Add Tamil and Sinhala from supplied translations, see what is missing, and keep unfinished languages private.
5. Change one shared offer on only some websites and only some languages, after seeing exactly what will change.
6. Publish through a reviewer, and see a conflict when two people edit the same item.
7. See a failed launch that leaves the current live site untouched.
8. Read a plain-language history and restore the correct earlier content.
9. Restore a whole site from backup, and move a site to another workspace, without leaking private data.

## Stack

| Part | Choice |
| --- | --- |
| Control panel and public websites | React (Vite) + React Router |
| API | Node.js + Express |
| Database | PostgreSQL via Prisma |
| Frontend host | Vercel |
| API and database host | Render (Web Service + PostgreSQL) |

One React app serves both surfaces:

- `/app/...` is the control panel.
- `/s/:siteSlug` is the public website.
- `/s/:siteSlug/preview` is a draft preview for signed-in staff.

The master template is React. It does not change per client. Each website is data: theme, pages, fields, offers, locales, and publish state.

## Repository shape

```text
client/          React app (control panel + public template)
server/          Express API, Prisma, seed
README.md        Written in the last phase: setup, demo logins, assumptions
PHASE_PLAN.md    This file
```

Local development uses two processes: the Vite app and the API. The React app calls the API with `VITE_API_URL`.

## Assumptions

These fill gaps the brief leaves open. They can be changed before Phase 1 starts.

1. One master template is enough. Pages are Home, Offers, and Contact. Sections and text slots are fixed. Clients differ by theme and content, not by layout code.
2. A website belongs to one client. A client belongs to one workspace. Staff access is granted per client.
3. Copying a website copies structure and public content only. It clears analytics IDs, internal notes, and any field marked private. The new site starts as a draft. The source site is not modified.
4. The public site shows published content only. Draft text and unpublished languages are invisible to visitors, including by direct URL.
5. English, Tamil (`ta`), and Sinhala (`si`) are the first languages. Adding another language is a data action in the panel, not a code change.
6. Translations are imported against stable field keys (`home.hero.title`, `offer.festive.price`), so staff do not paste each string by hand.
7. Shared facts such as an offer price are stored once per site and language, linked to a shared offer. A bulk edit selects sites and languages, shows a diff, then writes only those rows.
8. Two editors are protected by a revision number. The second save is rejected and the panel explains both versions. Nothing is overwritten silently.
9. Publishing stores a snapshot. A failed launch does not replace the live snapshot. The previous public site keeps serving.
10. History rows are written in plain language at the time of the change, for example: "Festive plan price changed from Rs 4,999 to Rs 3,999 in English and Tamil on four websites, by Amina, on 9 Oct 2026."
11. Authentication is email and password for seeded demo users. Roles are Owner, Editor, and Reviewer.
12. Image files in the demo are remote sample URLs stored on the site record. Upload to cloud storage is out of scope and will be listed as incomplete.
13. Google Analytics and Google Tag Manager are configuration only. Saving an ID shows it on the public page as the snippet IDs. No real Google property is required.
14. Search engines get a unique URL, title, description, and heading per public page, plus `sitemap.xml` and `robots.txt` from the API. The demo is a single-page React app, so full server rendering is documented as needed before daily reliance.
15. "Six websites" in the bulk-update story are real seeded sites, not a mock count.

## Roles

| Role | Can do |
| --- | --- |
| Owner | Everything in their workspace, including backups, restore, and workspace transfer |
| Editor | Edit assigned clients, create a draft campaign, import translations. Cannot publish |
| Reviewer | Read assigned clients, review drafts, publish, restore a content version |

A user with no grant for a client cannot open that client, its sites, or its private fields.

## Data model

```text
Workspace
  Client
    Site
      SiteLocale          language, draft | published
      Theme               colours, logo, font
      Page
        ContentField      key, page, sensitive flag
          ContentValue    locale, draft value, published value, revision
      SiteOffer           link to a shared offer, price per locale
      LaunchAttempt       success | failed, message, next step
      Backup              snapshot used for full-site restore
      HistoryEvent        plain-language sentence, actor, time, snapshot pointer
  Membership              user + workspace + role
  ClientGrant             user + client

User
Offer                     shared offer identity (name, code)

AnalyticsSettings         site, gaMeasurementId, gtmContainerId
```

Public reads use `published` values only. The panel reads draft and published side by side.

Sensitive fields (analytics IDs, internal notes, private contact lines) are flagged. Clone and workspace transfer omit them and record that they were left behind.

## Seeded demo world

Password for every demo user: `Demo1234!`

| User | Role | Access |
| --- | --- | --- |
| amina@trident.demo | Owner | Both workspaces |
| ravi@trident.demo | Editor | Northwind, Lanka Homes, Island Eats |
| meera@trident.demo | Reviewer | Northwind, Lanka Homes, Island Eats |

Workspaces: `Colombo Campaigns` and `Archive`.

Six websites, all from the master template:

| Site | Client | Languages | Why it exists |
| --- | --- | --- | --- |
| Northwind Mobile | Northwind | English published | Source site for the new campaign |
| Northwind Family | Northwind | English published, Tamil published | Already-cloned sibling |
| Lanka Homes | Lanka Homes | English and Tamil published, Sinhala draft | Shows a private unfinished language |
| Island Eats | Island Eats | English published | Bulk-update target |
| Metro Loans | Metro Loans | English and Tamil published | Bulk-update target |
| City Clinic | City Clinic | English published | Stays unchanged in the bulk-update demo |

Shared offer on all six sites: **Festive Fibre Plan**, price Rs 4,999 in each published language.

The guided story changes that price on Northwind Mobile, Northwind Family, Lanka Homes, and Island Eats, in English and Tamil only. Metro Loans Tamil stays Rs 4,999 if it is not selected. City Clinic is not selected and must stay unchanged. Sinhala stays untouched because it is not selected.

A second seeded draft, `Northwind Campus`, is left unpublished so preview-before-launch is visible immediately.

## What is simulated on purpose

Called out in the UI and the README, not hidden:

- Launch failure is a real API path with a "Simulate failed launch" action. It does not depend on a broken host.
- Analytics IDs are stored and printed into the page. They are not sent to Google.
- Backups are database snapshots, not files in offsite storage.
- Images are URLs, not uploads.
- Search-engine discovery is URL, meta tags, and sitemap. HTML is not server-rendered.

## Phases

Each phase ends with something a person can run. Later phases build on earlier ones. Do not start a phase until the previous one is accepted.

### Phase 1 — Foundation

Get an empty app running locally against PostgreSQL.

Deliver:

- `client` and `server` folders, scripts to install, migrate, seed, and run both.
- Express health check and Prisma connected to local PostgreSQL.
- React shells for `/app` and `/s/:siteSlug`, with a clear empty state.
- Environment examples for local, Vercel, and Render. No secrets committed.
- CORS so the Vite origin can call the API.

Done when: both processes start, `/health` returns ok, and the React app loads.

Out of this phase: real pages, auth screens beyond a placeholder, deployment.

### Phase 2 — Schema, auth, and seed

Put the demo world in the database and protect the panel.

Deliver:

- Prisma models from the data model above, with migrations.
- Seed script for workspaces, users, clients, six sites, the shared offer, English content, Tamil where listed, one Sinhala draft, and history of the initial publish.
- Login and logout. Session or bearer token stored safely for the demo.
- Every panel route checks the user and the client grant.
- Public routes do not require login and never return draft or sensitive fields.

Done when: seeded users can log in, and an API call for a public site returns only published English (and published Tamil where it exists).

### Phase 3 — Public websites from the master template

Visitors can open a live example site.

Deliver:

- One template with Home, Offers, and Contact.
- Theme tokens (colour, logo, type) applied from the site record.
- Language switcher. Unpublished languages are not listed. A draft locale URL does not reveal draft copy.
- Unique title, description, and one H1 per page.
- API routes for `sitemap.xml` and `robots.txt`.
- Sample content that looks like campaign sites, not lorem ipsum.

Done when: at least two seeded sites look different in brand and copy, Tamil is switchable where published, and Sinhala is not visible on Lanka Homes.

### Phase 4 — Launch a new campaign

The operations manager can clone, adapt, preview, and publish.

Deliver:

- Site list with status: draft, live, failed.
- "Create campaign from this site" as one action, then a short confirm step (one or two clicks).
- Clone copies public content and theme, clears private fields and analytics IDs, and leaves the source site unchanged.
- Editors for branding, images (URL), page content, offers, and contact details.
- Preview route that shows the draft to signed-in staff.
- Publish writes a snapshot and a plain-language history line. The public URL then serves the new site.
- The original site's public page is identical before and after.

Done when: Amina can create `Northwind Campus` from Northwind Mobile, change the offer and phone number, preview, publish, and the source site is unchanged. Private notes from the source do not appear on the new site.

### Phase 5 — Languages

Staff can add translations without rebuilding the site.

Deliver:

- Add a language to a site from the panel.
- Import a translation file (JSON) keyed by field id, mapped onto the correct page and slot.
- A missing-translation list: page, field, language.
- Review that language in preview.
- Publish that language alone. Other languages stay as they were.
- Visitors can switch to it only after publish.

Done when: a supplied Sinhala file fills Lanka Homes, missing keys are listed, the public site hides Sinhala until publish, then the switcher shows it in the right places.

### Phase 6 — Update several websites together

One change can target a subset of sites and languages.

Deliver:

- Pick a shared item (offer price or contact phone).
- Pick websites and languages. Unselected sites and languages are shown as excluded.
- Review screen lists every site, language, field, current value, and next value.
- Apply writes only the selected rows and adds one history event that names the scope.
- If the apply is "save as draft", public pages do not change until publish. The demo path also supports publishing the bulk change.

Done when: Festive Fibre Plan becomes Rs 3,999 on the four chosen sites in English and Tamil only. City Clinic and every unselected language still show Rs 4,999.

### Phase 7 — Working together

Two people can prepare and publish without stepping on each other.

Deliver:

- Editor can change content but cannot publish.
- Reviewer can publish assigned clients and cannot open other clients.
- Draft content stays off the public site.
- Each content save sends the revision it was based on. A stale save returns a conflict screen with both versions and the other person's name. The user chooses to keep theirs or reload. The API does not silently overwrite.
- Publish confirms the site and the fields included.

Done when: Ravi edits an offer, Meera publishes it, and a second overlapping save by Ravi shows the conflict instead of replacing Meera's text. Ravi cannot open City Clinic.

### Phase 8 — Mistakes, backups, and moving a site

Staff can see what is live, undo a bad publish, and move a site.

Deliver:

- History list in plain sentences: what changed, where, who, when. Filter by site.
- Current live version is marked.
- Restore one earlier content version. The public site updates only after a reviewer confirms. Restore itself becomes a new history event.
- Full-site backup action, easy to find on the site.
- Restore-from-backup screen states what will be restored and what will be replaced, then asks for confirmation.
- Transfer a site to the other workspace. Private fields are stripped or re-checked, and the transfer is written to history. Pages are not rebuilt by hand.

Done when: publishing the wrong offer price can be recognised and restored by Meera without reading the database. Amina can restore a backup after reading the warning, and can move a site into `Archive` without taking analytics IDs or internal notes with it.

### Phase 9 — Everyday operations and a failed launch

The remaining operational tasks from the brief.

Deliver:

- Form to save Google Analytics and Google Tag Manager IDs. Public site shows the configured IDs in the page head area for the demo.
- Launch attempt record. A failed attempt names the site, what happened, and the next action.
- "Simulate failed launch" runs the failure path. The last good public snapshot stays live.
- Help drawer on each main panel screen, written for that task (clone, translate, bulk edit, publish, restore).
- Client data stays separated in every list, API response, and transfer.

Done when: a failed launch of Northwind Campus leaves the live Campus site on the previous publish, and the panel tells Amina what to do next. Help on the bulk-update screen matches that task.

### Phase 10 — Demo notes, checks, and hosting

Make the assessment submittable.

Deliver:

- README with install steps, demo logins, the click-path for the full journey, assumptions, what is simulated, and what is incomplete.
- A short "before daily use" note: real image storage, server-rendered HTML, offsite backups, audit export, password reset, and rate limits.
- A note on scale: more clients add rows, not templates; more languages add locales; more staff add grants. Bulk edit stays a filtered write.
- Deploy the React app to Vercel and the API plus PostgreSQL to Render.
- Run the journey once on the hosted URLs and record the result in the README.

Done when: a reviewer can follow the README without a walkthrough, on the hosted links or from a local ZIP.

Checks to run before calling Phase 10 done:

- Clone does not change the source site and does not copy private fields.
- Unpublished language is not on the public site or in the switcher.
- Bulk edit changes only the selected sites and languages.
- Conflict save does not overwrite.
- Failed launch does not replace the live snapshot.
- Restore returns the earlier offer text and says so in history.
- Backup restore and workspace transfer show the impact before they run.
- Editor cannot publish. Reviewer cannot open an unassigned client.
- Sitemap lists only public, published site URLs.

## How a small review change stays small

The brief may ask for a 10–15 minute change, such as renaming a field or swapping an input.

- Field keys live in one catalog used by the template, the editor, import, and bulk update.
- Each panel screen is a separate route and form.
- The database is changed only through Prisma migrations.
- Publish, restore, and bulk edit share one write path that records history.

A rename should touch the catalog, one form label, and one migration, then the public page and the bulk-update preview are rechecked.

## Suggested order of approval

Approve Phase 1 through Phase 4 first if you want a visible website early. Phases 5 through 9 are the assessment's remaining journeys. Phase 10 is packaging and deploy.

If you want a thinner demo, the cut line is after Phase 9: everything in the brief's story still exists, and Phase 10 only writes it up and hosts it.

## Not in this plan

- A page builder or per-client custom layouts.
- A second frontend framework.
- Real Google tag delivery, payments, or email sending.
- File upload hosting.
- Native mobile apps.

Reply with the phases you approve, or the assumptions you want changed, and implementation starts at Phase 1.
