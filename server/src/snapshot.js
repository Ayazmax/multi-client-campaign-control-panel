export function snapshotPayload(site) {
  const publishedIds = new Set(
    site.siteLanguages
      .filter((item) => item.status === "published")
      .map((item) => item.languageId),
  );
  return {
    theme: site.theme
      ? {
          primaryColor: site.theme.primaryColor,
          secondaryColor: site.theme.secondaryColor,
          accentColor: site.theme.accentColor,
          fontFamily: site.theme.fontFamily,
          logoUrl: site.theme.logoUrl,
        }
      : null,
    languages: site.siteLanguages
      .filter((item) => publishedIds.has(item.languageId))
      .map((item) => ({
        code: item.language.code,
        name: item.language.name,
        status: item.status,
      })),
    pages: site.pages.map((page) => ({
      key: page.key,
      path: page.path,
      sortOrder: page.sortOrder,
    })),
    fields: site.contentValues
      .filter(
        (value) =>
          publishedIds.has(value.languageId) &&
          value.publishedValue &&
          !value.field.sensitive,
      )
      .map((value) => ({
        key: value.field.key,
        language: value.language.code,
        publishedValue: value.publishedValue,
      })),
    offers: site.siteOffers
      .filter((row) => publishedIds.has(row.languageId) && row.publishedPrice)
      .map((row) => ({
        code: row.offer.code,
        language: row.language.code,
        publishedLabel: row.publishedLabel,
        publishedPrice: row.publishedPrice,
      })),
  };
}

export function joinNames(names) {
  if (names.length <= 1) return names[0] || "its current language";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

export function historyDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Colombo",
  }).format(date);
}
