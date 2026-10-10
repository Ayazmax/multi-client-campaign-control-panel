// One campaign: list, open, clone, save, and publish.
// A change that spans several websites belongs in this file too.
import { Router } from "express";
import { prisma } from "../db.js";
import { canAccessClient, canEditSite, canPublishSite } from "../access.js";
import { requireUser } from "../loadUser.js";
import { toStaffSiteSummary } from "../serialize.js";
import { historyDate, joinNames, snapshotPayload } from "../snapshot.js";
import { siteDetailInclude } from "../siteInclude.js";
import { loadSite, present } from "./staffSite.js";

const HEX = /^#[0-9a-fA-F]{6}$/;

export function slugFromName(name) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function readCampaignName(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    throw httpError(400, "Enter a campaign name between 2 and 80 characters.");
  }
  return name;
}

export async function cloneCampaign(tx, source, { name, slug, actor }) {
  const published = source.siteLanguages.filter((item) => item.status === "published");
  if (published.length === 0) {
    throw httpError(400, "This website has no published language to copy.");
  }
  const publishedIds = new Set(published.map((item) => item.languageId));

  const site = await tx.site.create({
    data: {
      clientId: source.clientId,
      name,
      slug,
      status: "draft",
      internalNotes: null,
      sourceSiteId: source.id,
    },
  });

  if (source.theme) {
    await tx.theme.create({
      data: {
        siteId: site.id,
        primaryColor: source.theme.primaryColor,
        secondaryColor: source.theme.secondaryColor,
        accentColor: source.theme.accentColor,
        fontFamily: source.theme.fontFamily,
        logoUrl: source.theme.logoUrl,
      },
    });
  }

  if (source.pages.length > 0) {
    await tx.page.createMany({
      data: source.pages.map((page) => ({
        siteId: site.id,
        key: page.key,
        path: page.path,
        sortOrder: page.sortOrder,
      })),
    });
  }

  await tx.siteLanguage.createMany({
    data: published.map((item) => ({
      siteId: site.id,
      languageId: item.languageId,
      status: "draft",
    })),
  });

  const values = source.contentValues.filter(
    (value) =>
      publishedIds.has(value.languageId) &&
      !value.field.sensitive &&
      value.publishedValue,
  );
  if (values.length > 0) {
    await tx.contentValue.createMany({
      data: values.map((value) => ({
        siteId: site.id,
        fieldId: value.fieldId,
        languageId: value.languageId,
        draftValue: value.publishedValue,
        publishedValue: null,
        updatedById: actor.id,
      })),
    });
  }

  const offers = source.siteOffers.filter(
    (row) => publishedIds.has(row.languageId) && row.publishedPrice,
  );
  if (offers.length > 0) {
    await tx.siteOffer.createMany({
      data: offers.map((row) => ({
        siteId: site.id,
        offerId: row.offerId,
        languageId: row.languageId,
        draftLabel: row.publishedLabel,
        publishedLabel: null,
        draftPrice: row.publishedPrice,
        publishedPrice: null,
        updatedById: actor.id,
      })),
    });
  }

  await tx.historyEvent.create({
    data: {
      workspaceId: source.client.workspaceId,
      actorId: actor.id,
      sentence: `${actor.name} created ${name} from ${source.name}.`,
      siteIds: [site.id, source.id],
    },
  });

  return tx.site.findUnique({
    where: { id: site.id },
    include: siteDetailInclude,
  });
}

