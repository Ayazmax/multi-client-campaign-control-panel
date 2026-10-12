import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

const base = process.env.VERIFY_BASE || "http://localhost:5173";

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

function englishPrice(payload) {
  return payload?.site?.offers?.find((offer) => offer.code === "festive-fibre")?.languages?.en?.price;
}

function publicSignature(payload) {
  return JSON.stringify({
    fields: payload?.site?.fields,
    offers: payload?.site?.offers,
    theme: payload?.site?.theme,
  });
}

const amina = await login("amina@trident.demo");
const meera = await login("meera@trident.demo");
const ravi = await login("ravi@trident.demo");

const before = await send("/api/public/sites/northwind-campus");
check(before.status === 404, "Campus is not public before this launch");

const published = await send("/api/panel/sites/northwind-campus/publish", {
  cookie: amina.cookie,
  method: "POST",
  body: {},
});
check(published.status === 200, "Amina can publish Northwind Campus");
const livePublic = await send("/api/public/sites/northwind-campus");
const livePrice = englishPrice(livePublic.body);
const liveCopy = publicSignature(livePublic.body);
check(livePublic.status === 200 && Boolean(livePrice), "Campus is public after publish");

const historyLive = await send("/api/panel/history?site=northwind-campus", { cookie: amina.cookie });
const liveId = historyLive.body?.sites?.find((site) => site.slug === "northwind-campus")?.liveSnapshotId;
check(Boolean(liveId), "Campus has a live snapshot");

const badId = await send("/api/panel/sites/northwind-campus/analytics", {
  cookie: amina.cookie,
  method: "PATCH",
  body: { gaMeasurementId: "not-an-id", gtmContainerId: "" },
});
check(badId.status === 400, "a malformed analytics ID is rejected");

const analytics = await send("/api/panel/sites/northwind-campus/analytics", {
  cookie: amina.cookie,
  method: "PATCH",
  body: { gaMeasurementId: "G-CAMPUSLIVE", gtmContainerId: "GTM-CAMPUS9" },
});
check(analytics.status === 200 && /G-CAMPUSLIVE/.test(analytics.body?.sentence || ""), "Amina can save analytics IDs");
const withIds = await send("/api/public/sites/northwind-campus");
check(withIds.body?.site?.analytics?.gaMeasurementId === "G-CAMPUSLIVE", "the public page returns the Analytics ID");
check(withIds.body?.site?.analytics?.gtmContainerId === "GTM-CAMPUS9", "the public page returns the Tag Manager ID");
check(!JSON.stringify(withIds.body).includes("internalNotes"), "public JSON has no internal notes");
check(englishPrice(withIds.body) === livePrice, "saving analytics does not change the offer");

const meeraAnalytics = await send("/api/panel/sites/northwind-mobile/analytics", {
  cookie: meera.cookie,
  method: "PATCH",
  body: { gaMeasurementId: "G-NOPE9999", gtmContainerId: "" },
});
check(meeraAnalytics.status === 403, "Meera cannot save analytics IDs");
const raviLaunch = await send("/api/panel/sites/northwind-mobile/fail-launch", {
  cookie: ravi.cookie,
  method: "POST",
});
check(raviLaunch.status === 403, "Ravi cannot record a launch");

const failed = await send("/api/panel/sites/northwind-campus/fail-launch", {
  cookie: amina.cookie,
  method: "POST",
});
check(failed.status === 200 && failed.body?.site?.status === "failed", "Amina can simulate a failed launch");
check(/Northwind Campus failed to launch/.test(failed.body?.launch?.message || ""), "the record names the site and what happened");
check(/last successful publish/.test(failed.body?.launch?.nextStep || ""), "the record tells Amina what to do next");

const after = await send("/api/public/sites/northwind-campus");
const historyAfter = await send("/api/panel/history?site=northwind-campus", { cookie: amina.cookie });
const afterId = historyAfter.body?.sites?.find((site) => site.slug === "northwind-campus")?.liveSnapshotId;
check(after.status === 200 && publicSignature(after.body) === liveCopy, "the public Campus page is unchanged");
check(afterId === liveId, "the live snapshot was not replaced");
check(after.body?.site?.analytics?.gaMeasurementId === "G-CAMPUSLIVE", "the analytics IDs stay on the public page");

const meeraCampus = await send("/api/panel/sites/northwind-campus/fail-launch", {
  cookie: meera.cookie,
  method: "POST",
});
check(meeraCampus.status === 404, "Meera cannot open Campus in Archive");
const meeraSites = await send("/api/panel/sites", { cookie: meera.cookie });
const meeraNames = JSON.stringify(meeraSites.body);
check(!meeraNames.includes("northwind-campus") && !meeraNames.includes("city-clinic"), "Meera's list has neither Campus nor City Clinic");
const meeraHistory = await send("/api/panel/history", { cookie: meera.cookie });
check(
  !(meeraHistory.body?.events || []).some((event) => /Northwind Campus failed to launch/.test(event.sentence)),
  "Meera does not see the Campus launch record",
);

const mobilePublic = await send("/api/public/sites/northwind-mobile");
check(mobilePublic.body?.site?.analytics?.gaMeasurementId === "G-NWMOBILE01", "Northwind Mobile still shows its own Analytics ID");

if (failures.length) {
  console.log(`${failures.length} failed`);
  process.exit(1);
}
console.log("phase 9 checks passed");
