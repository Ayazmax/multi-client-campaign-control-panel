import { Router } from "express";
import { prisma } from "../db.js";
import { canAccessClient } from "../access.js";
import { requireUser } from "../loadUser.js";
import { toStaffSite, toStaffSiteSummary } from "../serialize.js";

export const panelRouter = Router();

const listInclude = {
  client: { include: { workspace: true } },
  siteLanguages: { include: { language: true } },
};

const detailInclude = {
  ...listInclude,
  theme: true,
  pages: true,
  analytics: true,
  contentValues: { include: { field: true, language: true } },
  siteOffers: { include: { offer: true, language: true } },
};

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