export async function saveCampaign(tx, site, body, actorId) {
  const theme = readTheme(body?.theme);
  const fields = Array.isArray(body?.fields) ? body.fields : null;
  const offers = Array.isArray(body?.offers) ? body.offers : null;
  if (!theme || !fields || !offers) {
    throw httpError(400, "Send the branding, page text, and offers.");
  }

  await tx.theme.update({
    where: { siteId: site.id },
    data: theme,
  });

  for (const item of fields) {
    const key = typeof item?.key === "string" ? item.key : "";
    const language = typeof item?.language === "string" ? item.language : "";
    const draftValue = typeof item?.draftValue === "string" ? item.draftValue.trim() : null;
    const revision = Number(item?.revision);
    if (!key || !language || draftValue === null || !Number.isInteger(revision)) {
      throw httpError(400, "Each text field needs a language, a value, and a revision.");
    }
    if (draftValue.length > 4000) {
      throw httpError(400, "Shorten the text so it is under 4000 characters.");
    }
    const current = site.contentValues.find(
      (value) => value.field.key === key && value.language.code === language,
    );
    if (!current || current.field.sensitive) {
      throw httpError(400, "That text field is not on this website.");
    }
    if (current.revision !== revision) {
      throw httpError(409, "Someone else saved this page. Reload it and try again.");
    }
    await tx.contentValue.update({
      where: { id: current.id },
      data: { draftValue, revision: { increment: 1 }, updatedById: actorId },
    });
  }

  for (const item of offers) {
    const code = typeof item?.code === "string" ? item.code : "";
    const language = typeof item?.language === "string" ? item.language : "";
    const draftLabel = typeof item?.draftLabel === "string" ? item.draftLabel.trim() : "";
    const draftPrice = typeof item?.draftPrice === "string" ? item.draftPrice.trim() : "";
    const revision = Number(item?.revision);
    if (!code || !language || !draftLabel || !draftPrice || !Number.isInteger(revision)) {
      throw httpError(400, "Each offer needs a name, a price, and a revision.");
    }
    if (draftLabel.length > 120 || draftPrice.length > 40) {
      throw httpError(400, "Shorten the offer name or price.");
    }
    const current = site.siteOffers.find(
      (row) => row.offer.code === code && row.language.code === language,
    );
    if (!current) {
      throw httpError(400, "That offer is not on this website.");
    }
    if (current.revision !== revision) {
      throw httpError(409, "Someone else saved this page. Reload it and try again.");
    }
    await tx.siteOffer.update({
      where: { id: current.id },
      data: {
        draftLabel,
        draftPrice,
        revision: { increment: 1 },
        updatedById: actorId,
      },
    });
  }

  return tx.site.findUnique({
    where: { id: site.id },
    include: siteDetailInclude,
  });
}

export async function publishCampaign(tx, site, actor, languageCode) {
  const requested = typeof languageCode === "string" ? languageCode.trim() : "";
  let languagesToPublish;
  if (requested) {
    const match = site.siteLanguages.find((item) => item.language.code === requested);
    if (!match) throw httpError(400, "That language is not on this website.");
    languagesToPublish = [match];
  } else if (site.status === "draft") {
    languagesToPublish = site.siteLanguages;
  } else {
    languagesToPublish = site.siteLanguages.filter((item) => item.status === "published");
  }
  if (languagesToPublish.length === 0) {
    throw httpError(400, "Add a language before publishing.");
  }
  const languageIds = new Set(languagesToPublish.map((item) => item.languageId));

  for (const value of site.contentValues) {
    if (!languageIds.has(value.languageId) || value.field.sensitive) continue;
    await tx.contentValue.update({
      where: { id: value.id },
      data: { publishedValue: value.draftValue, updatedById: actor.id },
    });
  }
  for (const row of site.siteOffers) {
    if (!languageIds.has(row.languageId)) continue;
    await tx.siteOffer.update({
      where: { id: row.id },
      data: {
        publishedLabel: row.draftLabel,
        publishedPrice: row.draftPrice,
        updatedById: actor.id,
      },
    });
  }
  await tx.siteLanguage.updateMany({
    where: { id: { in: languagesToPublish.map((item) => item.id) } },
    data: { status: "published" },
  });

  const full = await tx.site.findUnique({
    where: { id: site.id },
    include: siteDetailInclude,
  });
  const names = languagesToPublish
    .slice()
    .sort((left, right) => left.language.code.localeCompare(right.language.code))
    .map((item) => item.language.name);
  const sentence = `${site.name} was published in ${joinNames(names)} by ${actor.name} on ${historyDate(new Date())}.`;
  const snapshot = await tx.snapshot.create({
    data: {
      siteId: site.id,
      kind: "publish",
      label: sentence,
      payload: snapshotPayload(full),
      createdById: actor.id,
    },
  });
  await tx.site.update({
    where: { id: site.id },
    data: { status: "live", liveSnapshotId: snapshot.id },
  });
  await tx.historyEvent.create({
    data: {
      workspaceId: site.client.workspaceId,
      actorId: actor.id,
      sentence,
      siteIds: [site.id],
      snapshotId: snapshot.id,
    },
  });
  await tx.launchAttempt.create({
    data: {
      siteId: site.id,
      outcome: "success",
      message: sentence,
      nextStep: "The public page is serving this version.",
      snapshotId: snapshot.id,
      createdById: actor.id,
    },
  });

  const publishedSite = await tx.site.findUnique({
    where: { id: site.id },
    include: siteDetailInclude,
  });
  return { site: publishedSite, sentence };
}

