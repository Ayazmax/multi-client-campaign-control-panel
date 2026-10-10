import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

const { prisma } = await import("../src/db.js");
const base = process.env.VERIFY_BASE || "http://localhost:5173";

async function login(email, password = "Demo1234!") {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  const cookie = (response.headers.getSetCookie?.() || [])
    .map((item) => item.split(";")[0])
    .join("; ");
  return { status: response.status, body, cookie };
}

async function send(path, { cookie, method = "GET", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const failures = [];
function check(condition, message) {
  if (condition) console.log(`ok  ${message}`);
  else {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
}

const amina = await login("amina@trident.demo");
const ravi = await login("ravi@trident.demo");
const before = await send("/api/public/sites/northwind-mobile");
const beforeText = JSON.stringify(before.body);

const blocked = await send("/api/panel/sites/northwind-mobile/clone", {
  cookie: (await login("meera@trident.demo")).cookie,
  method: "POST",
  body: { name: "Reviewer copy" },
});
check(blocked.status === 403, "a reviewer cannot create a campaign");

const name = "Northwind Harbour Check";
const cloned = await send("/api/panel/sites/northwind-mobile/clone", {
  cookie: amina.cookie,
  method: "POST",
  body: { name },
});
check(cloned.status === 201, "Amina can clone Northwind Mobile");
const draft = cloned.body?.site;
if (!draft?.slug) {
  console.error(cloned.body);
  await prisma.$disconnect();
  process.exit(1);
}
check(draft?.status === "draft", "the clone starts as a draft");
check(draft?.internalNotes == null, "private notes are not copied");
check(draft?.analytics == null, "analytics IDs are not copied");
check(
  !JSON.stringify(draft || {}).includes("077") && !JSON.stringify(draft || {}).includes("private"),
  "the private contact line is absent",
);
check(
  draft?.fields?.some((field) => field.key === "contact.phone" && field.draftValue === "011 2 555 100"),
  "the public phone is copied into the draft",
);

const editorPublish = await send(`/api/panel/sites/${draft?.slug}/publish`, {
  cookie: ravi.cookie,
  method: "POST",
});
check(editorPublish.status === 403, "an editor cannot publish");

const phone = draft?.fields?.find((field) => field.key === "contact.phone" && field.language === "en");
const offer = draft?.offers?.find((item) => item.language === "en");
const saved = await send(`/api/panel/sites/${draft.slug}`, {
  cookie: amina.cookie,
  method: "PATCH",
  body: {
    theme: draft.theme,
    fields: draft.fields
      .filter((field) => !field.sensitive)
      .map((field) => ({
        key: field.key,
        language: field.language,
        draftValue: field.key === "contact.phone" && field.language === "en" ? "011 2 555 440" : field.draftValue,
        revision: field.revision,
      })),
    offers: draft.offers.map((item) => ({
      code: item.code,
      language: item.language,
      draftLabel: item.draftLabel,
      draftPrice: item.language === "en" ? "Rs 3,499" : item.draftPrice,
      revision: item.revision,
    })),
  },
});
check(saved.status === 200, "Amina can save the offer and phone");
check(
  saved.body?.site?.fields?.find((field) => field.key === "contact.phone")?.draftValue === "011 2 555 440",
  "the draft phone changed",
);
check(saved.body?.site?.offers?.[0]?.draftPrice === "Rs 3,499", "the draft price changed");
check(phone && offer, "the clone had a phone and an offer to edit");

const published = await send(`/api/panel/sites/${draft.slug}/publish`, {
  cookie: amina.cookie,
  method: "POST",
});
check(published.status === 200 && published.body?.site?.status === "live", "publish makes the site live");
check(
  /Northwind Harbour Check was published in English by Amina on /.test(published.body?.sentence || ""),
  "publish writes a plain-language history line",
);

const live = await send(`/api/public/sites/${draft.slug}`);
check(live.status === 200, "the public URL serves the new site");
check(live.body?.site?.fields?.en?.["contact.phone"] === "011 2 555 440", "the public phone is the edited number");
check(live.body?.site?.offers?.[0]?.languages?.en?.price === "Rs 3,499", "the public offer is the edited price");
const liveText = JSON.stringify(live.body);
check(!liveText.includes("077") && !liveText.includes("G-") && !liveText.includes("GTM-"), "private and analytics values stay off the public page");

const after = await send("/api/public/sites/northwind-mobile");
check(JSON.stringify(after.body) === beforeText, "Northwind Mobile's public page is unchanged");

if (draft?.slug) {
  const row = await prisma.site.findUnique({ where: { slug: draft.slug } });
  if (row) {
    await prisma.historyEvent.deleteMany({ where: { siteIds: { has: row.id } } });
    await prisma.site.delete({ where: { id: row.id } });
  }
}
await prisma.$disconnect();

if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("Phase 4 checks passed.");
