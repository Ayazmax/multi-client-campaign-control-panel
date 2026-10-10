import { prisma } from "../db.js";
import { toStaffSite } from "../serialize.js";
import { siteDetailInclude } from "../siteInclude.js";

const PAGE_NAMES = { home: "Home", offers: "Offers", contact: "Contact" };
const LANGUAGE_ORDER = ["en", "ta", "si"];

export function loadSite(slug) {
  return prisma.site.findUnique({
    where: { slug },
    include: siteDetailInclude,
  });
}

export function missingTranslations(site, catalogFields) {
  const publicFields = catalogFields
    .filter((field) => !field.sensitive)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const offers = [...new Map(site.siteOffers.map((row) => [row.offer.id, row.offer])).values()];
  const missing = [];

  for (const siteLanguage of site.siteLanguages) {
    for (const field of publicFields) {
      const value = site.contentValues.find(
        (item) => item.fieldId === field.id && item.languageId === siteLanguage.languageId,
      );
      if (value?.draftValue?.trim()) continue;
      missing.push({
        page: PAGE_NAMES[field.pageKey] || field.pageKey,
        field: field.label,
        language: siteLanguage.language.name,
        languageCode: siteLanguage.language.code,
        key: field.key,
      });
    }
    for (const offer of offers) {
      const row = site.siteOffers.find(
        (item) => item.offerId === offer.id && item.languageId === siteLanguage.languageId,
      );
      if (!row?.draftLabel?.trim()) {
        missing.push(gap(siteLanguage, "Offers", "Offer name", `offer.${offer.code}.label`));
      }
      if (!row?.draftPrice?.trim()) {
        missing.push(gap(siteLanguage, "Offers", "Offer price", `offer.${offer.code}.price`));
      }
    }
  }
  return missing;
}

export async function present(site) {
  const [fields, catalog] = await Promise.all([
    prisma.contentField.findMany(),
    prisma.language.findMany(),
  ]);
  return {
    site: toStaffSite(site),
    missing: missingTranslations(site, fields),
    catalog: catalog
      .slice()
      .sort((left, right) => languageRank(left.code) - languageRank(right.code))
      .map((language) => ({
        code: language.code,
        name: language.name,
        nativeName: language.nativeName,
      })),
  };
}

function gap(siteLanguage, page, field, key) {
  return {
    page,
    field,
    language: siteLanguage.language.name,
    languageCode: siteLanguage.language.code,
    key,
  };
}

function languageRank(code) {
  const rank = LANGUAGE_ORDER.indexOf(code);
  return rank === -1 ? 99 : rank;
}
