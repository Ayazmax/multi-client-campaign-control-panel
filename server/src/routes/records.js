// History, restoring a published version, backups, and moving a site.
import { Router } from "express";
import { prisma } from "../db.js";
import { canAccessClient, canOwnSite, canRestoreVersion } from "../access.js";
import { requireUser } from "../loadUser.js";
import { historyDate, snapshotPayload } from "../snapshot.js";
import { siteDetailInclude } from "../siteInclude.js";
import { loadSite } from "./staffSite.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const recordsRouter = Router();
recordsRouter.use(requireUser);

recordsRouter.get("/history", async (req, res, next) => {
  try {
    const visible = await visibleSites(req.user);
    const requested = typeof req.query.site === "string" ? req.query.site : "";
    const focus = requested ? visible.find((site) => site.slug === requested) : null;
    if (requested && !focus) {
      res.status(404).json({ error: "Website not found." });
      return;
    }
    const byId = new Map(visible.map((site) => [site.id, site]));
    const liveIds = new Set(visible.map((site) => site.liveSnapshotId).filter(Boolean));
    const events = await prisma.historyEvent.findMany({
      where: { workspaceId: { in: req.user.memberships.map((item) => item.workspaceId) } },
      include: { actor: { select: { name: true } }, snapshot: true },
      orderBy: { createdAt: "desc" },
    });
    const rows = events
      .filter((event) => event.siteIds.some((id) => byId.has(id)))
      .filter((event) => !focus || event.siteIds.includes(focus.id))
      .map((event) => ({
        id: event.id,
        sentence: event.sentence,
        createdAt: event.createdAt,
        actor: event.actor.name,
        snapshotId: event.snapshot?.siteId && byId.has(event.snapshot.siteId) ? event.snapshotId : null,
        live: Boolean(event.snapshotId && liveIds.has(event.snapshotId)),
        canRestore: Boolean(
          event.snapshot &&
            byId.has(event.snapshot.siteId) &&
            event.snapshotId !== byId.get(event.snapshot.siteId).liveSnapshotId &&
            canRestoreVersion(req.user, byId.get(event.snapshot.siteId).client),
        ),
        site: event.snapshot && byId.has(event.snapshot.siteId)
          ? { slug: byId.get(event.snapshot.siteId).slug, name: byId.get(event.snapshot.siteId).name }
          : null,
        sites: event.siteIds.filter((id) => byId.has(id)).map((id) => ({ slug: byId.get(id).slug, name: byId.get(id).name })),
        offers: offerLines(event.snapshot?.payload),
      }));
    res.json({
      sites: visible.map((site) => ({
        slug: site.slug,
        name: site.name,
        workspace: site.client.workspace.name,
        liveSnapshotId: site.liveSnapshotId,
      })),
      events: rows,
    });
  } catch (error) {
    next(error);
  }
});

recordsRouter.get("/sites/:slug/versions/:snapshotId", async (req, res, next) => {
  try {
    const opened = await openVersion(req, res);
    if (!opened) return;
    res.json(versionPreview(opened.site, opened.snapshot));
  } catch (error) {
    next(error);
  }
});

