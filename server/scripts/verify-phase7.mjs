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
  return payload?.site?.offers?.[0]?.languages?.en?.price;
}

const ravi = await login("ravi@trident.demo");
const meera = await login("meera@trident.demo");
const clinic = await send("/api/panel/sites/city-clinic", { cookie: ravi.cookie });
const clinicMeera = await send("/api/panel/sites/city-clinic", { cookie: meera.cookie });
check(clinic.status === 404, "Ravi cannot open City Clinic");
check(clinicMeera.status === 404, "Meera cannot open City Clinic");

const beforePublic = await send("/api/public/sites/northwind-mobile");
const opened = await send("/api/panel/sites/northwind-mobile", { cookie: ravi.cookie });
const started = opened.body?.site;
const first = await send("/api/panel/sites/northwind-mobile", {
  cookie: ravi.cookie,
  method: "PATCH",
  body: saveBody(started, "Rs 3,200"),
});
const duringPublic = await send("/api/public/sites/northwind-mobile");
check(first.status === 200, "Ravi can save an offer draft");
check(
  englishPrice(duringPublic.body) === englishPrice(beforePublic.body),
  "Ravi's draft stays off the public site",
);

const blockedPublish = await send("/api/panel/sites/northwind-mobile/publish", {
  cookie: ravi.cookie,
  method: "POST",
  body: { language: "en" },
});
check(blockedPublish.status === 403, "Ravi cannot publish");

const blockedSave = await send("/api/panel/sites/northwind-mobile", {
  cookie: meera.cookie,
  method: "PATCH",
  body: saveBody(first.body.site, "Rs 3,200"),
});
check(blockedSave.status === 403, "Meera cannot change content");

const published = await send("/api/panel/sites/northwind-mobile/publish", {
  cookie: meera.cookie,
  method: "POST",
  body: { language: "en" },
});
const afterPublic = await send("/api/public/sites/northwind-mobile");
check(published.status === 200, "Meera can publish Northwind Mobile");
check(englishPrice(afterPublic.body) === "Rs 3,200", "the public offer is the draft Meera published");

const stale = await send("/api/panel/sites/northwind-mobile", {
  cookie: ravi.cookie,
  method: "PATCH",
  body: saveBody(started, "Rs 1,111"),
});
const still = await send("/api/panel/sites/northwind-mobile", { cookie: ravi.cookie });
const offer = stale.body?.conflict?.rows?.find((row) => row.kind === "offer");
check(stale.status === 409, "an overlapping save is rejected");
check(stale.body?.conflict?.savedBy?.includes("Meera"), "the conflict names Meera");
check(offer?.yours?.includes("Rs 1,111") && offer?.theirs?.includes("Rs 3,200"), "the conflict shows both offer versions");
check(
  still.body?.site?.offers?.find((row) => row.language === "en")?.draftPrice === "Rs 3,200",
  "the overlapping save does not replace Meera's text",
);
check(englishPrice((await send("/api/public/sites/northwind-mobile")).body) === "Rs 3,200", "the public page still shows Meera's published price");

if (failures.length) {
  console.error(JSON.stringify(stale.body, null, 2));
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("Phase 7 checks passed.");
