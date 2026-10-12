import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

const base = process.env.VERIFY_BASE || "http://localhost:5173";
const prisma = new PrismaClient();
const started = new Date();
const cloneName = "Check Copy Harbour";
const sentinelPhone = "011 0 000 001";

const failures = [];
function check(condition, message) {
  if (condition) console.log(`ok  ${message}`);
  else {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
}

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
  const trimmed = text.trim();
  const json = trimmed.startsWith("{") || trimmed.startsWith("[") ? JSON.parse(trimmed) : null;
  return { status: response.status, body: json, text };
}

function fingerprint(site) {
  return JSON.stringify({
    name: site.name,
    status: site.status,
    notes: site.internalNotes,
    analytics: site.analytics,
    fields: site.fields.map((field) => ({
      key: field.key,
      language: field.language,
      draftValue: field.draftValue,
      publishedValue: field.publishedValue,
      sensitive: field.sensitive,
    })),
    offers: site.offers.map((offer) => ({
      code: offer.code,
      language: offer.language,
      draftPrice: offer.draftPrice,
      publishedPrice: offer.publishedPrice,
    })),
  });
}

function saveBody(site, patchOffer) {
  return {
    theme: site.theme,
    fields: site.fields
      .filter((field) => !field.sensitive)
      .map((field) => ({
        key: field.key,
        language: field.language,
        draftValue: field.draftValue || "",
        revision: field.revision,
      })),
    offers: site.offers.map((offer) => ({
      code: offer.code,
      language: offer.language,
      draftLabel: offer.draftLabel,
      draftPrice: patchOffer && offer.code === patchOffer.code && offer.language === patchOffer.language
        ? patchOffer.draftPrice
        : offer.draftPrice,
      revision: patchOffer && offer.code === patchOffer.code && offer.language === patchOffer.language
        ? patchOffer.revision
        : offer.revision,
    })),
  };
}

function englishOffer(payload) {
  return payload?.site?.offers?.find((offer) => offer.code === "festive-fibre")?.languages?.en?.price;
}

async function cleanup({ cloneSlug, addedLanguage, phoneSite }) {
  if (cloneSlug) {
    await prisma.site.deleteMany({ where: { slug: cloneSlug } });
    await prisma.historyEvent.deleteMany({
      where: { sentence: { contains: cloneName }, createdAt: { gte: started } },
    });
  }
  if (addedLanguage) {
    const site = await prisma.site.findUnique({ where: { slug: addedLanguage.slug } });
    if (site) {
      const language = await prisma.language.findUnique({ where: { code: addedLanguage.code } });
      if (language) {
        await prisma.contentValue.deleteMany({ where: { siteId: site.id, languageId: language.id } });
        await prisma.siteOffer.deleteMany({ where: { siteId: site.id, languageId: language.id } });
        await prisma.siteLanguage.deleteMany({
          where: { siteId: site.id, languageId: language.id, status: "draft" },
        });
      }
    }
    await prisma.historyEvent.deleteMany({
      where: {
        sentence: { contains: `added ${addedLanguage.name} to ${addedLanguage.siteName}` },
        createdAt: { gte: started },
      },
    });
  }
  if (phoneSite) {
    await prisma.historyEvent.deleteMany({
      where: { sentence: { contains: sentinelPhone }, createdAt: { gte: started } },
    });
  }
}

const amina = await login("amina@trident.demo");
const meera = await login("meera@trident.demo");
const ravi = await login("ravi@trident.demo");

const cleanupState = { cloneSlug: "", addedLanguage: null, phoneSite: false };

