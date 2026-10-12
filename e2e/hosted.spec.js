import { expect, test } from "@playwright/test";

const password = "Demo1234!";
const harbourName = `Harbour ${new Date().toISOString().slice(11, 19).replaceAll(":", "")}`;
let harbourSlug = "";
const firstHero = "Harbour first public title";
const secondHero = "Harbour second public title";
const aminaHero = "Amina kept this title";
const bulkPhone = "011 0 000 777";

test.describe.configure({ mode: "serial" });

async function signIn(page, email, roleText) {
  await page.goto("/app");
  const signOut = page.getByRole("button", { name: "Sign out" });
  const signInHeading = page.getByRole("heading", { name: "Sign in" });
  await expect(signOut.or(signInHeading)).toBeVisible();
  if (await signOut.isVisible()) {
    await signOut.click();
    await expect(signInHeading).toBeVisible();
  }
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Websites" })).toBeVisible();
  await expect(page.getByText(roleText)).toBeVisible();
}

async function openSite(page, slug) {
  await page.goto(`/app/sites/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Website");
}

test("an editor cannot publish, and a reviewer cannot open City Clinic", async ({ page }) => {
  await signIn(page, "ravi@trident.demo", "editor in Colombo Campaigns");
  await expect(page.getByText("City Clinic")).toHaveCount(0);
  await expect(page.getByText("Metro Loans")).toHaveCount(0);
  await openSite(page, "northwind-mobile");
  await expect(page.getByText("An owner or reviewer publishes this website.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish", exact: true })).toHaveCount(0);
  await page.goto("/app/sites/city-clinic");
  await expect(page.getByText("Website not found.")).toBeVisible();

  await signIn(page, "meera@trident.demo", "reviewer in Colombo Campaigns");
  await openSite(page, "northwind-mobile");
  await expect(page.getByText("An editor or owner saves changes.")).toBeVisible();
  await page.goto("/app/sites/city-clinic");
  await expect(page.getByText("Website not found.")).toBeVisible();
});

test("the public site hides unpublished work and shows demo analytics IDs", async ({ page }) => {
  const mobile = await page.request.get("/api/public/sites/northwind-mobile");
  expect(mobile.ok()).toBeTruthy();
  const mobileBody = await mobile.json();
  expect(mobileBody.site.analytics.gaMeasurementId).toBe("G-NWMOBILE01");
  expect(mobileBody.site.analytics.gtmContainerId).toBe("GTM-NWM001");
  expect(mobileBody.site.languages.map((language) => language.code)).not.toContain("si");

  const campus = await page.request.get("/api/public/sites/northwind-campus");
  expect(campus.status()).toBe(404);

  await page.goto("/s/lanka-homes");
  await expect(page.getByRole("button", { name: "English" })).toBeVisible();
  await expect(page.getByRole("button", { name: "தமிழ்" })).toBeVisible();
  await expect(page.getByRole("button", { name: /සිංහල/ })).toHaveCount(0);

  await page.goto("/s/northwind-mobile");
  await expect(page.getByText("Analytics G-NWMOBILE01")).toBeVisible();
  await expect(page.getByText("Tag Manager GTM-NWM001")).toBeVisible();
  await expect(page.getByText("These IDs are not sent to Google.")).toBeVisible();

  const sitemap = await page.request.get("/sitemap.xml");
  const xml = await sitemap.text();
  expect(xml).toContain("https://multi-client-campaign-control-panel.vercel.app/s/northwind-mobile");
  expect(xml).not.toContain("northwind-campus");
  expect(xml).not.toContain("lang=si");
  expect(xml).not.toContain("/preview");
});

test("help on the bulk screen matches that task", async ({ page }) => {
  await signIn(page, "amina@trident.demo", "owner in Colombo Campaigns");
  await page.goto("/app/bulk");
  await expect(page.getByRole("heading", { name: "Update several websites" })).toBeVisible();
  await page.getByRole("button", { name: "Help" }).click();
  await expect(page.getByRole("heading", { name: "Update several websites", level: 2 })).toBeVisible();
  await expect(page.getByText("Tick the websites and the languages that should change.")).toBeVisible();
  await expect(page.getByText("the current value, and the next value")).toBeVisible();
});

test("Sinhala stays off the public site when the supplied file is imported", async ({ page }) => {
  await signIn(page, "amina@trident.demo", "owner in Colombo Campaigns");
  await openSite(page, "lanka-homes");
  await page.getByRole("button", { name: "Import supplied Sinhala file" }).click();
  await expect(page.getByText("සිංහල").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Missing translations" })).toBeVisible();
  await expect(page.locator(".missing-list li").first()).toBeVisible();
  await page.goto("/s/lanka-homes");
  await expect(page.getByRole("button", { name: /සිංහල/ })).toHaveCount(0);
});

test("cloning copies public content only and leaves the source unchanged", async ({ page }) => {
  const before = await page.request.get("/api/public/sites/northwind-mobile");
  const beforeBody = await before.json();

  await signIn(page, "amina@trident.demo", "owner in Colombo Campaigns");
  await page.goto("/app/sites/northwind-mobile/clone");
  await expect(page.getByText("Private notes and analytics IDs stay behind.")).toBeVisible();
  await page.getByLabel("Campaign name").fill(harbourName);
  await page.getByRole("button", { name: "Create draft" }).click();
  await page.waitForURL(/\/app\/sites\/(?!northwind-mobile)/);
  harbourSlug = new URL(page.url()).pathname.split("/").pop();
  await expect(page.getByRole("heading", { name: harbourName })).toBeVisible();
  await expect(page.getByText("Northwind · draft")).toBeVisible();
  await expect(page.getByLabel("Google Analytics ID")).toHaveValue("");
  await expect(page.getByLabel("Tag Manager ID")).toHaveValue("");

  const copy = await page.request.get(`/api/panel/sites/${harbourSlug}`);
  const copyBody = await copy.json();
  expect(copyBody.site.internalNotes).toBeNull();
  expect(copyBody.site.analytics).toBeNull();
  const privateFields = copyBody.site.fields.filter((field) => field.sensitive && (field.draftValue || field.publishedValue));
  expect(privateFields).toEqual([]);
  expect(JSON.stringify(copyBody)).not.toContain("Director mobile 077 412 8801");

  const source = await page.request.get("/api/public/sites/northwind-mobile");
  expect(await source.json()).toEqual(beforeBody);
  const hidden = await page.request.get(`/api/public/sites/${harbourSlug}`);
  expect(hidden.status()).toBe(404);
});

test("a draft can be previewed and published without changing the source", async ({ page }) => {
  await signIn(page, "amina@trident.demo", "owner in Colombo Campaigns");
  await openSite(page, harbourSlug);
  await page.getByRole("textbox", { name: "Hero title" }).fill(firstHero);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();

  await page.getByRole("link", { name: "Preview", exact: true }).first().click();
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: firstHero })).toBeVisible();

  const stillHidden = await page.request.get(`/api/public/sites/${harbourSlug}`);
  expect(stillHidden.status()).toBe(404);

  await openSite(page, harbourSlug);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText(`Publish ${harbourName}`)).toBeVisible();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText("Northwind · live")).toBeVisible();

  await page.goto(`/s/${harbourSlug}`);
  await expect(page.getByRole("heading", { name: firstHero })).toBeVisible();
  await expect(page.getByText("Draft preview")).toHaveCount(0);
  const source = await page.request.get("/api/public/sites/northwind-mobile");
  const sourceBody = await source.json();
  expect(sourceBody.site.fields.en["home.hero.title"]).not.toBe(firstHero);
});

test("analytics IDs are printed on the public page", async ({ page }) => {
  await signIn(page, "amina@trident.demo", "owner in Colombo Campaigns");
  await openSite(page, harbourSlug);
  await page.getByLabel("Google Analytics ID").fill("g-playwr01");
  await page.getByLabel("Tag Manager ID").fill("gtm-play01");
  await page.getByRole("button", { name: "Save analytics" }).click();
  await expect(page.getByText(/G-PLAYWR01/)).toBeVisible();
  await page.goto(`/s/${harbourSlug}`);
  await expect(page.getByText("Analytics G-PLAYWR01")).toBeVisible();
  await expect(page.getByText("Tag Manager GTM-PLAY01")).toBeVisible();
});

test("a draft bulk edit changes only the selected website", async ({ page }) => {
  const mobileBefore = await page.request.get("/api/public/sites/northwind-mobile");
  const mobilePhone = (await mobileBefore.json()).site.fields.en["contact.phone"];
  await signIn(page, "amina@trident.demo", "owner in Colombo Campaigns");
  await page.goto("/app/bulk");
  await page.getByRole("radio", { name: "Contact phone" }).check();
  await expect(page.getByRole("heading", { name: "Where it changes" })).toBeVisible();
  const siteBoxes = page.locator(".bulk-site-name input");
  const count = await siteBoxes.count();
  for (let index = 0; index < count; index += 1) {
    const box = siteBoxes.nth(index);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const state = await box.evaluate((element) => ({
        checked: element.checked,
        indeterminate: element.indeterminate,
      }));
      if (!state.checked && !state.indeterminate) break;
      await box.click();
    }
  }
  const harbour = page.locator(".bulk-site", { hasText: harbourName });
  await harbour.getByRole("checkbox", { name: "English" }).check();
  await page.getByLabel("New phone").fill(bulkPhone);
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByRole("cell", { name: harbourName })).toBeVisible();
  await page.getByRole("button", { name: "Save as draft" }).click();
  await expect(page.getByText(/saved as a draft/)).toBeVisible();

  const harbourPublic = await page.request.get(`/api/public/sites/${harbourSlug}`);
  expect((await harbourPublic.json()).site.fields.en["contact.phone"]).not.toBe(bulkPhone);
  const mobileAfter = await page.request.get("/api/public/sites/northwind-mobile");
  expect((await mobileAfter.json()).site.fields.en["contact.phone"]).toBe(mobilePhone);

  await page.getByLabel("New phone").fill(mobilePhone);
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("button", { name: "Save as draft" }).click();
  await expect(page.getByText(/saved as a draft/)).toBeVisible();
});

test("a failed launch leaves the public page on the last publish", async ({ page }) => {
  const before = await page.request.get(`/api/public/sites/${harbourSlug}`);
  const beforeHero = (await before.json()).site.fields.en["home.hero.title"];
  await signIn(page, "amina@trident.demo", "owner in Colombo Campaigns");
  await openSite(page, harbourSlug);
  await page.getByRole("button", { name: "Simulate failed launch" }).click();
  await page.getByRole("button", { name: "Record the failure" }).click();
  await expect(page.getByText(`${harbourName} failed to launch.`)).toBeVisible();
  await expect(page.getByText("The public page is still the last successful publish.").first()).toBeVisible();
  await expect(page.getByText("Northwind · failed")).toBeVisible();
  const after = await page.request.get(`/api/public/sites/${harbourSlug}`);
  expect((await after.json()).site.fields.en["home.hero.title"]).toBe(beforeHero);
  expect((await after.json()).site.analytics.gaMeasurementId).toBe("G-PLAYWR01");
});

test("a stale save shows both versions and does not overwrite", async ({ browser }) => {
  const raviContext = await browser.newContext();
  const aminaContext = await browser.newContext();
  const ravi = await raviContext.newPage();
  const amina = await aminaContext.newPage();
  await signIn(ravi, "ravi@trident.demo", "editor in Colombo Campaigns");
  await openSite(ravi, harbourSlug);
  await expect(ravi.getByRole("textbox", { name: "Hero title" })).toBeVisible();

  await signIn(amina, "amina@trident.demo", "owner in Colombo Campaigns");
  await openSite(amina, harbourSlug);
  await amina.getByRole("textbox", { name: "Hero title" }).fill(aminaHero);
  await amina.getByRole("button", { name: "Save draft" }).click();
  await expect(amina.getByText("Draft saved.")).toBeVisible();
  await amina.getByRole("button", { name: "Publish English" }).click();
  await amina.getByRole("button", { name: "Publish now" }).click();
  await expect(amina.getByText("Northwind · live")).toBeVisible();

  await ravi.getByRole("textbox", { name: "Hero title" }).fill("Ravi stale title");
  await ravi.getByRole("button", { name: "Save draft" }).click();
  await expect(ravi.getByRole("heading", { name: "Someone else saved this" })).toBeVisible();
  await expect(ravi.getByText("Nothing was overwritten.")).toBeVisible();
  await expect(ravi.getByRole("cell", { name: aminaHero })).toBeVisible();
  await ravi.getByRole("button", { name: "Reload" }).click();
  await expect(ravi.getByText("Reloaded their version.")).toBeVisible();
  await expect(ravi.getByRole("textbox", { name: "Hero title" })).toHaveValue(aminaHero);

  const published = await ravi.request.get(`/api/public/sites/${harbourSlug}`);
  expect((await published.json()).site.fields.en["home.hero.title"]).toBe(aminaHero);
  await raviContext.close();
  await aminaContext.close();
});

test("history can restore an earlier published title", async ({ page }) => {
  await signIn(page, "amina@trident.demo", "owner in Colombo Campaigns");
  await openSite(page, harbourSlug);
  await page.getByRole("textbox", { name: "Hero title" }).fill(secondHero);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.getByRole("button", { name: "Publish English" }).click();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText(new RegExp(secondHero))).toBeVisible();

  await page.goto(`/app/history?site=${harbourSlug}`);
  await expect(page.getByText("Live").first()).toBeVisible();
  await page.getByRole("link", { name: "Restore this version" }).first().click();
  await expect(page.getByText("The public page for")).toBeVisible();
  await expect(page.getByText("updates when you confirm")).toBeVisible();
  const publicDuring = await page.request.get(`/api/public/sites/${harbourSlug}`);
  expect((await publicDuring.json()).site.fields.en["home.hero.title"]).toBe(secondHero);
  await page.getByRole("button", { name: "Restore this version" }).click();
  await expect(page.getByText(/restored/i)).toBeVisible();

  await page.goto(`/app/history?site=${harbourSlug}`);
  await expect(page.getByText(/restored/i).first()).toBeVisible();
  const restored = await page.request.get(`/api/public/sites/${harbourSlug}`);
  expect((await restored.json()).site.fields.en["home.hero.title"]).not.toBe(secondHero);
});

test("backup restore shows what it will replace before it runs", async ({ page }) => {
  await signIn(page, "amina@trident.demo", "owner in Colombo Campaigns");
  await openSite(page, harbourSlug);
  await page.getByRole("button", { name: "Back up this website" }).click();
  await expect(page.getByText(/saved a backup/i)).toBeVisible();
  await page.getByRole("textbox", { name: "Hero title" }).fill("Title after the backup");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.getByRole("link", { name: "Restore a backup" }).click();
  await page.getByRole("link", { name: "Review this backup" }).first().click();
  await expect(page.getByText("replaces the current draft and the published page")).toBeVisible();
  await expect(page.getByText("Title after the backup")).toBeVisible();
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await expect(page.getByText(/from the backup taken on/i)).toBeVisible();
  await openSite(page, harbourSlug);
  await expect(page.getByRole("textbox", { name: "Hero title" })).not.toHaveValue("Title after the backup");
});

test("moving a website shows the private data it will leave behind", async ({ page }) => {
  await signIn(page, "amina@trident.demo", "owner in Colombo Campaigns");
  await openSite(page, harbourSlug);
  await page.getByRole("link", { name: "Move to Archive" }).click();
  await expect(page.getByText("Analytics IDs, internal notes, and private fields are removed.")).toBeVisible();
  await expect(page.getByText("G-PLAYWR01")).toBeVisible();
  await expect(page.getByText("GTM-PLAY01")).toBeVisible();
  await page.getByRole("button", { name: "Move to Archive" }).click();
  await expect(page.getByText(/moved/i)).toBeVisible();

  const stillPublic = await page.request.get(`/api/public/sites/${harbourSlug}`);
  expect(stillPublic.ok()).toBeTruthy();
  const body = await stillPublic.json();
  expect(body.site.analytics).toBeNull();

  await signIn(page, "ravi@trident.demo", "editor in Colombo Campaigns");
  await page.goto(`/app/sites/${harbourSlug}`);
  await expect(page.getByText("Website not found.")).toBeVisible();
  await expect(page.getByText(harbourName)).toHaveCount(0);
});
