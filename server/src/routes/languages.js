// Languages on one website: add a language and import a translation file.
// Empty slots are listed by missingTranslations in staffSite.js.
import { Router } from "express";
import { prisma } from "../db.js";
import { canAccessClient, canEditSite } from "../access.js";
import { requireUser } from "../loadUser.js";
import { siteDetailInclude } from "../siteInclude.js";
import { loadSite, missingTranslations, present } from "./staffSite.js";

const OFFER_KEY = /^offer\.([a-z0-9-]+)\.(label|price)$/;

export function readTranslation(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw httpError(400, "The translation file should be JSON keyed by field id.");
  }
  const language = typeof body.language === "string" ? body.language.trim() : "";
  const source =
    body.fields && typeof body.fields === "object" && !Array.isArray(body.fields) ? body.fields : body;
  if (!language) throw httpError(400, "Choose a language for this file.");
  const fields = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "language" || key === "fields") continue;
    if (typeof value !== "string") {
      throw httpError(400, `The value for ${key} should be text.`);
    }
    const text = value.trim();
    if (text) fields[key] = text;
  }
  if (Object.keys(fields).length === 0) {
    throw httpError(400, "The file has no translations.");
  }
  return { language, fields };
}

export async function addLanguage(tx, site, code, actor) {
  const language = await tx.language.findUnique({ where: { code } });
  if (!language) throw httpError(400, "That language is not in the catalog.");
  const existing = site.siteLanguages.find((item) => item.languageId === language.id);
  if (existing) throw httpError(409, `${language.name} is already on this website.`);
  await tx.siteLanguage.create({
    data: { siteId: site.id, languageId: language.id, status: "draft" },
  });
  await tx.historyEvent.create({
    data: {
      workspaceId: site.client.workspaceId,
      actorId: actor.id,
      sentence: `${actor.name} added ${language.name} to ${site.name}.`,
      siteIds: [site.id],
    },
  });
  return reload(tx, site.id);
}

export async function importTranslation(tx, site, { language: code, fields }, actor) {
  const siteLanguage = site.siteLanguages.find((item) => item.language.code === code);
  if (!siteLanguage) {
    throw httpError(400, "Add that language to the website before importing.");
  }
  const catalog = await tx.contentField.findMany();
  const byKey = new Map(catalog.map((field) => [field.key, field]));
  const ignored = [];
  const offerPatches = new Map();
  let filled = 0;

  for (const [key, value] of Object.entries(fields)) {
    const offerKey = OFFER_KEY.exec(key);
    if (offerKey) {
      const [, offerCode, part] = offerKey;
      const patch = offerPatches.get(offerCode) || {};
      patch[part] = value;
      offerPatches.set(offerCode, patch);
      continue;
    }
    const field = byKey.get(key);
    if (!field) {
      ignored.push({ key, reason: "This field is not on the website." });
      continue;
    }
    if (field.sensitive) {
      ignored.push({ key, reason: "Private fields are not imported." });
      continue;
    }
    if (value.length > 4000) throw httpError(400, `Shorten the text for ${key}.`);
    const current = site.contentValues.find(
      (item) => item.fieldId === field.id && item.languageId === siteLanguage.languageId,
    );
    if (current) {
      await tx.contentValue.update({
        where: { id: current.id },
        data: { draftValue: value, revision: { increment: 1 }, updatedById: actor.id },
      });
    } else {
      await tx.contentValue.create({
        data: {
          siteId: site.id,
          fieldId: field.id,
          languageId: siteLanguage.languageId,
          draftValue: value,
          publishedValue: null,
          updatedById: actor.id,
        },
      });
    }
    filled += 1;
  }

  for (const [offerCode, patch] of offerPatches) {
    const offer = await tx.offer.findUnique({ where: { code: offerCode } });
    if (!offer) {
      ignored.push({ key: `offer.${offerCode}`, reason: "That offer is not in the catalog." });
      continue;
    }
    const current = site.siteOffers.find(
      (row) => row.offerId === offer.id && row.languageId === siteLanguage.languageId,
    );
    if (!current && !patch.price) {
      ignored.push({
        key: `offer.${offerCode}.price`,
        reason: "A new offer translation needs a price.",
      });
      continue;
    }
    if (patch.label && patch.label.length > 120) throw httpError(400, "Shorten the offer name.");
    if (patch.price && patch.price.length > 40) throw httpError(400, "Shorten the offer price.");
    if (current) {
      await tx.siteOffer.update({
        where: { id: current.id },
        data: {
          ...(patch.label ? { draftLabel: patch.label } : {}),
          ...(patch.price ? { draftPrice: patch.price } : {}),
          revision: { increment: 1 },
          updatedById: actor.id,
        },
      });
    } else {
      await tx.siteOffer.create({
        data: {
          siteId: site.id,
          offerId: offer.id,
          languageId: siteLanguage.languageId,
          draftLabel: patch.label || offer.name,
          publishedLabel: null,
          draftPrice: patch.price,
          publishedPrice: null,
          updatedById: actor.id,
        },
      });
    }
    filled += 1;
  }

  const updated = await reload(tx, site.id);
  const missing = missingTranslations(updated, catalog).filter((item) => item.languageCode === code);
  await tx.historyEvent.create({
    data: {
      workspaceId: site.client.workspaceId,
      actorId: actor.id,
      sentence: `${actor.name} imported ${siteLanguage.language.name} for ${site.name}. ${filled} slots filled, ${missing.length} still missing.`,
      siteIds: [site.id],
    },
  });
  return { site: updated, filled, ignored, missingCount: missing.length };
}

function reload(tx, id) {
  return tx.site.findUnique({ where: { id }, include: siteDetailInclude });
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export const languagesRouter = Router();
languagesRouter.use(requireUser);

languagesRouter.post("/sites/:slug/languages", async (req, res, next) => {
  try {
    const site = await loadSite(req.params.slug);
    if (!site || !canAccessClient(req.user, site.client)) {
      res.status(404).json({ error: "Website not found." });
      return;
    }
    if (!canEditSite(req.user, site.client)) {
      res.status(403).json({ error: "An editor or owner adds a language." });
      return;
    }
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!code) {
      res.status(400).json({ error: "Choose a language." });
      return;
    }
    const updated = await prisma.$transaction((tx) => addLanguage(tx, site, code, req.user));
    res.status(201).json(await present(updated));
  } catch (error) {
    next(error);
  }
});

languagesRouter.post("/sites/:slug/translations", async (req, res, next) => {
  try {
    const site = await loadSite(req.params.slug);
    if (!site || !canAccessClient(req.user, site.client)) {
      res.status(404).json({ error: "Website not found." });
      return;
    }
    if (!canEditSite(req.user, site.client)) {
      res.status(403).json({ error: "An editor or owner imports a translation." });
      return;
    }
    const translation = readTranslation(req.body);
    const result = await prisma.$transaction(
      (tx) => importTranslation(tx, site, translation, req.user),
      { timeout: 20000 },
    );
    res.json({
      ...(await present(result.site)),
      filled: result.filled,
      ignored: result.ignored,
      missingCount: result.missingCount,
    });
  } catch (error) {
    next(error);
  }
});
