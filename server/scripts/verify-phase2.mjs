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

async function get(path, cookie) {
  const response = await fetch(`${base}${path}`, {
    headers: cookie ? { cookie } : {},
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { status: response.status, body };
}

const failures = [];
function check(condition, message) {
  if (condition) {
    console.log(`ok  ${message}`);
  } else {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
}

const bad = await login("amina@trident.demo", "wrong");
check(bad.status === 401, "wrong password is rejected");

const amina = await login("amina@trident.demo");
check(amina.status === 200 && amina.body.user.name === "Amina", "Amina can sign in");
check(Boolean(amina.cookie.includes("session=")), "login sets a session cookie");

const aminaSites = await get("/api/panel/sites", amina.cookie);
const aminaNames = aminaSites.body.workspaces.flatMap((workspace) =>
  workspace.sites.map((site) => site.slug),
);
check(aminaSites.body.workspaces.some((workspace) => workspace.slug === "archive"), "Amina sees Archive");
check(aminaNames.includes("city-clinic") && aminaNames.includes("northwind-campus"), "Amina sees every seeded site");

const ravi = await login("ravi@trident.demo");
const raviSites = await get("/api/panel/sites", ravi.cookie);
const raviNames = raviSites.body.workspaces.flatMap((workspace) =>
  workspace.sites.map((site) => site.slug),
);
check(!raviNames.includes("city-clinic") && !raviNames.includes("metro-loans"), "Ravi cannot see City Clinic or Metro Loans");
check(raviNames.includes("lanka-homes") && raviNames.includes("northwind-mobile"), "Ravi sees his granted clients");
const raviClinic = await get("/api/panel/sites/city-clinic", ravi.cookie);
check(raviClinic.status === 404, "Ravi gets not found for City Clinic");

const mobile = await get("/api/public/sites/northwind-mobile");
const mobileText = JSON.stringify(mobile.body);
check(mobile.status === 200, "Northwind Mobile is public");
check(
  mobile.body.site.languages.map((language) => language.code).join() === "en",
  "Northwind Mobile public languages are English only",
);
check(mobile.body.site.fields.en["home.hero.title"] === "Stay online across the island", "published English hero is returned");
check(!mobileText.includes("077 412 8801"), "private contact line is absent");
check(!mobileText.includes("G-NWMOBILE01") && !mobileText.includes("GTM-NWM001"), "analytics IDs are absent");
check(!mobileText.includes("Billing contact is private"), "internal notes are absent");
check(!mobileText.includes("draftValue"), "draft values are absent from the public payload");

const homes = await get("/api/public/sites/lanka-homes");
const homeCodes = homes.body.site.languages.map((language) => language.code);
check(homeCodes.includes("en") && homeCodes.includes("ta") && !homeCodes.includes("si"), "Lanka Homes hides the Sinhala draft");
check(Boolean(homes.body.site.fields.ta["home.hero.title"]), "published Tamil copy is returned");
check(!JSON.stringify(homes.body).includes("අලුත් අවුරුද්දට"), "Sinhala draft copy is absent");
check(homes.body.site.offers[0].languages.en.price === "Rs 4,999", "published offer price is Rs 4,999");
check(!homes.body.site.offers[0].languages.si, "Sinhala offer price is not public");

const campus = await get("/api/public/sites/northwind-campus");
check(campus.status === 404, "unpublished Campus is not public");

const preview = await get("/api/panel/sites/lanka-homes", amina.cookie);
const sinhala = preview.body.site.languages.find((language) => language.code === "si");
check(sinhala?.status === "draft", "staff preview still shows Sinhala as a draft");
const privateField = preview.body.site.fields.find((field) => field.key === "contact.private_line");
check(Boolean(privateField?.draftValue), "staff can see the private contact line");

const sitemap = await fetch(`${base}/sitemap.xml`);
const sitemapText = await sitemap.text();
check(sitemap.status === 200 && sitemapText.includes("<urlset"), "sitemap.xml is served");
check(sitemapText.includes("/s/northwind-mobile</loc>") || sitemapText.includes("/s/northwind-mobile<"), "sitemap lists Northwind Mobile");
check(sitemapText.includes("/s/lanka-homes/offers"), "sitemap lists the Offers page");
check(sitemapText.includes("lang=ta"), "sitemap lists published Tamil URLs");
check(!sitemapText.includes("northwind-campus"), "sitemap omits the unpublished campus site");
check(!sitemapText.includes("lang=si"), "sitemap omits the Sinhala draft");

const robots = await fetch(`${base}/robots.txt`);
const robotsText = await robots.text();
check(robots.status === 200 && robotsText.includes("Sitemap:"), "robots.txt points at the sitemap");
check(robotsText.includes("Disallow: /s/*/preview"), "robots.txt keeps preview pages out");

const loggedOut = await fetch(`${base}/api/auth/logout`, {
  method: "POST",
  headers: { cookie: amina.cookie },
});
check(loggedOut.status === 204, "logout succeeds");
const after = await get("/api/panel/sites", amina.cookie);
check(after.status === 401, "logged-out session cannot open the panel");

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nPhase 2 and Phase 3 checks passed");
