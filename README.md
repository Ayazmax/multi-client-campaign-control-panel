# Website Operations

A control panel for marketing and operations staff, plus the public campaign websites those staff publish. One React app serves both. Website content lives in PostgreSQL. Visitors see published text only.

- Panel: `/app`
- Public website: `/s/:slug`
- Draft preview, for a signed-in member of staff: `/s/:slug/preview`

The page layout is one React template. Each website is data: theme, pages, fields, offers, languages, and publish state.

## Hosted demo

| Part | Address |
| --- | --- |
| Panel and public websites | https://multi-client-campaign-control-panel.vercel.app |
| API health | https://website-operations-api.onrender.com/health |
| Sign in | https://multi-client-campaign-control-panel.vercel.app/app/login |

The Vercel app forwards `/api`, `/health`, `/sitemap.xml`, and `/robots.txt` to the Render API. The browser stays on the Vercel address, which is what keeps the sign-in cookie working.

A free Render service sleeps when it is idle. The first open can take about a minute. The free database is removed on 11 November 2026 unless that database is moved to a paid plan.

### Checked on the hosted addresses, 12 October 2026

- `/health`, opened through the Vercel address, returned `database: up`.
- Amina can sign in. The session cookie is set on the Vercel host.
- Her website list shows Colombo Campaigns. Archive is empty.
- Northwind Mobile is public and shows the demo Analytics ID `G-NWMOBILE01` and Tag Manager ID `GTM-NWM001`. Those IDs are printed on the page. They are not sent to Google.
- Northwind Campus is still a draft. `https://multi-client-campaign-control-panel.vercel.app/s/northwind-campus` is not public.
- `/sitemap.xml` lists published pages on the Vercel host.

The click-path below is the full journey. It changes demo data, so it was not run again on the hosted database after this check.

## Demo logins

Every account uses the password `Demo1234!`.

| Person | Email | Role | What they can open |
| --- | --- | --- | --- |
| Amina | amina@trident.demo | Owner | Every client in Colombo Campaigns and Archive |
| Ravi | ravi@trident.demo | Editor | Northwind, Lanka Homes, and Island Eats. He can save drafts. He cannot publish. |
| Meera | meera@trident.demo | Reviewer | The same three clients. She can publish and restore a content version. She cannot save drafts. |

City Clinic and Metro Loans stay with Amina. Ravi and Meera do not see them.

## Local installation

You need Node.js 22 and PostgreSQL 16 or newer. The steps below use PowerShell. From the repository root:

1. Create the local database.

```powershell
psql -U postgres -c "CREATE DATABASE ""multi-client-campaign-control-panel"";"
```

2. Create the API environment file.

```powershell
Copy-Item server\.env.example server\.env
```

Open `server\.env` and replace `YOUR_PASSWORD` with the password for the local `postgres` user. Leave `CLIENT_ORIGIN` as the two localhost addresses.

3. Create the React environment file. Leave `VITE_API_URL` empty. Vite then proxies the API, and the sign-in cookie stays on `http://localhost:5173`.

```powershell
Copy-Item client\.env.example client\.env
```

4. Install, create the tables, and load the demo.

```powershell
npm run install:all
npm run migrate
npm run seed
```

`npm run seed` clears and rebuilds the demo. Run it when you want a fresh start. Do not run it against the Render database unless you mean to wipe that demo.

5. Start the API and the React app together.

```powershell
npm run dev
```

6. Open http://localhost:5173 and sign in with one of the emails above.

The API listens on http://localhost:4000. http://localhost:5173/health should show `"database": "up"`.

## Click-path

Use a freshly seeded database for this path. Sign in as the person named in each step. Sign out between people. Sign out is in the panel header. The Back button stays inside the panel and does not return to the login page.

