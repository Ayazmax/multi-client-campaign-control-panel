export const siteDetailInclude = {
  client: { include: { workspace: true } },
  siteLanguages: { include: { language: true } },
  theme: true,
  pages: true,
  analytics: true,
  contentValues: { include: { field: true, language: true, updatedBy: { select: { name: true } } } },
  siteOffers: { include: { offer: true, language: true, updatedBy: { select: { name: true } } } },
};
