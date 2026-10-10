import { Router } from "express";
import { prisma } from "../db.js";
import { toPublicSite } from "../serialize.js";

export const publicRouter = Router();

const publicInclude = {
  theme: true,
  pages: true,
  siteLanguages: { include: { language: true } },
  contentValues: { include: { field: true, language: true } },
  siteOffers: { include: { offer: true, language: true } },
};

publicRouter.get("/sites/:slug", async (req, res, next) => {
  try {
    const site = await prisma.site.findUnique({
      where: { slug: req.params.slug },
      include: publicInclude,
    });
    const published = site?.siteLanguages.some((item) => item.status === "published");
    if (!site || !site.liveSnapshotId || !published) {
      res.status(404).json({ error: "This website is not public." });
      return;
    }
    res.json({ site: toPublicSite(site) });
  } catch (error) {
    next(error);
  }
});