1. Sign in as Amina. Open **Northwind Mobile**. Choose **Create campaign**, name it `Northwind Harbour`, and create it. The new site is a draft. Northwind Mobile is unchanged. Harbour has no internal notes, analytics IDs, or private contact line.
2. On Harbour, change the primary colour, the hero title, and the phone. Choose **Preview**. The preview shows the draft. The public address `/s/northwind-harbour` does not.
3. Publish Harbour. Open `/s/northwind-harbour`. The public page shows the text you published. Northwind Mobile is still the original site.
4. Open **Lanka Homes**. Sinhala is already on the site as a draft. Choose **Import a translation file** and use `client/public/samples/lanka-homes-si.json`. The missing-translation list shows the slots the file left empty. Open `/s/lanka-homes`. The language switcher has English and Tamil. Sinhala is not there until someone publishes it.
5. Open **Update several**. Choose the Festive Fibre Plan price and enter `Rs 3,999`. Tick Northwind Mobile, Northwind Family, Lanka Homes English and Tamil, and Island Eats. Leave Lanka Homes Sinhala, Metro Loans, City Clinic, and Harbour unticked. Review the current value and the next value, then save as a draft. Public prices stay as they were. Publish that bulk change when the review looks right. The ticked rows become `Rs 3,999`. The unticked rows stay `Rs 4,999`.
6. Sign in as Ravi. Open Northwind Mobile and change the hero title, then save the draft. The Publish control tells him an owner or reviewer publishes the website. Sign out. Sign in as Meera and publish Northwind Mobile. Sign out. Sign in as Ravi again, and on the same open draft choose **Save draft** without reloading. The panel shows Meera's version and Ravi's version. Reload keeps Meera's text.
7. Sign in as Amina. Open a live site and choose **Simulate failed launch**, then **Record the failure**. The status becomes failed. The public page stays on the last successful publish. The panel names the site, what happened, and the next action: fix the draft, then publish again.
8. Open **History**. The sentences name what changed, where, who, and when. The current live version is marked. Open an earlier version, read the current value and the value that would replace it, then confirm the restore. The public page changes only after that confirm, and the restore appears as a new history sentence.
9. On Island Eats, choose **Back up this website**, then **Review this backup**. The screen says what the restore will replace. Confirming it puts that copy back and leaves Home, Offers, and Contact in place. Then open **Move to Archive**. The screen lists the internal notes and the private contact line that will be left behind. Confirm the move. Island Eats is then under Archive. Those private values are gone. Ravi and Meera can no longer open it.

Help on each main screen is written for that screen. On **Update several**, Help describes ticking websites and languages and reviewing the current value against the next one.

## Assumptions

- One template. The pages are Home, Offers, and Contact. Clients differ by theme and content.
- A website belongs to one client. A client belongs to one workspace. Staff access is granted per client.
- Copying a website copies structure and published public content. It leaves analytics IDs, internal notes, and private fields on the source. The copy starts as a draft.
- The public site shows published content only. An unpublished language is absent from the switcher, the public JSON, and the sitemap.
- English, Tamil, and Sinhala are the languages in the demo. Another language is added in the panel, not by changing the template.
- A translation file is JSON keyed by field id, such as `home.hero.title`.
- A bulk edit writes one shared value to the selected sites and languages. Everything unticked stays as it is.
- A save sends the revision it was based on. A stale save returns both versions and does not overwrite.
- Publishing stores a snapshot. A failed launch does not replace the live snapshot.
- History is a plain sentence written at the time of the change.
- Sign-in is email and password for the seeded demo users.
- Images are URLs stored on the website. There is no file upload.

## What is simulated

- **Simulate failed launch** is a real API path. It records the failure and leaves the live snapshot in place. It does not depend on a broken host.
- Analytics and Tag Manager IDs are stored and printed on the public page for the demo. They are not sent to Google.
- A backup is a database copy of that website. It is not a file in another store.
- Images are remote URLs.
- Search engines get a unique URL, title, description, heading, `sitemap.xml`, and `robots.txt`. The HTML is rendered in the browser.

## Before daily use

These are deliberately left out of the demo:

- Image files need real storage, with size and type checks, instead of a pasted URL.
- Public HTML needs to be rendered on the server so a browser with JavaScript disabled, and a crawler that does not run the app, still receives the page.
- Backups need a copy outside this database, with a restore test.
- History needs an export a reviewer can download.
- People need a way to reset a password. The demo password is shared on purpose.
- Sign-in and the write APIs need rate limits.

## How it scales

More clients add rows for clients, websites, and grants. They do not add templates. More languages add locale rows on the existing fields. More staff add memberships and per-client grants. A bulk edit stays a filtered write of the selected sites and languages.

## Where it is hosted

The repository is one project with two apps.

- `client/` is the React app on Vercel. The project root is `client`. `VITE_API_URL` is empty. `client/vercel.json` forwards API calls to Render.
- `server/` is the API on Render, in the same region as its PostgreSQL database. The service root is `server`. The build command is `npm install --include=dev && npx prisma migrate deploy`. The start command is `npm start`. `DATABASE_URL` is the database's internal URL. `CLIENT_ORIGIN` and `PUBLIC_SITE_ORIGIN` are the Vercel address, with `https://` and no slash at the end.

The demo seed was run once against that database from a computer, using the external database URL. It is not part of the Render start command.