recordsRouter.post("/sites/:slug/versions/:snapshotId/restore", async (req, res, next) => {
  try {
    const opened = await openVersion(req, res);
    if (!opened) return;
    if (!canRestoreVersion(req.user, opened.site.client)) {
      res.status(403).json({ error: "An owner or reviewer restores a version." });
      return;
    }
    if (opened.site.liveSnapshotId === opened.snapshot.id) {
      res.status(400).json({ error: "This version is already on the public page." });
      return;
    }
    const result = await prisma.$transaction(
      (tx) => restoreVersion(tx, opened.site, opened.snapshot, req.user),
      { timeout: 20000 },
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

recordsRouter.get("/sites/:slug/backups", async (req, res, next) => {
  try {
    const site = await openOwned(req, res);
    if (!site) return;
    const backups = await prisma.backup.findMany({
      where: { siteId: site.id },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      site: { slug: site.slug, name: site.name },
      backups: backups.map(presentBackup),
    });
  } catch (error) {
    next(error);
  }
});

recordsRouter.post("/sites/:slug/backups", async (req, res, next) => {
  try {
    const site = await openOwned(req, res);
    if (!site) return;
    const when = new Date();
    const label = `Backup of ${site.name} on ${historyDate(when)}.`;
    const backup = await prisma.$transaction(async (tx) => {
      const created = await tx.backup.create({
        data: {
          siteId: site.id,
          label,
          payload: backupPayload(site),
          createdById: req.user.id,
        },
        include: { createdBy: { select: { name: true } } },
      });
      await tx.historyEvent.create({
        data: {
          workspaceId: site.client.workspaceId,
          actorId: req.user.id,
          sentence: `${req.user.name} saved a backup of ${site.name} on ${historyDate(when)}.`,
          siteIds: [site.id],
        },
      });
      return created;
    });
    res.status(201).json({
      backup: presentBackup(backup),
      sentence: `${req.user.name} saved a backup of ${site.name} on ${historyDate(when)}.`,
    });
  } catch (error) {
    next(error);
  }
});

recordsRouter.get("/sites/:slug/backups/:backupId", async (req, res, next) => {
  try {
    const opened = await openBackup(req, res);
    if (!opened) return;
    res.json(backupPreview(opened.site, opened.backup));
  } catch (error) {
    next(error);
  }
});

recordsRouter.post("/sites/:slug/backups/:backupId/restore", async (req, res, next) => {
  try {
    const opened = await openBackup(req, res);
    if (!opened) return;
    const result = await prisma.$transaction(
      (tx) => restoreBackup(tx, opened.site, opened.backup, req.user),
      { timeout: 20000 },
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

recordsRouter.get("/sites/:slug/transfer", async (req, res, next) => {
  try {
    const site = await openOwned(req, res);
    if (!site) return;
    const destination = otherWorkspace(req.user, site);
    if (!destination) {
      res.status(400).json({ error: "There is no other workspace to move this website into." });
      return;
    }
    res.json(transferPreview(site, destination));
  } catch (error) {
    next(error);
  }
});

recordsRouter.post("/sites/:slug/transfer", async (req, res, next) => {
  try {
    const site = await openOwned(req, res);
    if (!site) return;
    const destination = otherWorkspace(req.user, site);
    if (!destination) {
      res.status(400).json({ error: "There is no other workspace to move this website into." });
      return;
    }
    const pageIds = site.pages.map((page) => page.id);
    const result = await prisma.$transaction(
      (tx) => transferSite(tx, site, destination, req.user),
      { timeout: 20000 },
    );
    const afterwards = await prisma.page.findMany({ where: { siteId: site.id }, select: { id: true } });
    const samePages = pageIds.length === afterwards.length && pageIds.every((id) => afterwards.some((page) => page.id === id));
    res.json({ ...result, pagesKept: samePages });
  } catch (error) {
    next(error);
  }
});

function presentBackup(backup) {
  return {
    id: backup.id,
    label: backup.label,
    createdAt: backup.createdAt,
    actor: backup.createdBy?.name || "",
  };
}

function versionPreview(site, snapshot) {
  return {
    snapshotId: snapshot.id,
    takenAt: snapshot.createdAt,
    sentence: snapshot.label,
    live: site.liveSnapshotId === snapshot.id,
    changes: versionChanges(site, snapshot.payload),
    warning: `The public page for ${site.name} updates when you confirm. This restore is added to the history.`,
  };
}

function backupPreview(site, backup) {
  return {
    backup: presentBackup(backup),
    changes: backupChanges(site, backup.payload),
    warning: `Restoring replaces the current draft and the published page of ${site.name} with the backup from ${historyDate(backup.createdAt)}. Home, Offers, and Contact stay in place.`,
  };
}

function transferPreview(site, destination) {
  return {
    site: { slug: site.slug, name: site.name },
    from: site.client.workspace.name,
    to: destination.name,
    client: site.client.name,
    stripped: privateLeftovers(site),
    warning: `${site.name} moves from ${site.client.workspace.name} to ${destination.name}. Pages, offers, and public text stay on the website. Analytics IDs, internal notes, and private fields are removed.`,
  };
}

async function openVersion(req, res) {
  const site = await openVisible(req, res);
  if (!site) return null;
  if (!UUID.test(req.params.snapshotId)) {
    res.status(404).json({ error: "That version was not found." });
    return null;
  }
  const snapshot = await prisma.snapshot.findUnique({ where: { id: req.params.snapshotId } });
  if (!snapshot || snapshot.siteId !== site.id) {
    res.status(404).json({ error: "That version was not found." });
    return null;
  }
  return { site, snapshot };
}

async function openBackup(req, res) {
  const site = await openOwned(req, res);
  if (!site) return null;
  if (!UUID.test(req.params.backupId)) {
    res.status(404).json({ error: "That backup was not found." });
    return null;
  }
  const backup = await prisma.backup.findUnique({
    where: { id: req.params.backupId },
    include: { createdBy: { select: { name: true } } },
  });
  if (!backup || backup.siteId !== site.id) {
    res.status(404).json({ error: "That backup was not found." });
    return null;
  }
  return { site, backup };
}

async function openOwned(req, res) {
  const site = await openVisible(req, res);
  if (!site) return null;
  if (!canOwnSite(req.user, site.client)) {
    res.status(403).json({ error: "An owner backs up a website and moves it." });
    return null;
  }
  return site;
}

async function openVisible(req, res) {
  const site = await loadSite(req.params.slug);
  if (!site || !canAccessClient(req.user, site.client)) {
    res.status(404).json({ error: "Website not found." });
    return null;
  }
  return site;
}

async function visibleSites(user) {
  const sites = await prisma.site.findMany({
    include: { client: { include: { workspace: true } } },
    orderBy: { name: "asc" },
  });
  return sites.filter((site) => canAccessClient(user, site.client));
}

function otherWorkspace(user, site) {
  const membership = user.memberships.find(
    (item) => item.role === "owner" && item.workspaceId !== site.client.workspaceId,
  );
  return membership?.workspace || null;
}

function offerLines(payload) {
  if (!payload || !Array.isArray(payload.offers)) return [];
  const names = Object.fromEntries((payload.languages || []).map((item) => [item.code, item.name]));
  return payload.offers.map((row) => ({
    label: row.publishedLabel || "Offer",
    language: names[row.language] || row.language,
    price: row.publishedPrice,
  }));
}

function versionChanges(site, payload) {
  const changes = [];
  const names = languageNames(site, payload);
  const publishedCodes = new Set((payload?.languages || []).map((item) => item.code));
  pushTheme(changes, site.theme, payload?.theme);
  for (const item of site.siteLanguages) {
    const next = publishedCodes.has(item.language.code) ? "published" : "draft";
    pushChange(changes, "Language", item.language.name, item.status, next);
  }
  const incoming = new Map((payload?.fields || []).map((field) => [`${field.language}:${field.key}`, field.publishedValue || ""]));
  for (const value of site.contentValues) {
    if (value.field.sensitive || !publishedCodes.has(value.language.code)) continue;
    const next = incoming.get(`${value.language.code}:${value.field.key}`) || "";
    pushChange(changes, value.field.label, names[value.language.code], value.publishedValue || "", next);
  }
  const incomingOffers = new Map(
    (payload?.offers || []).map((row) => [`${row.language}:${row.code}`, row]),
  );
  for (const row of site.siteOffers) {
    if (!publishedCodes.has(row.language.code)) continue;
    const next = incomingOffers.get(`${row.language.code}:${row.offer.code}`);
    pushChange(
      changes,
      `${next?.publishedLabel || row.publishedLabel || row.offer.name} price`,
      names[row.language.code],
      row.publishedPrice || "",
      next?.publishedPrice || "",
    );
  }
  return changes;
}

function backupChanges(site, payload) {
  const changes = [];
  const names = languageNames(site, payload);
  pushTheme(changes, site.theme, payload?.theme);
  const nextStatus = new Map((payload?.languages || []).map((item) => [item.code, item.status]));
  for (const item of site.siteLanguages) {
    pushChange(changes, "Language", item.language.name, item.status, nextStatus.get(item.language.code) || "draft");
  }
  const incoming = new Map((payload?.fields || []).map((field) => [`${field.language}:${field.key}`, field]));
  for (const value of site.contentValues) {
    const next = incoming.get(`${value.language.code}:${value.field.key}`);
    pushChange(changes, value.field.label, names[value.language.code] || value.language.name, value.draftValue || "", next?.draftValue || "");
    pushChange(
      changes,
      `${value.field.label} on the public page`,
      names[value.language.code] || value.language.name,
      value.publishedValue || "",
      next?.publishedValue || "",
    );
  }
  const incomingOffers = new Map((payload?.offers || []).map((row) => [`${row.language}:${row.code}`, row]));
  for (const row of site.siteOffers) {
    const next = incomingOffers.get(`${row.language.code}:${row.offer.code}`);
    const label = row.draftLabel || row.offer.name;
    pushChange(changes, `${label} price`, names[row.language.code], row.draftPrice || "", next?.draftPrice || "");
    pushChange(
      changes,
      `${label} price on the public page`,
      names[row.language.code],
      row.publishedPrice || "",
      next?.publishedPrice || "",
    );
  }
  pushChange(changes, "Internal notes", "Private", site.internalNotes || "", payload?.internalNotes || "");
  pushChange(changes, "Analytics ID", "Private", site.analytics?.gaMeasurementId || "", payload?.analytics?.gaMeasurementId || "");
  pushChange(changes, "Tag Manager ID", "Private", site.analytics?.gtmContainerId || "", payload?.analytics?.gtmContainerId || "");
  return changes;
}

function pushTheme(changes, current, next) {
  if (!current && !next) return;
  pushChange(changes, "Primary colour", "Branding", current?.primaryColor || "", next?.primaryColor || "");
  pushChange(changes, "Secondary colour", "Branding", current?.secondaryColor || "", next?.secondaryColor || "");
  pushChange(changes, "Accent colour", "Branding", current?.accentColor || "", next?.accentColor || "");
  pushChange(changes, "Font", "Branding", current?.fontFamily || "", next?.fontFamily || "");
  pushChange(changes, "Logo address", "Branding", current?.logoUrl || "", next?.logoUrl || "");
}

function pushChange(changes, label, language, current, restored) {
  if ((current || "") === (restored || "")) return;
  changes.push({
    label,
    language,
    current: current || "Empty",
    restored: restored || "Empty",
  });
}

function languageNames(site, payload) {
  const names = {};
  for (const item of site.siteLanguages) names[item.language.code] = item.language.name;
  for (const item of payload?.languages || []) names[item.code] = item.name || names[item.code] || item.code;
  return names;
}

function privateLeftovers(site) {
  const rows = [];
  if (site.internalNotes) rows.push({ label: "Internal notes", value: site.internalNotes });
  if (site.analytics?.gaMeasurementId) rows.push({ label: "Analytics ID", value: site.analytics.gaMeasurementId });
  if (site.analytics?.gtmContainerId) rows.push({ label: "Tag Manager ID", value: site.analytics.gtmContainerId });
  for (const value of site.contentValues) {
    if (!value.field.sensitive) continue;
    const text = value.draftValue || value.publishedValue || "";
    if (!text) continue;
    rows.push({ label: value.field.label, language: value.language.name, value: text });
  }
  return rows;
}

function backupPayload(site) {
  return {
    name: site.name,
    status: site.status,
    internalNotes: site.internalNotes,
    analytics: site.analytics
      ? {
          gaMeasurementId: site.analytics.gaMeasurementId,
          gtmContainerId: site.analytics.gtmContainerId,
        }
      : null,
    theme: site.theme
      ? {
          primaryColor: site.theme.primaryColor,
          secondaryColor: site.theme.secondaryColor,
          accentColor: site.theme.accentColor,
          fontFamily: site.theme.fontFamily,
          logoUrl: site.theme.logoUrl,
        }
      : null,
    pages: site.pages.map((page) => ({ key: page.key, path: page.path, sortOrder: page.sortOrder })),
    languages: site.siteLanguages.map((item) => ({
      code: item.language.code,
      name: item.language.name,
      status: item.status,
    })),
    fields: site.contentValues.map((value) => ({
      key: value.field.key,
      language: value.language.code,
      draftValue: value.draftValue,
      publishedValue: value.publishedValue,
      sensitive: value.field.sensitive,
    })),
    offers: site.siteOffers.map((row) => ({
      code: row.offer.code,
      language: row.language.code,
      draftLabel: row.draftLabel,
      publishedLabel: row.publishedLabel,
      draftPrice: row.draftPrice,
      publishedPrice: row.publishedPrice,
    })),
  };
}

async function restoreVersion(tx, site, snapshot, actor) {
  await applyPublished(tx, site, snapshot.payload, actor.id);
  const full = await tx.site.findUnique({ where: { id: site.id }, include: siteDetailInclude });
  const priceNote = restoredPrices(snapshot.payload);
  const sentence = `${site.name} was restored to the version from ${historyDate(snapshot.createdAt)}${priceNote} by ${actor.name} on ${historyDate(new Date())}.`;
  const created = await tx.snapshot.create({
    data: {
      siteId: site.id,
      kind: "restore",
      label: sentence,
      payload: snapshotPayload(full),
      createdById: actor.id,
    },
  });
  await tx.site.update({
    where: { id: site.id },
    data: { status: "live", liveSnapshotId: created.id },
  });
  await tx.historyEvent.create({
    data: {
      workspaceId: site.client.workspaceId,
      actorId: actor.id,
      sentence,
      siteIds: [site.id],
      snapshotId: created.id,
    },
  });
  return { sentence };
}

function restoredPrices(payload) {
  const lines = offerLines(payload);
  if (lines.length === 0) return "";
  const text = lines.map((row) => `${row.label} at ${row.price} in ${row.language}`).join(", ");
  return `, with ${text}, `;
}

async function restoreBackup(tx, site, backup, actor) {
  const payload = backup.payload;
  await applyStored(tx, site, payload, actor.id);
  const full = await tx.site.findUnique({ where: { id: site.id }, include: siteDetailInclude });
  const published = full.siteLanguages.some((item) => item.status === "published");
  const status = payload.status === "live" && published ? "live" : "draft";
  let snapshotId = null;
  if (status === "live") {
    const created = await tx.snapshot.create({
      data: {
        siteId: site.id,
        kind: "restore",
        label: `Restored backup of ${site.name}.`,
        payload: snapshotPayload(full),
        createdById: actor.id,
      },
    });
    snapshotId = created.id;
  }
  await tx.site.update({
    where: { id: site.id },
    data: {
      status,
      liveSnapshotId: snapshotId,
      internalNotes: payload.internalNotes || null,
    },
  });
  await writeAnalytics(tx, site, payload.analytics);
  const sentence = `${actor.name} restored ${site.name} from the backup taken on ${historyDate(backup.createdAt)}.`;
  await tx.historyEvent.create({
    data: {
      workspaceId: full.client.workspaceId,
      actorId: actor.id,
      sentence,
      siteIds: [site.id],
      snapshotId,
    },
  });
  return { sentence };
}

async function transferSite(tx, site, destination, actor) {
  const leftovers = privateLeftovers(site);
  let client = await tx.client.findUnique({
    where: { workspaceId_slug: { workspaceId: destination.id, slug: site.client.slug } },
  });
  if (!client) {
    client = await tx.client.create({
      data: { workspaceId: destination.id, name: site.client.name, slug: site.client.slug },
    });
  }
  await tx.site.update({
    where: { id: site.id },
    data: { clientId: client.id, internalNotes: null },
  });
  if (site.analytics) {
    await tx.analyticsSettings.delete({ where: { siteId: site.id } });
  }
  for (const value of site.contentValues) {
    if (!value.field.sensitive) continue;
    if (!value.draftValue && !value.publishedValue) continue;
    await tx.contentValue.update({
      where: { id: value.id },
      data: { draftValue: "", publishedValue: null, revision: { increment: 1 }, updatedById: actor.id },
    });
  }
  const left = leftovers.length
    ? "Analytics IDs, internal notes, and private fields were left behind."
    : "No analytics IDs, internal notes, or private fields were on this website.";
  const sentence = `${actor.name} moved ${site.name} from ${site.client.workspace.name} to ${destination.name} on ${historyDate(new Date())}. ${left}`;
  await tx.historyEvent.create({
    data: {
      workspaceId: destination.id,
      actorId: actor.id,
      sentence,
      siteIds: [site.id],
    },
  });
  return { sentence, stripped: leftovers };
}

async function applyPublished(tx, site, payload, actorId) {
  const { languages, fields, offers } = await catalogs(tx);
  if (payload?.theme && site.theme) await writeTheme(tx, site.id, payload.theme);
  const wanted = new Set((payload?.languages || []).map((item) => item.code));
  for (const code of wanted) {
    const language = languages.get(code);
    if (!language) continue;
    const existing = site.siteLanguages.find((item) => item.languageId === language.id);
    if (existing) {
      if (existing.status !== "published") {
        await tx.siteLanguage.update({ where: { id: existing.id }, data: { status: "published" } });
      }
    } else {
      await tx.siteLanguage.create({
        data: { siteId: site.id, languageId: language.id, status: "published" },
      });
    }
  }
  for (const item of site.siteLanguages) {
    if (!wanted.has(item.language.code) && item.status === "published") {
      await tx.siteLanguage.update({ where: { id: item.id }, data: { status: "draft" } });
    }
  }
  const seen = new Set();
  for (const field of payload?.fields || []) {
    const spec = fields.get(field.key);
    const language = languages.get(field.language);
    if (!spec || spec.sensitive || !language) continue;
    seen.add(`${field.language}:${field.key}`);
    await writeField(tx, site, spec, language.id, field.publishedValue || "", field.publishedValue || null, actorId);
  }
  for (const value of site.contentValues) {
    if (value.field.sensitive || !wanted.has(value.language.code)) continue;
    if (seen.has(`${value.language.code}:${value.field.key}`)) continue;
    await tx.contentValue.update({
      where: { id: value.id },
      data: { draftValue: "", publishedValue: null, revision: { increment: 1 }, updatedById: actorId },
    });
  }
  const seenOffers = new Set();
  for (const row of payload?.offers || []) {
    const offer = offers.get(row.code);
    const language = languages.get(row.language);
    if (!offer || !language) continue;
    seenOffers.add(`${row.language}:${row.code}`);
    await writeOffer(tx, site, offer, language.id, {
      draftLabel: row.publishedLabel,
      publishedLabel: row.publishedLabel,
      draftPrice: row.publishedPrice || "",
      publishedPrice: row.publishedPrice || null,
      actorId,
    });
  }
  for (const row of site.siteOffers) {
    if (!wanted.has(row.language.code) || seenOffers.has(`${row.language.code}:${row.offer.code}`)) continue;
    await tx.siteOffer.update({
      where: { id: row.id },
      data: {
        publishedLabel: null,
        publishedPrice: null,
        draftPrice: "",
        revision: { increment: 1 },
        updatedById: actorId,
      },
    });
  }
}

async function applyStored(tx, site, payload, actorId) {
  const { languages, fields, offers } = await catalogs(tx);
  if (payload?.theme && site.theme) await writeTheme(tx, site.id, payload.theme);
  const wanted = new Map((payload?.languages || []).map((item) => [item.code, item.status || "draft"]));
  for (const [code, status] of wanted) {
    const language = languages.get(code);
    if (!language) continue;
    const existing = site.siteLanguages.find((item) => item.languageId === language.id);
    if (existing) {
      if (existing.status !== status) {
        await tx.siteLanguage.update({ where: { id: existing.id }, data: { status } });
      }
    } else {
      await tx.siteLanguage.create({ data: { siteId: site.id, languageId: language.id, status } });
    }
  }
  for (const item of site.siteLanguages) {
    if (!wanted.has(item.language.code) && item.status !== "draft") {
      await tx.siteLanguage.update({ where: { id: item.id }, data: { status: "draft" } });
    }
  }
  const seen = new Set();
  for (const field of payload?.fields || []) {
    const spec = fields.get(field.key);
    const language = languages.get(field.language);
    if (!spec || !language) continue;
    seen.add(`${field.language}:${field.key}`);
    await writeField(tx, site, spec, language.id, field.draftValue || "", field.publishedValue || null, actorId);
  }
  for (const value of site.contentValues) {
    if (seen.has(`${value.language.code}:${value.field.key}`)) continue;
    await tx.contentValue.update({
      where: { id: value.id },
      data: { draftValue: "", publishedValue: null, revision: { increment: 1 }, updatedById: actorId },
    });
  }
  const seenOffers = new Set();
  for (const row of payload?.offers || []) {
    const offer = offers.get(row.code);
    const language = languages.get(row.language);
    if (!offer || !language) continue;
    seenOffers.add(`${row.language}:${row.code}`);
    await writeOffer(tx, site, offer, language.id, {
      draftLabel: row.draftLabel,
      publishedLabel: row.publishedLabel,
      draftPrice: row.draftPrice || "",
      publishedPrice: row.publishedPrice,
      actorId,
    });
  }
  for (const row of site.siteOffers) {
    if (seenOffers.has(`${row.language.code}:${row.offer.code}`)) continue;
    await tx.siteOffer.update({
      where: { id: row.id },
      data: {
        draftLabel: null,
        publishedLabel: null,
        draftPrice: "",
        publishedPrice: null,
        revision: { increment: 1 },
        updatedById: actorId,
      },
    });
  }
}

async function catalogs(tx) {
  const [languageRows, fieldRows, offerRows] = await Promise.all([
    tx.language.findMany(),
    tx.contentField.findMany(),
    tx.offer.findMany(),
  ]);
  return {
    languages: new Map(languageRows.map((item) => [item.code, item])),
    fields: new Map(fieldRows.map((item) => [item.key, item])),
    offers: new Map(offerRows.map((item) => [item.code, item])),
  };
}

async function writeTheme(tx, siteId, theme) {
  await tx.theme.update({
    where: { siteId },
    data: {
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      accentColor: theme.accentColor,
      fontFamily: theme.fontFamily,
      logoUrl: theme.logoUrl || null,
    },
  });
}

async function writeField(tx, site, field, languageId, draftValue, publishedValue, actorId) {
  const current = site.contentValues.find((value) => value.fieldId === field.id && value.languageId === languageId);
  if (current) {
    await tx.contentValue.update({
      where: { id: current.id },
      data: { draftValue, publishedValue, revision: { increment: 1 }, updatedById: actorId },
    });
    return;
  }
  await tx.contentValue.create({
    data: {
      siteId: site.id,
      fieldId: field.id,
      languageId,
      draftValue,
      publishedValue,
      updatedById: actorId,
    },
  });
}

async function writeOffer(tx, site, offer, languageId, values) {
  const current = site.siteOffers.find((row) => row.offerId === offer.id && row.languageId === languageId);
  if (current) {
    await tx.siteOffer.update({
      where: { id: current.id },
      data: {
        draftLabel: values.draftLabel,
        publishedLabel: values.publishedLabel,
        draftPrice: values.draftPrice,
        publishedPrice: values.publishedPrice,
        revision: { increment: 1 },
        updatedById: values.actorId,
      },
    });
    return;
  }
  await tx.siteOffer.create({
    data: {
      siteId: site.id,
      offerId: offer.id,
      languageId,
      draftLabel: values.draftLabel,
      publishedLabel: values.publishedLabel,
      draftPrice: values.draftPrice,
      publishedPrice: values.publishedPrice,
      updatedById: values.actorId,
    },
  });
}

async function writeAnalytics(tx, site, analytics) {
  const ga = analytics?.gaMeasurementId || null;
  const gtm = analytics?.gtmContainerId || null;
  if (!ga && !gtm) {
    if (site.analytics) await tx.analyticsSettings.delete({ where: { siteId: site.id } });
    return;
  }
  await tx.analyticsSettings.upsert({
    where: { siteId: site.id },
    create: { siteId: site.id, gaMeasurementId: ga, gtmContainerId: gtm },
    update: { gaMeasurementId: ga, gtmContainerId: gtm },
  });
}