try {
  const sourceBefore = await send("/api/panel/sites/island-eats", { cookie: amina.cookie });
  const sourceSite = sourceBefore.body.site;
  const privateBefore = sourceSite.fields.filter((field) => field.sensitive && (field.draftValue || field.publishedValue));
  check(sourceBefore.status === 200 && privateBefore.length > 0, "Island Eats has a private field before the clone");
  const sourceCopy = fingerprint(sourceSite);
  const publicBefore = await send("/api/public/sites/island-eats");

  const cloned = await send("/api/panel/sites/island-eats/clone", {
    cookie: ravi.cookie,
    method: "POST",
    body: { name: cloneName },
  });
  if (cloned.status === 201) cleanupState.cloneSlug = cloned.body?.site?.slug || "";
  check(cloned.status === 201, "Ravi can clone Island Eats");
  const copy = cloned.body?.site;
  const privateCopied = (copy?.fields || []).filter((field) => field.sensitive && (field.draftValue || field.publishedValue));
  check(privateCopied.length === 0, "the clone does not copy private fields");
  check(copy?.internalNotes == null, "the clone does not copy internal notes");
  check(copy?.analytics == null, "the clone does not copy analytics IDs");
  check(!JSON.stringify(copy).includes(privateBefore[0].draftValue || privateBefore[0].publishedValue), "the private text is absent from the clone");

  const sourceAfter = await send("/api/panel/sites/island-eats", { cookie: amina.cookie });
  const publicAfter = await send("/api/public/sites/island-eats");
  check(fingerprint(sourceAfter.body.site) === sourceCopy, "cloning does not change the source site");
  check(JSON.stringify(publicAfter.body) === JSON.stringify(publicBefore.body), "cloning does not change the public source page");

  const harbour = await send("/api/panel/sites/northwind-harbour", { cookie: amina.cookie });
  const harbourSite = harbour.body.site;
  const already = harbourSite.languages.find((language) => language.code === "si");
  let draftCode = already?.status === "draft" ? "si" : "";
  let draftName = already?.status === "draft" ? already.name : "";
  if (!already) {
    const added = await send("/api/panel/sites/northwind-harbour/languages", {
      cookie: ravi.cookie,
      method: "POST",
      body: { code: "si" },
    });
    check(added.status === 201 && added.body.site.languages.some((language) => language.code === "si" && language.status === "draft"), "Sinhala can be added as a draft");
    draftCode = "si";
    draftName = "Sinhala";
    cleanupState.addedLanguage = { slug: "northwind-harbour", code: "si", name: "Sinhala", siteName: harbourSite.name };
  }
  if (draftCode) {
    const publicHarbour = await send("/api/public/sites/northwind-harbour");
    const codes = (publicHarbour.body?.site?.languages || []).map((language) => language.code);
    check(!codes.includes(draftCode), "an unpublished language is not in the public language list");
    check(!publicHarbour.body?.site?.fields?.[draftCode], "an unpublished language has no public text");
    const sitemapMid = await send("/sitemap.xml");
    const harbourLocs = [...sitemapMid.text.matchAll(/<loc>(.*?)<\/loc>/g)]
      .map((match) => match[1])
      .filter((loc) => loc.includes("/s/northwind-harbour"));
    check(harbourLocs.length > 0 && harbourLocs.every((loc) => !loc.includes("lang=si")), "Harbour Sinhala is absent from the sitemap");
  } else {
    check(false, "Northwind Harbour has no draft language to check");
  }

  const matrixBefore = await send("/api/panel/bulk?item=contact.phone", { cookie: amina.cookie });
  const harbourPhone = matrixBefore.body.sites
    .find((site) => site.slug === "northwind-harbour")
    ?.languages.find((language) => language.code === "en");
  const othersBefore = JSON.stringify(
    matrixBefore.body.sites
      .filter((site) => site.slug !== "northwind-harbour")
      .map((site) => ({ slug: site.slug, languages: site.languages })),
  );
  const bulk = await send("/api/panel/bulk", {
    cookie: ravi.cookie,
    method: "POST",
    body: {
      item: "contact.phone",
      value: sentinelPhone,
      mode: "draft",
      targets: [{ slug: "northwind-harbour", languages: ["en"] }],
    },
  });
  cleanupState.phoneSite = true;
  check(bulk.status === 200, "a draft bulk edit of one site and language is accepted");
  const matrixAfter = await send("/api/panel/bulk?item=contact.phone", { cookie: amina.cookie });
  const harbourAfter = matrixAfter.body.sites
    .find((site) => site.slug === "northwind-harbour")
    ?.languages.find((language) => language.code === "en");
  const othersAfter = JSON.stringify(
    matrixAfter.body.sites
      .filter((site) => site.slug !== "northwind-harbour")
      .map((site) => ({ slug: site.slug, languages: site.languages })),
  );
  const publicHarbourPhone = await send("/api/public/sites/northwind-harbour");
  check(harbourAfter?.current === sentinelPhone, "the selected site draft changed");
  check(harbourAfter?.published === harbourPhone.published, "the published phone on that site stayed the same");
  check(othersAfter === othersBefore, "sites that were not selected kept their phones");
  check(
    publicHarbourPhone.body?.site?.fields?.en?.["contact.phone"] === harbourPhone.published,
    "a draft bulk edit does not change the public page",
  );
  const reverted = await send("/api/panel/bulk", {
    cookie: ravi.cookie,
    method: "POST",
    body: {
      item: "contact.phone",
      value: harbourPhone.current,
      mode: "draft",
      targets: [{ slug: "northwind-harbour", languages: ["en"] }],
    },
  });
  const matrixRestored = await send("/api/panel/bulk?item=contact.phone", { cookie: amina.cookie });
  const harbourRestored = matrixRestored.body.sites
    .find((site) => site.slug === "northwind-harbour")
    ?.languages.find((language) => language.code === "en");
  check(reverted.status === 200 && harbourRestored?.current === harbourPhone.current, "the Harbour phone draft was put back");

  const mobile = await send("/api/panel/sites/northwind-mobile", { cookie: ravi.cookie });
  const mobileSite = mobile.body.site;
  const hero = mobileSite.fields.find((field) => field.key === "home.hero.title" && field.language === "en");
  const originalHero = hero.draftValue;
  const aminaSave = await send("/api/panel/sites/northwind-mobile", {
    cookie: amina.cookie,
    method: "PATCH",
    body: saveBody({
      ...mobileSite,
      fields: mobileSite.fields.map((field) =>
        field === hero ? { ...field, draftValue: `${originalHero} check` } : field,
      ),
    }),
  });
  check(aminaSave.status === 200, "Amina can save a newer Mobile draft");
  const stale = await send("/api/panel/sites/northwind-mobile", {
    cookie: ravi.cookie,
    method: "PATCH",
    body: saveBody(mobileSite, {
      code: "festive-fibre",
      language: "en",
      draftPrice: "Rs 1",
      revision: 0,
    }),
  });
  check(stale.status === 409 && stale.body?.conflict, "a stale save returns a conflict");
  const during = await send("/api/panel/sites/northwind-mobile", { cookie: ravi.cookie });
  const duringHero = during.body.site.fields.find((field) => field.key === "home.hero.title" && field.language === "en");
  const duringPrice = during.body.site.offers.find((offer) => offer.code === "festive-fibre" && offer.language === "en");
  check(duringHero.draftValue === `${originalHero} check`, "the conflict did not replace the newer draft");
  check(duringPrice.draftPrice !== "Rs 1" && duringPrice.publishedPrice === "Rs 2,750", "the conflict did not write the stale offer price");
  const restoreDraft = await send("/api/panel/sites/northwind-mobile", {
    cookie: amina.cookie,
    method: "PATCH",
    body: saveBody({
      ...during.body.site,
      fields: during.body.site.fields.map((field) =>
        field.key === "home.hero.title" && field.language === "en" ? { ...field, draftValue: originalHero } : field,
      ),
    }),
  });
  const restoredMobile = await send("/api/panel/sites/northwind-mobile", { cookie: ravi.cookie });
  const restoredHero = restoredMobile.body.site.fields.find((field) => field.key === "home.hero.title" && field.language === "en");
  check(restoreDraft.status === 200 && restoredHero.draftValue === originalHero, "the Mobile hero draft is back to the original text");

  const campus = await send("/api/panel/sites/northwind-campus", { cookie: amina.cookie });
  const campusHistory = await send("/api/panel/history?site=northwind-campus", { cookie: amina.cookie });
  const campusLive = campusHistory.body.sites.find((site) => site.slug === "northwind-campus")?.liveSnapshotId;
  const failEvent = campusHistory.body.events.find((event) => /failed to launch/.test(event.sentence));
  const campusPublic = await send("/api/public/sites/northwind-campus");
  check(campus.body.site.status === "failed" && campus.body.launch?.outcome === "failed", "Campus is recorded as a failed launch");
  check(Boolean(campusLive) && failEvent?.snapshotId === campusLive, "the failed launch kept the live snapshot");
  check(campusPublic.status === 200 && Boolean(englishOffer(campusPublic.body)), "the public Campus page is still the last publish");
  check(/last successful publish/.test(campus.body.launch?.nextStep || ""), "the panel tells Amina what to do next");

  const mobileHistory = await send("/api/panel/history?site=northwind-mobile", { cookie: meera.cookie });
  const mobilePublic = await send("/api/public/sites/northwind-mobile");
  const restoredEvent = mobileHistory.body.events.find((event) => /restored/.test(event.sentence) && /Rs 2,750/.test(event.sentence));
  const earlier = mobileHistory.body.events.find((event) => event.canRestore && event.snapshotId && (event.offers || []).some((offer) => offer.price && offer.price !== "Rs 2,750"));
  check(englishOffer(mobilePublic.body) === "Rs 2,750", "Northwind Mobile is still the restored Rs 2,750 price");
  check(Boolean(restoredEvent), "history says the earlier offer text was restored");
  const preview = earlier
    ? await send(`/api/panel/sites/northwind-mobile/versions/${earlier.snapshotId}`, { cookie: meera.cookie })
    : { status: 0, body: null };
  const offerChange = preview.body?.changes?.find((row) => /Festive Fibre|Offer price|price/i.test(row.label));
  check(
    preview.status === 200 && /updates when you confirm/.test(preview.body?.warning || "") && Boolean(offerChange?.restored),
    "the restore screen shows the earlier offer text before it runs",
  );
  const mobileStill = await send("/api/public/sites/northwind-mobile");
  check(englishOffer(mobileStill.body) === "Rs 2,750", "opening the restore screen does not change the live price");

  const backups = await send("/api/panel/sites/island-eats/backups", { cookie: amina.cookie });
  const backupId = backups.body?.backups?.[0]?.id;
  const backupPreview = await send(`/api/panel/sites/island-eats/backups/${backupId}`, { cookie: amina.cookie });
  check(
    backupPreview.status === 200 && /replaces the current draft and the published page/.test(backupPreview.body?.warning || ""),
    "backup restore states what will be replaced before it runs",
  );
  const transfer = await send("/api/panel/sites/island-eats/transfer", { cookie: amina.cookie });
  const leftoverLabels = (transfer.body?.stripped || []).map((row) => row.label).join(" ");
  check(
    transfer.status === 200 &&
      /private fields are removed/.test(transfer.body?.warning || "") &&
      /Internal notes/.test(leftoverLabels) &&
      /private|Private|contact/i.test(JSON.stringify(transfer.body?.stripped || [])),
    "the move screen lists private data that would be left behind",
  );
  const eatsStill = await send("/api/panel/sites/island-eats", { cookie: amina.cookie });
  check(eatsStill.body.site.workspace.name === "Colombo Campaigns", "Island Eats was not moved");

  const editorPublish = await send("/api/panel/sites/northwind-mobile/publish", {
    cookie: ravi.cookie,
    method: "POST",
    body: { language: "en" },
  });
  const afterEditor = await send("/api/public/sites/northwind-mobile");
  check(editorPublish.status === 403, "an editor cannot publish");
  check(englishOffer(afterEditor.body) === "Rs 2,750", "the refused publish left Mobile unchanged");
  const city = await send("/api/panel/sites/city-clinic", { cookie: meera.cookie });
  const meeraSites = await send("/api/panel/sites", { cookie: meera.cookie });
  check(city.status === 404, "a reviewer cannot open an unassigned client");
  check(!JSON.stringify(meeraSites.body).includes("city-clinic"), "City Clinic is absent from Meera's list");

  const sitemap = await send("/sitemap.xml");
  const locs = [...sitemap.text.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  const sites = await prisma.site.findMany({
    include: { pages: true, siteLanguages: { include: { language: true } } },
  });
  const order = ["en", "ta", "si"];
  function locsFor(slug) {
    return locs.filter((loc) => {
      const pathName = new URL(loc).pathname;
      return pathName === `/s/${slug}` || pathName.startsWith(`/s/${slug}/`);
    });
  }
  let sitemapOk = locs.length > 0 && locs.every((loc) => /\/s\/[a-z0-9-]+/.test(new URL(loc).pathname) && !loc.includes("/preview") && !loc.includes("/app/"));
  for (const site of sites) {
    const published = site.siteLanguages
      .filter((item) => item.status === "published")
      .map((item) => item.language.code)
      .sort((left, right) => (order.indexOf(left) === -1 ? 99 : order.indexOf(left)) - (order.indexOf(right) === -1 ? 99 : order.indexOf(right)));
    const mentioned = locsFor(site.slug);
    if (!site.liveSnapshotId || published.length === 0) {
      if (mentioned.length) sitemapOk = false;
      continue;
    }
    const [, ...extra] = published;
    const expected = site.pages.length * published.length;
    if (mentioned.length !== expected) sitemapOk = false;
    for (const loc of mentioned) {
      const lang = new URL(loc).searchParams.get("lang");
      if (lang && !extra.includes(lang)) sitemapOk = false;
    }
    for (const item of site.siteLanguages) {
      if (item.status !== "published" && mentioned.some((loc) => new URL(loc).searchParams.get("lang") === item.language.code)) {
        sitemapOk = false;
      }
    }
  }
  check(sitemap.status === 200 && sitemapOk, "the sitemap lists only public, published site URLs");
  check(locs.some((loc) => loc.includes("/s/northwind-campus")) && !locs.some((loc) => loc.includes("preview")), "the live Campus page is listed and previews are not");
} finally {
  await cleanup(cleanupState);
  await prisma.$disconnect();
}

if (failures.length) {
  console.log(`${failures.length} failed`);
  process.exit(1);
}
console.log("phase 10 checks passed");
