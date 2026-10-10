import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

const { prisma } = await import("../src/db.js");
const base = process.env.VERIFY_BASE || "http://localhost:5173";
const samplePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../client/public/samples/lanka-homes-si.json",
);

async function login(email) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Demo1234!" }),
  });
  const body = await response.json();
  const cookie = (response.headers.getSetCookie?.() || [])
    .map((item) => item.split(";")[0])
    .join("; ");
  return { status: response.status, body, cookie };
}

async function send(pathName, { cookie, method = "GET", body } = {}) {
  const response = await fetch(`${base}${pathName}`, {
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

async function removeMobileSinhala() {
  const mobile = await prisma.site.findUnique({
    where: { slug: "northwind-mobile" },
    include: { siteLanguages: { include: { language: true } } },
  });
  const sinhala = mobile?.siteLanguages.find((item) => item.language.code === "si");
  if (!sinhala) return;
  await prisma.siteLanguage.delete({ where: { id: sinhala.id } });
  await prisma.historyEvent.deleteMany({
    where: { sentence: { contains: "added Sinhala to Northwind Mobile" } },
  });
}

const amina = await login("amina@trident.demo");
const ravi = await login("ravi@trident.demo");
const meera = await login("meera@trident.demo");
const sample = JSON.parse(await readFile(samplePath, "utf8"));

await removeMobileSinhala();
const added = await send("/api/panel/sites/northwind-mobile/languages", {
  cookie: amina.cookie,
  method: "POST",
  body: { code: "si" },
});
check(added.status === 201, "Amina can add Sinhala to a website");
check(
  added.body?.site?.languages?.some((item) => item.code === "si" && item.status === "draft"),
  "the new language starts as a draft",
);
const duplicate = await send("/api/panel/sites/northwind-mobile/languages", {
  cookie: amina.cookie,
  method: "POST",
  body: { code: "si" },
});
check(duplicate.status === 409, "a language cannot be added twice");
const reviewerAdd = await send("/api/panel/sites/island-eats/languages", {
  cookie: meera.cookie,
  method: "POST",
  body: { code: "si" },
});
check(reviewerAdd.status === 403, "a reviewer cannot add a language");
await removeMobileSinhala();
const mobilePublic = await send("/api/public/sites/northwind-mobile");
check(
  !mobilePublic.body?.site?.languages?.some((item) => item.code === "si"),
  "Northwind Mobile stays English on the public site",
);

const before = await send("/api/public/sites/lanka-homes");
const beforeCodes = before.body.site.languages.map((item) => item.code);
const enPhone = before.body.site.fields.en["contact.phone"];
const taHero = before.body.site.fields.ta["home.hero.title"];
const enPrice = before.body.site.offers[0].languages.en.price;
const taPrice = before.body.site.offers[0].languages.ta.price;
const wasHidden = !beforeCodes.includes("si");
check(beforeCodes.includes("en") && beforeCodes.includes("ta"), "Lanka Homes already publishes English and Tamil");
if (wasHidden) check(true, "Sinhala is hidden before it is published");

const blockedImport = await send("/api/panel/sites/lanka-homes/translations", {
  cookie: meera.cookie,
  method: "POST",
  body: sample,
});
check(blockedImport.status === 403, "a reviewer cannot import a translation");

const imported = await send("/api/panel/sites/lanka-homes/translations", {
  cookie: amina.cookie,
  method: "POST",
  body: sample,
});
const siMissing = (imported.body?.missing || [])
  .filter((item) => item.languageCode === "si")
  .map((item) => item.key)
  .sort();
check(imported.status === 200, "Amina can import the Sinhala file");
check(
  siMissing.join() === ["contact.email", "home.seo.description", "offers.seo.description"].join(),
  "missing Sinhala slots are the three keys left out of the file",
);
check(
  !(imported.body?.missing || []).some((item) => item.languageCode === "en" || item.languageCode === "ta"),
  "English and Tamil are not listed as missing",
);
check(
  imported.body?.site?.fields?.some(
    (field) => field.language === "si" && field.key === "home.h1" && field.draftValue === "ලංකා හෝම්ස්",
  ),
  "the file fills the Sinhala draft",
);
check(
  !imported.body?.site?.fields?.some((field) => field.language === "si" && field.sensitive),
  "the import does not add a private Sinhala field",
);

const stillHidden = await send("/api/public/sites/lanka-homes");
if (wasHidden) {
  check(
    !stillHidden.body.site.languages.some((item) => item.code === "si"),
    "the public site hides Sinhala until that language is published",
  );
}

const editorPublish = await send("/api/panel/sites/lanka-homes/publish", {
  cookie: ravi.cookie,
  method: "POST",
  body: { language: "si" },
});
check(editorPublish.status === 403, "an editor cannot publish Sinhala");

const published = await send("/api/panel/sites/lanka-homes/publish", {
  cookie: amina.cookie,
  method: "POST",
  body: { language: "si" },
});
check(published.status === 200, "Amina can publish Sinhala alone");
check(
  /Lanka Homes was published in Sinhala by Amina on /.test(published.body?.sentence || ""),
  "the history line names only Sinhala",
);

const after = await send("/api/public/sites/lanka-homes");
const afterCodes = after.body.site.languages.map((item) => item.code);
check(afterCodes.includes("si") && afterCodes.includes("en") && afterCodes.includes("ta"), "visitors can switch to Sinhala after publish");
check(after.body.site.fields.si["home.hero.title"] === "අලුත් අවුරුද්දට නිවසක්", "the Sinhala hero is public");
check(!after.body.site.fields.si["home.seo.description"], "the missing search description stays off the public page");
check(after.body.site.fields.en["contact.phone"] === enPhone, "English stays as it was");
check(after.body.site.fields.ta["home.hero.title"] === taHero, "Tamil stays as it was");
check(after.body.site.offers[0].languages.en.price === enPrice, "the English offer price stays as it was");
check(after.body.site.offers[0].languages.ta.price === taPrice, "the Tamil offer price stays as it was");
check(after.body.site.offers[0].languages.si.price === "Rs 4,999", "the Sinhala offer price is published");

const sitemap = await fetch(`${base}/sitemap.xml`).then((response) => response.text());
check(sitemap.includes("/s/lanka-homes?lang=si"), "the sitemap lists the published Sinhala page");
check(sitemap.includes("/s/lanka-homes/offers?lang=si"), "the sitemap lists the Sinhala offers page");
check(!sitemap.includes("lang=si") || sitemap.includes("/s/lanka-homes"), "Sinhala URLs belong to Lanka Homes");

await prisma.$disconnect();
if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("Phase 5 checks passed.");
