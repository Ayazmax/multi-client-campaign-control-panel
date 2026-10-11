import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

const base = process.env.VERIFY_BASE || "http://localhost:5173";
const prisma = new PrismaClient();

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
  return { cookie, body };
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

function saveBody(site, price) {
  return {
    theme: site.theme,
    fields: site.fields
      .filter((field) => !field.sensitive)
      .map((field) => ({
        key: field.key,
        language: field.language,
        draftValue: field.draftValue,
        revision: field.revision,
      })),
    offers: site.offers.map((offer) => ({
      code: offer.code,
      language: offer.language,
      draftLabel: offer.draftLabel,
      draftPrice: offer.language === "en" ? price : offer.draftPrice,
      revision: offer.revision,
    })),
  };
}

function englishPrice(payload) {
  return payload?.offers?.find((offer) => offer.code === "festive-fibre")?.languages?.en?.price
    || payload?.site?.offers?.find((offer) => offer.code === "festive-fibre")?.languages?.en?.price;
}

try {
  const ravi = await login("ravi@trident.demo");
  const meera = await login("meera@trident.demo");
  const amina = await login("amina@trident.demo");

  const beforePublic = await send("/api/public/sites/northwind-mobile");
  const original = englishPrice(beforePublic.body);
  const historyBefore = await send("/api/panel/history?site=northwind-mobile", { cookie: meera.cookie });
  const mobile = historyBefore.body?.sites?.find((site) => site.slug === "northwind-mobile");
  const previousSnapshot = mobile?.liveSnapshotId;
  check(Boolean(original && previousSnapshot), "history names the live version before the mistake");

  const opened = await send("/api/panel/sites/northwind-mobile", { cookie: ravi.cookie });
  const drafted = await send("/api/panel/sites/northwind-mobile", {
    cookie: ravi.cookie,
    method: "PATCH",
    body: saveBody(opened.body.site, "Rs 8,888"),
  });
  check(drafted.status === 200, "Ravi can save the wrong price as a draft");
  const stillPublic = await send("/api/public/sites/northwind-mobile");
  check(englishPrice(stillPublic.body) === original, "the draft price stays off the public page");

  const blockedRestore = await send(`/api/panel/sites/northwind-mobile/versions/${previousSnapshot}/restore`, {
    cookie: ravi.cookie,
    method: "POST",
  });
  check(blockedRestore.status === 403, "Ravi cannot restore a version");
  const blockedBackup = await send("/api/panel/sites/northwind-mobile/backups", {
    cookie: meera.cookie,
    method: "POST",
  });
  check(blockedBackup.status === 403, "Meera cannot take a backup");

  const published = await send("/api/panel/sites/northwind-mobile/publish", {
    cookie: meera.cookie,
    method: "POST",
    body: { language: "en" },
  });
  check(published.status === 200, "Meera can publish the wrong price");
  const wrongPublic = await send("/api/public/sites/northwind-mobile");
  check(englishPrice(wrongPublic.body) === "Rs 8,888", "the public page shows the wrong price");

  const historyWrong = await send("/api/panel/history?site=northwind-mobile", { cookie: meera.cookie });
  const liveWrong = historyWrong.body?.events?.find((event) => event.live);
  check(
    Boolean(liveWrong?.offers?.some((offer) => offer.price === "Rs 8,888" && offer.language === "English")),
    "history marks the live version and shows the wrong price",
  );
  const preview = await send(`/api/panel/sites/northwind-mobile/versions/${previousSnapshot}`, { cookie: meera.cookie });
  check(
    preview.body?.changes?.some((row) => row.current === "Rs 8,888" && row.restored === original),
    "the restore screen shows the wrong price and the earlier price",
  );

  const restored = await send(`/api/panel/sites/northwind-mobile/versions/${previousSnapshot}/restore`, {
    cookie: meera.cookie,
    method: "POST",
  });
  check(restored.status === 200 && /restored/i.test(restored.body?.sentence || ""), "Meera can restore the earlier version");
  const afterPublic = await send("/api/public/sites/northwind-mobile");
  check(englishPrice(afterPublic.body) === original, "the public page is back to the earlier price");

  const historyAfter = await send("/api/panel/history?site=northwind-mobile", { cookie: meera.cookie });
  const liveAfter = historyAfter.body?.events?.find((event) => event.live);
  check(
    Boolean(liveAfter?.sentence?.includes("restored") && liveAfter.offers?.some((offer) => offer.price === original)),
    "the restore is a new history event and is marked live",
  );
  const raviHistory = await send("/api/panel/history?site=northwind-mobile", { cookie: ravi.cookie });
  check(raviHistory.body?.events?.every((event) => event.canRestore === false), "Ravi can read history and cannot restore");

  const eatsBefore = await send("/api/public/sites/island-eats");
  const eatsPrice = englishPrice(eatsBefore.body);
  const eatsOpened = await send("/api/panel/sites/island-eats", { cookie: amina.cookie });
  const backup = await send("/api/panel/sites/island-eats/backups", { cookie: amina.cookie, method: "POST" });
  check(backup.status === 201, "Amina can back up a website");
  const hero = eatsOpened.body.site.fields.find((field) => field.key === "home.hero.title" && field.language === "en");
  const changed = {
    theme: eatsOpened.body.site.theme,
    fields: eatsOpened.body.site.fields
      .filter((field) => !field.sensitive)
      .map((field) => ({
        key: field.key,
        language: field.language,
        draftValue: field.key === "home.hero.title" && field.language === "en" ? "A temporary title" : field.draftValue,
        revision: field.revision,
      })),
    offers: eatsOpened.body.site.offers.map((offer) => ({
      code: offer.code,
      language: offer.language,
      draftLabel: offer.draftLabel,
      draftPrice: offer.draftPrice,
      revision: offer.revision,
    })),
  };
  const savedTitle = await send("/api/panel/sites/island-eats", { cookie: amina.cookie, method: "PATCH", body: changed });
  check(savedTitle.status === 200, "Amina can change a draft after the backup");
  const warning = await send(`/api/panel/sites/island-eats/backups/${backup.body.backup.id}`, { cookie: amina.cookie });
  check(
    Boolean(warning.body?.warning && warning.body.changes?.some((row) => row.current === "A temporary title" && row.restored === hero.draftValue)),
    "the backup screen names what will be replaced",
  );
  const backupRestored = await send(`/api/panel/sites/island-eats/backups/${backup.body.backup.id}/restore`, {
    cookie: amina.cookie,
    method: "POST",
  });
  const eatsAfter = await send("/api/panel/sites/island-eats", { cookie: amina.cookie });
  const heroAfter = eatsAfter.body?.site?.fields?.find((field) => field.key === "home.hero.title" && field.language === "en");
  check(backupRestored.status === 200 && heroAfter?.draftValue === hero.draftValue, "Amina can restore the backup");
  const eatsPublic = await send("/api/public/sites/island-eats");
  check(englishPrice(eatsPublic.body) === eatsPrice, "the Island Eats public price stays the same");

  const campus = await prisma.site.findUnique({
    where: { slug: "northwind-campus" },
    include: { pages: true },
  });
  const pageIds = campus.pages.map((page) => page.id).sort();
  const english = await prisma.language.findUnique({ where: { code: "en" } });
  const privateField = await prisma.contentField.findUnique({ where: { key: "contact.private_line" } });
  await prisma.site.update({
    where: { id: campus.id },
    data: { internalNotes: "Campus launch notes stay inside Colombo." },
  });
  await prisma.analyticsSettings.upsert({
    where: { siteId: campus.id },
    create: { siteId: campus.id, gaMeasurementId: "G-CAMPUS99", gtmContainerId: "GTM-CAMPUS" },
    update: { gaMeasurementId: "G-CAMPUS99", gtmContainerId: "GTM-CAMPUS" },
  });
  await prisma.contentValue.upsert({
    where: { siteId_fieldId_languageId: { siteId: campus.id, fieldId: privateField.id, languageId: english.id } },
    create: {
      siteId: campus.id,
      fieldId: privateField.id,
      languageId: english.id,
      draftValue: "Warden mobile 077 000 0000",
    },
    update: { draftValue: "Warden mobile 077 000 0000" },
  });

  const movePreview = await send("/api/panel/sites/northwind-campus/transfer", { cookie: amina.cookie });
  const stripped = movePreview.body?.stripped || [];
  check(movePreview.body?.to === "Archive", "the move screen names Archive");
  check(stripped.some((row) => row.value === "Campus launch notes stay inside Colombo."), "the warning shows the internal notes");
  check(stripped.some((row) => row.value === "G-CAMPUS99"), "the warning shows the analytics ID");
  check(stripped.some((row) => row.value === "GTM-CAMPUS"), "the warning shows the tag manager ID");
  check(stripped.some((row) => row.value === "Warden mobile 077 000 0000"), "the warning shows the private contact line");
  const meeraMove = await send("/api/panel/sites/northwind-campus/transfer", { cookie: meera.cookie, method: "POST" });
  check(meeraMove.status === 403, "Meera cannot move a website");

  const moved = await send("/api/panel/sites/northwind-campus/transfer", { cookie: amina.cookie, method: "POST" });
  check(moved.status === 200 && moved.body?.pagesKept === true, "Amina can move the website and the pages stay");
  check(/left behind/i.test(moved.body?.sentence || ""), "the move is written to history");
  const movedSite = await prisma.site.findUnique({
    where: { slug: "northwind-campus" },
    include: {
      pages: true,
      analytics: true,
      client: { include: { workspace: true } },
      contentValues: { include: { field: true } },
    },
  });
  const movedPageIds = movedSite.pages.map((page) => page.id).sort();
  check(movedSite.client.workspace.slug === "archive", "the website is in Archive");
  check(movedPageIds.join() === pageIds.join(), "the same pages are still on the website");
  check(movedSite.internalNotes == null && movedSite.analytics == null, "notes and analytics IDs were removed");
  const privateAfter = movedSite.contentValues.find((value) => value.field.key === "contact.private_line");
  check(!privateAfter?.draftValue && !privateAfter?.publishedValue, "the private contact line was removed");
  const meeraCampus = await send("/api/panel/sites/northwind-campus", { cookie: meera.cookie });
  check(meeraCampus.status === 404, "Meera cannot open the website after it leaves her workspace");
  const aminaList = await send("/api/panel/sites", { cookie: amina.cookie });
  const archive = aminaList.body?.workspaces?.find((workspace) => workspace.slug === "archive");
  check(archive?.sites?.some((site) => site.slug === "northwind-campus"), "Amina sees the website in Archive");
} finally {
  await prisma.$disconnect();
}

if (failures.length) {
  console.log(`${failures.length} failed`);
  process.exit(1);
}
console.log("phase 8 checks passed");