function readTheme(theme) {
  if (!theme || typeof theme !== "object") return null;
  const primaryColor = String(theme.primaryColor || "");
  const secondaryColor = String(theme.secondaryColor || "");
  const accentColor = String(theme.accentColor || "");
  const fontFamily = typeof theme.fontFamily === "string" ? theme.fontFamily.trim() : "";
  const logoUrl = typeof theme.logoUrl === "string" ? theme.logoUrl.trim() : "";
  if (![primaryColor, secondaryColor, accentColor].every((color) => HEX.test(color))) {
    throw httpError(400, "Colours need a hex value such as #0f6e56.");
  }
  if (!fontFamily || fontFamily.length > 80) {
    throw httpError(400, "Enter a font name.");
  }
  if (logoUrl && !/^https?:\/\//.test(logoUrl)) {
    throw httpError(400, "The logo needs a full image address starting with http.");
  }
  return {
    primaryColor,
    secondaryColor,
    accentColor,
    fontFamily,
    logoUrl: logoUrl || null,
  };
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const listInclude = {
  client: { include: { workspace: true } },
  siteLanguages: { include: { language: true } },
};

export const campaignsRouter = Router();
campaignsRouter.use(requireUser);

campaignsRouter.get("/sites", async (req, res, next) => {
  try {
    const memberships = [...req.user.memberships].sort((left, right) =>
      left.workspace.name.localeCompare(right.workspace.name),
    );
    const sites = await prisma.site.findMany({
      include: listInclude,
      orderBy: { name: "asc" },
    });
    const visible = sites.filter((site) => canAccessClient(req.user, site.client));
    res.json({
      workspaces: memberships.map((membership) => ({
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        role: membership.role,
        sites: visible
          .filter((site) => site.client.workspaceId === membership.workspaceId)
          .map(toStaffSiteSummary),
      })),
    });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.get("/sites/:slug", async (req, res, next) => {
  try {
    const site = await loadSite(req.params.slug);
    if (!site || !canAccessClient(req.user, site.client)) {
      res.status(404).json({ error: "Website not found." });
      return;
    }
    res.json(await present(site));
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/sites/:slug/clone", async (req, res, next) => {
  try {
    const source = await loadSite(req.params.slug);
    if (!source || !canAccessClient(req.user, source.client)) {
      res.status(404).json({ error: "Website not found." });
      return;
    }
    if (!canEditSite(req.user, source.client)) {
      res.status(403).json({ error: "An editor or owner creates a campaign." });
      return;
    }
    const name = readCampaignName(req.body);
    const slug = slugFromName(name);
    if (!slug) {
      res.status(400).json({ error: "Use letters or numbers in the campaign name." });
      return;
    }
    const taken = await prisma.site.findUnique({ where: { slug } });
    if (taken) {
      res.status(409).json({ error: "That web address is already in use. Choose another name." });
      return;
    }
    const site = await prisma.$transaction(
      (tx) => cloneCampaign(tx, source, { name, slug, actor: req.user }),
      { timeout: 20000 },
    );
    res.status(201).json(await present(site));
  } catch (error) {
    next(error);
  }
});

campaignsRouter.patch("/sites/:slug", async (req, res, next) => {
  try {
    const site = await loadSite(req.params.slug);
    if (!site || !canAccessClient(req.user, site.client)) {
      res.status(404).json({ error: "Website not found." });
      return;
    }
    if (!canEditSite(req.user, site.client)) {
      res.status(403).json({ error: "An editor or owner saves changes." });
      return;
    }
    const saved = await prisma.$transaction(
      (tx) => saveCampaign(tx, site, req.body, req.user.id),
      { timeout: 20000 },
    );
    res.json(await present(saved));
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/sites/:slug/publish", async (req, res, next) => {
  try {
    const site = await loadSite(req.params.slug);
    if (!site || !canAccessClient(req.user, site.client)) {
      res.status(404).json({ error: "Website not found." });
      return;
    }
    if (!canPublishSite(req.user, site.client)) {
      res.status(403).json({ error: "An owner or reviewer publishes a website." });
      return;
    }
    const language = typeof req.body?.language === "string" ? req.body.language : "";
    const published = await prisma.$transaction(
      (tx) => publishCampaign(tx, site, req.user, language),
      { timeout: 20000 },
    );
    res.json({ ...(await present(published.site)), sentence: published.sentence });
  } catch (error) {
    next(error);
  }
});
