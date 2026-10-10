const LANGUAGE_ORDER = ["en", "ta", "si"];

function byLanguage(left, right) {
  const leftRank = LANGUAGE_ORDER.indexOf(left.language.code);
  const rightRank = LANGUAGE_ORDER.indexOf(right.language.code);
  return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
}

function themeOf(site) {
  if (!site.theme) return null;
  return {
    primaryColor: site.theme.primaryColor,
    secondaryColor: site.theme.secondaryColor,
    accentColor: site.theme.accentColor,
    fontFamily: site.theme.fontFamily,
    logoUrl: site.theme.logoUrl,
  };
}

export function toPublicSite(site) {
  const publishedLanguages = site.siteLanguages
    .filter((item) => item.status === "published")
    .sort(byLanguage);
  const publishedIds = new Set(publishedLanguages.map((item) => item.languageId));

  const fields = {};
  for (const value of site.contentValues) {
    if (!publishedIds.has(value.languageId)) continue;
    if (value.field.sensitive) continue;
    if (!value.publishedValue) continue;
    const code = value.language.code;
    fields[code] ??= {};
    fields[code][value.field.key] = value.publishedValue;
  }

  const offers = [];
  for (const row of site.siteOffers) {
    if (!publishedIds.has(row.languageId)) continue;
    if (!row.publishedPrice) continue;
    let offer = offers.find((item) => item.code === row.offer.code);
    if (!offer) {
      offer = { code: row.offer.code, name: row.offer.name, languages: {} };
      offers.push(offer);
    }
    offer.languages[row.language.code] = {
      label: row.publishedLabel || row.offer.name,
      price: row.publishedPrice,
    };
  }

  return {
    name: site.name,
    slug: site.slug,
    status: site.status,
    theme: themeOf(site),
    languages: publishedLanguages.map((item) => ({
      code: item.language.code,
      name: item.language.name,
      nativeName: item.language.nativeName,
    })),
    pages: [...site.pages]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((page) => ({ key: page.key, path: page.path })),
    fields,
    offers,
  };
}

export function toStaffSite(site) {
  const languages = [...site.siteLanguages].sort(byLanguage).map((item) => ({
    code: item.language.code,
    name: item.language.name,
    nativeName: item.language.nativeName,
    status: item.status,
  }));

  const fields = site.contentValues
    .slice()
    .sort((left, right) => left.field.sortOrder - right.field.sortOrder)
    .map((value) => ({
      key: value.field.key,
      label: value.field.label,
      pageKey: value.field.pageKey,
      sensitive: value.field.sensitive,
      language: value.language.code,
      draftValue: value.draftValue,
      publishedValue: value.publishedValue,
      revision: value.revision,
    }));

  const offers = site.siteOffers.map((row) => ({
    code: row.offer.code,
    name: row.offer.name,
    language: row.language.code,
    draftLabel: row.draftLabel,
    publishedLabel: row.publishedLabel,
    draftPrice: row.draftPrice,
    publishedPrice: row.publishedPrice,
    revision: row.revision,
  }));

  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    status: site.status,
    internalNotes: site.internalNotes,
    theme: themeOf(site),
    client: {
      id: site.client.id,
      name: site.client.name,
      slug: site.client.slug,
    },
    workspace: {
      id: site.client.workspace.id,
      name: site.client.workspace.name,
      slug: site.client.workspace.slug,
    },
    analytics: site.analytics
      ? {
          gaMeasurementId: site.analytics.gaMeasurementId,
          gtmContainerId: site.analytics.gtmContainerId,
        }
      : null,
    languages,
    pages: [...site.pages]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((page) => ({ key: page.key, path: page.path })),
    fields,
    offers,
  };
}

export function toStaffSiteSummary(site) {
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    status: site.status,
    client: { id: site.client.id, name: site.client.name },
    languages: [...site.siteLanguages].sort(byLanguage).map((item) => ({
      code: item.language.code,
      name: item.language.name,
      nativeName: item.language.nativeName,
      status: item.status,
    })),
  };
}
