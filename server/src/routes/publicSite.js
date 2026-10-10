import { Router } from "express";
import { prisma } from "../db.js";
import { toPublicSite } from "../serialize.js";

const LANGUAGE_ORDER = ["en", "ta", "si"];

function siteOrigin() {
  return (process.env.PUBLIC_SITE_ORIGIN || process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");
}

function pagePath(slug, path) {
  return path ? `/s/${slug}/${path}` : `/s/${slug}`;
}

function byLanguageCode(left, right) {
  const leftRank = LANGUAGE_ORDER.indexOf(left);
  const rightRank = LANGUAGE_ORDER.indexOf(right);
  return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
}

function xml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export const publicRouter = Router();

const publicInclude = {
  theme: true,
  pages: true,
  siteLanguages: { include: { language: true } },
  contentValues: { include: { field: true, language: true } },
  siteOffers: { include: { offer: true, language: true } },
};

publicRouter.get("/sitemap.xml", async (_req, res, next) => {
  try {
    const origin = siteOrigin();
    const sites = await prisma.site.findMany({
      where: { liveSnapshotId: { not: null } },
      include: {
        pages: { orderBy: { sortOrder: "asc" } },
        siteLanguages: { include: { language: true } },
      },
      orderBy: { slug: "asc" },
    });
    const urls = [];
    for (const site of sites) {
      const published = site.siteLanguages
        .filter((item) => item.status === "published")
        .map((item) => item.language.code)
        .sort(byLanguageCode);
      if (published.length === 0) continue;
      const [defaultLanguage, ...rest] = published;
      for (const page of site.pages) {
        const path = pagePath(site.slug, page.path);
        urls.push(`${origin}${path}`);
        for (const code of rest) {
          if (code === defaultLanguage) continue;
          urls.push(`${origin}${path}?lang=${code}`);
        }
      }
    }
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map((url) => `  <url><loc>${xml(url)}</loc></url>`),
      "</urlset>",
      "",
    ].join("\n");
    res.type("application/xml").send(body);
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/robots.txt", (_req, res) => {
  const origin = siteOrigin();
  res.type("text/plain").send(
    [
      "User-agent: *",
      "Allow: /s/",
      "Disallow: /app/",
      "Disallow: /s/*/preview",
      "",
      `Sitemap: ${origin}/sitemap.xml`,
      "",
    ].join("\n"),
  );
});

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
