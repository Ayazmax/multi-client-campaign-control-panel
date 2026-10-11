import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

const base = process.env.VERIFY_BASE || "http://localhost:5173";
const targets = [
  { slug: "northwind-mobile", languages: ["en"] },
  { slug: "northwind-family", languages: ["en", "ta"] },
  { slug: "lanka-homes", languages: ["en", "ta"] },
  { slug: "island-eats", languages: ["en"] },
];

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

function offerPrice(payload, language) {
  return payload?.site?.offers?.[0]?.languages?.[language]?.price;
}

const amina = await login("amina@trident.demo");
const ravi = await login("ravi@trident.demo");
const matrix = await send("/api/panel/bulk?item=offer.festive-fibre.price", { cookie: amina.cookie });
const slugs = matrix.body?.sites?.map((site) => site.slug) || [];
check(matrix.status === 200, "Amina can open the shared update");
check(slugs.includes("city-clinic") && slugs.includes("metro-loans"), "excluded websites are listed");
check(
  matrix.body.sites.find((site) => site.slug === "lanka-homes")?.languages.some((language) => language.code === "si"),
  "Sinhala is available to leave out",
);

const before = {
  mobile: await send("/api/public/sites/northwind-mobile"),
  family: await send("/api/public/sites/northwind-family"),
  lanka: await send("/api/public/sites/lanka-homes"),
  eats: await send("/api/public/sites/island-eats"),
  metro: await send("/api/public/sites/metro-loans"),
  clinic: await send("/api/public/sites/city-clinic"),
  harbour: await send("/api/public/sites/northwind-harbour"),
};

const draft = await send("/api/panel/bulk", {
  cookie: amina.cookie,
  method: "POST",
  body: { item: "offer.festive-fibre.price", value: "Rs 3,999", mode: "draft", targets },
});
check(draft.status === 200 && /saved as a draft/.test(draft.body?.sentence || ""), "saving as a draft writes one history line");
const during = await send("/api/public/sites/northwind-mobile");
check(
  offerPrice(during.body, "en") === offerPrice(before.mobile.body, "en"),
  "a draft update does not change the public price",
);

const blocked = await send("/api/panel/bulk", {
  cookie: ravi.cookie,
  method: "POST",
  body: { item: "offer.festive-fibre.price", value: "Rs 3,999", mode: "publish", targets },
});
check(blocked.status === 403, "an editor cannot publish the shared update");

const published = await send("/api/panel/bulk", {
  cookie: amina.cookie,
  method: "POST",
  body: { item: "offer.festive-fibre.price", value: "Rs 3,999", mode: "publish", targets },
});
check(published.status === 200, "Amina can publish the shared update");
check(
  /Festive Fibre Plan price changed from Rs 4,999 to Rs 3,999 in English and Tamil on four websites, by Amina on /.test(
    (published.body?.sentence || "").replace(", on", " on"),
  ) || /Festive Fibre Plan price changed from Rs .+ to Rs 3,999 in English and Tamil on four websites, by Amina, on /.test(published.body?.sentence || ""),
  "the history line names the scope",
);

const after = {
  mobile: await send("/api/public/sites/northwind-mobile"),
  family: await send("/api/public/sites/northwind-family"),
  lanka: await send("/api/public/sites/lanka-homes"),
  eats: await send("/api/public/sites/island-eats"),
  metro: await send("/api/public/sites/metro-loans"),
  clinic: await send("/api/public/sites/city-clinic"),
  harbour: await send("/api/public/sites/northwind-harbour"),
};
check(offerPrice(after.mobile.body, "en") === "Rs 3,999", "Northwind Mobile is Rs 3,999");
check(offerPrice(after.family.body, "en") === "Rs 3,999" && offerPrice(after.family.body, "ta") === "Rs 3,999", "Northwind Family is Rs 3,999 in English and Tamil");
check(offerPrice(after.lanka.body, "en") === "Rs 3,999" && offerPrice(after.lanka.body, "ta") === "Rs 3,999", "Lanka Homes is Rs 3,999 in English and Tamil");
check(offerPrice(after.lanka.body, "si") === "Rs 4,999", "Lanka Homes Sinhala stays Rs 4,999");
check(offerPrice(after.eats.body, "en") === "Rs 3,999", "Island Eats is Rs 3,999");
check(offerPrice(after.metro.body, "en") === "Rs 4,999" && offerPrice(after.metro.body, "ta") === "Rs 4,999", "Metro Loans stays Rs 4,999");
check(offerPrice(after.clinic.body, "en") === "Rs 4,999", "City Clinic stays Rs 4,999");
check(
  offerPrice(after.harbour.body, "en") === offerPrice(before.harbour.body, "en"),
  "Northwind Harbour was not selected",
);
check(
  after.mobile.body.site.fields.en["contact.phone"] === before.mobile.body.site.fields.en["contact.phone"],
  "the contact phone was not part of this change",
);

const phoneDraft = await send("/api/panel/bulk", {
  cookie: amina.cookie,
  method: "POST",
  body: {
    item: "contact.phone",
    value: "011 2 000 111",
    mode: "draft",
    targets: [{ slug: "northwind-mobile", languages: ["en"] }],
  },
});
const phonePublic = await send("/api/public/sites/northwind-mobile");
check(phoneDraft.status === 200, "the contact phone can be saved as a draft");
check(
  phonePublic.body.site.fields.en["contact.phone"] === before.mobile.body.site.fields.en["contact.phone"],
  "a draft phone stays off the public page",
);
await send("/api/panel/bulk", {
  cookie: amina.cookie,
  method: "POST",
  body: {
    item: "contact.phone",
    value: before.mobile.body.site.fields.en["contact.phone"],
    mode: "draft",
    targets: [{ slug: "northwind-mobile", languages: ["en"] }],
  },
});

if (failures.length) {
  console.error(published.body?.sentence);
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("Phase 6 checks passed.");
