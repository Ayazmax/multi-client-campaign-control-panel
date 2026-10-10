import { Router } from "express";
import { prisma } from "../db.js";
import { canAccessClient, canEditSite, canPublishSite } from "../access.js";
import { cloneCampaign, publishCampaign, readCampaignName, saveCampaign, slugFromName } from "../campaign.js";
import { requireUser } from "../loadUser.js";
import { toStaffSite, toStaffSiteSummary } from "../serialize.js";
import { siteDetailInclude } from "../siteInclude.js";

export const panelRouter = Router();

const listInclude = {
  client: { include: { workspace: true } },
  siteLanguages: { include: { language: true } },
};

const detailInclude = siteDetailInclude;

panelRouter.use(requireUser);

panelRouter.get("/sites", async (req, res, next) => {
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

panelRouter.post("/sites/:slug/clone", async (req, res, next) => {
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
    res.status(201).json({ site: toStaffSite(site) });
  } catch (error) {
    next(error);
  }
});

panelRouter.patch("/sites/:slug", async (req, res, next) => {
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
    res.json({ site: toStaffSite(saved) });
  } catch (error) {
    next(error);
  }
});

panelRouter.post("/sites/:slug/publish", async (req, res, next) => {
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
    const published = await prisma.$transaction(
      (tx) => publishCampaign(tx, site, req.user),
      { timeout: 20000 },
    );
    res.json({ site: toStaffSite(published.site), sentence: published.sentence });
  } catch (error) {
    next(error);
  }
});

panelRouter.get("/sites/:slug", async (req, res, next) => {
  try {
    const site = await prisma.site.findUnique({
      where: { slug: req.params.slug },
      include: detailInclude,
    });
    if (!site || !canAccessClient(req.user, site.client)) {
      res.status(404).json({ error: "Website not found." });
      return;
    }
    res.json({ site: toStaffSite(site) });
  } catch (error) {
    next(error);
  }
});

function loadSite(slug) {
  return prisma.site.findUnique({
    where: { slug },
    include: detailInclude,
  });
}
