// One campaign: list, open, clone, save, and publish.
// A change that spans several websites belongs in this file too.
import { Router } from "express";
import { prisma } from "../db.js";
import { canAccessClient, canEditSite, canOwnSite, canPublishSite } from "../access.js";
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

  const pendingFields = [];
  const pendingOffers = [];
  const conflicts = [];

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
      conflicts.push({
        kind: "field",
        key,
        label: current.field.label,
        language: current.language.name,
        languageCode: language,
        yours: draftValue,
        theirs: current.draftValue,
        savedBy: current.updatedBy?.name || "",
        revision: current.revision,
        changed: draftValue !== current.draftValue,
      });
    } else {
      pendingFields.push({ id: current.id, draftValue });
    }
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
      conflicts.push({
        kind: "offer",
        key: code,
        label: current.offer.name,
        language: current.language.name,
        languageCode: language,
        yours: `${draftLabel} · ${draftPrice}`,
        theirs: `${current.draftLabel} · ${current.draftPrice}`,
        savedBy: current.updatedBy?.name || "",
        revision: current.revision,
        changed: draftLabel !== current.draftLabel || draftPrice !== current.draftPrice,
      });
    } else {
      pendingOffers.push({ id: current.id, draftLabel, draftPrice });
    }
  }

  if (conflicts.length) throw conflictError(conflicts);

  await tx.theme.update({
    where: { siteId: site.id },
    data: theme,
  });

  for (const item of pendingFields) {
    await tx.contentValue.update({
      where: { id: item.id },
      data: { draftValue: item.draftValue, revision: { increment: 1 }, updatedById: actorId },
    });
  }

  for (const item of pendingOffers) {
    await tx.siteOffer.update({
      where: { id: item.id },
      data: {
        draftLabel: item.draftLabel,
        draftPrice: item.draftPrice,
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
      data: {
        publishedValue: value.draftValue,
        revision: { increment: 1 },
        updatedById: actor.id,
      },
    });
  }
  for (const row of site.siteOffers) {
    if (!languageIds.has(row.languageId)) continue;
    await tx.siteOffer.update({
      where: { id: row.id },
      data: {
        publishedLabel: row.draftLabel,
        publishedPrice: row.draftPrice,
        revision: { increment: 1 },
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

const GA_ID = /^G-[A-Z0-9]{4,24}$/;
const GTM_ID = /^GTM-[A-Z0-9]{4,24}$/;

export function readAnalyticsIds(body) {
  const ga = typeof body?.gaMeasurementId === "string" ? body.gaMeasurementId.trim().toUpperCase() : "";
  const gtm = typeof body?.gtmContainerId === "string" ? body.gtmContainerId.trim().toUpperCase() : "";
  if (ga && !GA_ID.test(ga)) throw httpError(400, "A Google Analytics ID looks like G-NWMOBILE01.");
  if (gtm && !GTM_ID.test(gtm)) throw httpError(400, "A Tag Manager ID looks like GTM-NWM001.");
  return { gaMeasurementId: ga || null, gtmContainerId: gtm || null };
}

export async function saveAnalytics(tx, site, ids, actor) {
  if (!ids.gaMeasurementId && !ids.gtmContainerId) {
    if (site.analytics) await tx.analyticsSettings.delete({ where: { siteId: site.id } });
  } else {
    await tx.analyticsSettings.upsert({
      where: { siteId: site.id },
      create: { siteId: site.id, ...ids },
      update: ids,
    });
  }
  const saved = [ids.gaMeasurementId, ids.gtmContainerId].filter(Boolean);
  const sentence = saved.length
    ? `${actor.name} set ${saved.join(" and ")} on ${site.name} on ${historyDate(new Date())}.`
    : `${actor.name} cleared the analytics IDs on ${site.name} on ${historyDate(new Date())}.`;
  await tx.historyEvent.create({
    data: {
      workspaceId: site.client.workspaceId,
      actorId: actor.id,
      sentence,
      siteIds: [site.id],
    },
  });
  return { sentence, site: await tx.site.findUnique({ where: { id: site.id }, include: siteDetailInclude }) };
}

export async function failLaunch(tx, site, actor) {
  const kept = Boolean(site.liveSnapshotId);
  const nextStep = kept
    ? "The public page is still the last successful publish. Fix the draft, then publish again."
    : "Nothing is on the public page yet. Fix the draft, then publish when it is ready.";
  const message = `${site.name} failed to launch. ${actor.name} simulated the failure on ${historyDate(new Date())}. The public page was left unchanged.`;
  await tx.launchAttempt.create({
    data: {
      siteId: site.id,
      outcome: "failed",
      message,
      nextStep,
      snapshotId: site.liveSnapshotId,
      createdById: actor.id,
    },
  });
  await tx.site.update({
    where: { id: site.id },
    data: { status: "failed" },
  });
  const sentence = `${message} Next: ${nextStep}`;
  await tx.historyEvent.create({
    data: {
      workspaceId: site.client.workspaceId,
      actorId: actor.id,
      sentence,
      siteIds: [site.id],
      snapshotId: site.liveSnapshotId,
    },
  });
  return {
    sentence,
    site: await tx.site.findUnique({ where: { id: site.id }, include: siteDetailInclude }),
  };
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

function conflictError(conflicts) {
  const names = [...new Set(conflicts.map((row) => row.savedBy).filter(Boolean))];
  const who = names.length ? joinNames(names) : "Someone else";
  const error = httpError(409, `${who} saved this while you were editing. Choose which version to keep.`);
  error.conflict = {
    savedBy: names,
    rows: conflicts
      .filter((row) => row.changed)
      .map((row) => ({
        kind: row.kind,
        key: row.key,
        label: row.label,
        language: row.language,
        languageCode: row.languageCode,
        yours: row.yours,
        theirs: row.theirs,
        savedBy: row.savedBy || "Someone else",
      })),
    revisions: conflicts.map((row) => ({
      kind: row.kind,
      key: row.key,
      languageCode: row.languageCode,
      revision: row.revision,
    })),
  };
  return error;
}

const BULK_ITEMS = {
  "offer.festive-fibre.price": {
    kind: "offer",
    code: "festive-fibre",
    field: "Offer price",
    label: "Festive Fibre Plan price",
  },
  "contact.phone": {
    kind: "phone",
    field: "Phone",
    label: "Contact phone",
  },
};

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function readBulkBody(body) {
  const item = BULK_ITEMS[body?.item];
  if (!item) throw httpError(400, "Choose the offer price or the contact phone.");
  const value = typeof body?.value === "string" ? body.value.trim() : "";
  if (!value) throw httpError(400, "Enter the new value.");
  if (value.length > (item.kind === "offer" ? 40 : 80)) throw httpError(400, "Shorten the new value.");
  if (!Array.isArray(body?.targets) || body.targets.length === 0) {
    throw httpError(400, "Choose at least one website.");
  }
  const targets = body.targets.map((target) => {
    const slug = typeof target?.slug === "string" ? target.slug : "";
    const languages = Array.isArray(target?.languages)
      ? [...new Set(target.languages.filter((code) => typeof code === "string" && code))]
      : [];
    if (!slug || languages.length === 0) throw httpError(400, "Each website needs a language.");
    return { slug, languages };
  });
  return { itemKey: body.item, item, value, targets };
}

async function visibleSites(user) {
  const sites = await prisma.site.findMany({
    include: siteDetailInclude,
    orderBy: { name: "asc" },
  });
  return sites.filter((site) => canAccessClient(user, site.client));
}

function languageRank(code) {
  return { en: 0, ta: 1, si: 2 }[code] ?? 9;
}

function cellValue(site, language, item) {
  if (item.kind === "offer") {
    const row = site.siteOffers.find(
      (offer) => offer.offer.code === item.code && offer.languageId === language.languageId,
    );
    return { draft: row?.draftPrice || "", published: row?.publishedPrice || "" };
  }
  const value = site.contentValues.find(
    (entry) => entry.field.key === "contact.phone" && entry.languageId === language.languageId && !entry.field.sensitive,
  );
  return { draft: value?.draftValue || "", published: value?.publishedValue || "" };
}

function bulkMatrix(sites, user, itemKey) {
  const item = BULK_ITEMS[itemKey] || BULK_ITEMS["offer.festive-fibre.price"];
  return {
    items: Object.entries(BULK_ITEMS).map(([key, entry]) => ({
      key,
      label: entry.label,
      field: entry.field,
    })),
    item: itemKey && BULK_ITEMS[itemKey] ? itemKey : "offer.festive-fibre.price",
    sites: sites.map((site) => ({
      slug: site.slug,
      name: site.name,
      status: site.status,
      client: site.client.name,
      canEdit: canEditSite(user, site.client),
      canPublish: canPublishSite(user, site.client),
      languages: [...site.siteLanguages]
        .sort((left, right) => languageRank(left.language.code) - languageRank(right.language.code))
        .map((language) => {
          const values = cellValue(site, language, item);
          return {
            code: language.language.code,
            name: language.language.name,
            nativeName: language.language.nativeName,
            status: language.status,
            current: values.draft,
            published: values.published,
          };
        }),
    })),
  };
}

async function applyBulk(user, body) {
  const { itemKey, item, value, targets } = readBulkBody(body);
  const mode = body?.mode === "publish" ? "publish" : body?.mode === "draft" ? "draft" : "";
  if (!mode) throw httpError(400, "Save the change as a draft, or publish it.");
  const sites = await visibleSites(user);
  const bySlug = new Map(sites.map((site) => [site.slug, site]));
  const chosen = targets.map((target) => {
    const site = bySlug.get(target.slug);
    if (!site) throw httpError(404, "Website not found.");
    if (mode === "draft" && !canEditSite(user, site.client)) {
      throw httpError(403, "An editor or owner saves changes.");
    }
    if (mode === "publish" && !canPublishSite(user, site.client)) {
      throw httpError(403, "An owner or reviewer publishes a website.");
    }
    const languages = target.languages.map((code) => {
      const language = site.siteLanguages.find((entry) => entry.language.code === code);
      if (!language) throw httpError(400, `${site.name} does not have that language.`);
      return language;
    });
    return { site, languages };
  });

  const previous = [];
  for (const target of chosen) {
    for (const language of target.languages) {
      previous.push(cellValue(target.site, language, item).draft);
    }
  }

  const changedSiteIds = await prisma.$transaction(async (tx) => {
    const touched = new Set();
    for (const target of chosen) {
      for (const language of target.languages) {
        const publishValue = mode === "publish" && language.status === "published";
        if (item.kind === "offer") {
          await writeOffer(tx, target.site, language, item.code, value, publishValue, user.id);
        } else {
          await writePhone(tx, target.site, language, value, publishValue, user.id);
        }
        if (publishValue) touched.add(target.site.id);
      }
    }
    for (const siteId of touched) {
      const full = await tx.site.findUnique({ where: { id: siteId }, include: siteDetailInclude });
      const snapshot = await tx.snapshot.create({
        data: {
          siteId,
          kind: "publish",
          label: `${item.label} is now ${value}.`,
          payload: snapshotPayload(full),
          createdById: user.id,
        },
      });
      await tx.site.update({
        where: { id: siteId },
        data: { status: "live", liveSnapshotId: snapshot.id },
      });
    }
    const names = [...new Set(chosen.flatMap((target) => target.languages.map((language) => language.language.name)))];
    names.sort((left, right) => languageRank(codeFor(chosen, left)) - languageRank(codeFor(chosen, right)));
    const fromValues = [...new Set(previous.filter(Boolean))];
    const fromText = fromValues.length === 1 ? `from ${fromValues[0]} ` : "";
    const siteCount = new Set(chosen.map((target) => target.site.id)).size;
    const countWord = COUNT_WORDS[siteCount] || String(siteCount);
    const draftNote = mode === "draft" ? "was saved as a draft, " : "changed ";
    const sentence = `${item.label} ${draftNote}${fromText}to ${value} in ${joinNames(names)} on ${countWord} ${siteCount === 1 ? "website" : "websites"}, by ${user.name}, on ${historyDate(new Date())}.`;
    const workspaceIds = [...new Set(chosen.map((target) => target.site.client.workspaceId))];
    for (const workspaceId of workspaceIds) {
      const ids = chosen
        .filter((target) => target.site.client.workspaceId === workspaceId)
        .map((target) => target.site.id);
      await tx.historyEvent.create({
        data: {
          workspaceId,
          actorId: user.id,
          sentence,
          siteIds: [...new Set(ids)],
        },
      });
    }
    return sentence;
  }, { timeout: 20000 });

  return { sentence: changedSiteIds, mode, item: itemKey };
}

function codeFor(chosen, name) {
  for (const target of chosen) {
    const match = target.languages.find((language) => language.language.name === name);
    if (match) return match.language.code;
  }
  return "";
}

async function writeOffer(tx, site, language, code, value, publishValue, actorId) {
  const current = site.siteOffers.find(
    (row) => row.offer.code === code && row.languageId === language.languageId,
  );
  if (current) {
    await tx.siteOffer.update({
      where: { id: current.id },
      data: {
        draftPrice: value,
        ...(publishValue ? { publishedPrice: value } : {}),
        revision: { increment: 1 },
        updatedById: actorId,
      },
    });
    return;
  }
  const offer = await tx.offer.findUnique({ where: { code } });
  if (!offer) throw httpError(400, "That offer is not in the catalog.");
  await tx.siteOffer.create({
    data: {
      siteId: site.id,
      offerId: offer.id,
      languageId: language.languageId,
      draftLabel: offer.name,
      publishedLabel: publishValue ? offer.name : null,
      draftPrice: value,
      publishedPrice: publishValue ? value : null,
      updatedById: actorId,
    },
  });
}

async function writePhone(tx, site, language, value, publishValue, actorId) {
  const current = site.contentValues.find(
    (entry) => entry.field.key === "contact.phone" && entry.languageId === language.languageId,
  );
  if (current) {
    await tx.contentValue.update({
      where: { id: current.id },
      data: {
        draftValue: value,
        ...(publishValue ? { publishedValue: value } : {}),
        revision: { increment: 1 },
        updatedById: actorId,
      },
    });
    return;
  }
  const field = await tx.contentField.findUnique({ where: { key: "contact.phone" } });
  if (!field || field.sensitive) throw httpError(400, "The contact phone is not on this website.");
  await tx.contentValue.create({
    data: {
      siteId: site.id,
      fieldId: field.id,
      languageId: language.languageId,
      draftValue: value,
      publishedValue: publishValue ? value : null,
      updatedById: actorId,
    },
  });
}

const listInclude = {
  client: { include: { workspace: true } },
  siteLanguages: { include: { language: true } },
};

export const campaignsRouter = Router();
campaignsRouter.use(requireUser);

campaignsRouter.get("/bulk", async (req, res, next) => {
  try {
    const item = typeof req.query.item === "string" ? req.query.item : "offer.festive-fibre.price";
    const sites = await visibleSites(req.user);
    res.json(bulkMatrix(sites, req.user, item));
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/bulk", async (req, res, next) => {
  try {
    const result = await applyBulk(req.user, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

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

campaignsRouter.patch("/sites/:slug/analytics", async (req, res, next) => {
  try {
    const site = await loadSite(req.params.slug);
    if (!site || !canAccessClient(req.user, site.client)) {
      res.status(404).json({ error: "Website not found." });
      return;
    }
    if (!canOwnSite(req.user, site.client)) {
      res.status(403).json({ error: "An owner saves analytics IDs." });
      return;
    }
    const ids = readAnalyticsIds(req.body);
    const saved = await prisma.$transaction((tx) => saveAnalytics(tx, site, ids, req.user));
    res.json({ ...(await present(saved.site)), sentence: saved.sentence });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/sites/:slug/fail-launch", async (req, res, next) => {
  try {
    const site = await loadSite(req.params.slug);
    if (!site || !canAccessClient(req.user, site.client)) {
      res.status(404).json({ error: "Website not found." });
      return;
    }
    if (!canPublishSite(req.user, site.client)) {
      res.status(403).json({ error: "An owner or reviewer records a launch." });
      return;
    }
    const failed = await prisma.$transaction((tx) => failLaunch(tx, site, req.user));
    res.json({ ...(await present(failed.site)), sentence: failed.sentence });
  } catch (error) {
    next(error);
  }
});
