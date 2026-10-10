import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/passwords.js";
import {
  DEMO_PASSWORD,
  FIELD_CATALOG,
  LANGUAGES,
  OFFER_PRICE,
  PUBLISHED_ON,
  SITES,
  publishedLanguageNames,
} from "./demoWorld.js";

const prisma = new PrismaClient();

const detailInclude = {
  theme: true,
  pages: true,
  siteLanguages: { include: { language: true } },
  contentValues: { include: { field: true, language: true } },
  siteOffers: { include: { offer: true, language: true } },
};

try {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await prisma.$transaction(
    async (tx) => {
      await clearDemo(tx);
      const languages = await createLanguages(tx);
      const users = await createUsers(tx, passwordHash);
      const workspaces = await createWorkspaces(tx);
      await createMemberships(tx, users, workspaces);
      const clients = await createClients(tx, workspaces.colombo.id);
      await createGrants(tx, users, clients);
      const fields = await createFields(tx);
      const offer = await tx.offer.create({
        data: { code: "festive-fibre", name: "Festive Fibre Plan" },
      });
      const sites = await createSites(tx, {
        clients,
        languages,
        fields,
        offer,
        actorId: users.amina.id,
      });
      await publishLiveSites(tx, sites, users.amina.id, workspaces.colombo.id);
    },
    { timeout: 30000 },
  );
  console.log("Phase 2 seed complete. Demo password for every user: Demo1234!");
} finally {
  await prisma.$disconnect();
}

async function clearDemo(tx) {
  await tx.launchAttempt.deleteMany();
  await tx.historyEvent.deleteMany();
  await tx.backup.deleteMany();
  await tx.site.updateMany({
    data: { liveSnapshotId: null, sourceSiteId: null },
  });
  await tx.snapshot.deleteMany();
  await tx.siteOffer.deleteMany();
  await tx.contentValue.deleteMany();
  await tx.analyticsSettings.deleteMany();
  await tx.page.deleteMany();
  await tx.theme.deleteMany();
  await tx.siteLanguage.deleteMany();
  await tx.site.deleteMany();
  await tx.contentField.deleteMany();
  await tx.offer.deleteMany();
  await tx.clientGrant.deleteMany();
  await tx.membership.deleteMany();
  await tx.client.deleteMany();
  await tx.workspace.deleteMany();
  await tx.session.deleteMany();
  await tx.user.deleteMany();
  await tx.language.deleteMany();
}

async function createLanguages(tx) {
  const rows = {};
  for (const language of LANGUAGES) {
    rows[language.code] = await tx.language.create({ data: language });
  }
  return rows;
}

async function createUsers(tx, passwordHash) {
  const amina = await tx.user.create({
    data: { email: "amina@trident.demo", name: "Amina", passwordHash },
  });
  const ravi = await tx.user.create({
    data: { email: "ravi@trident.demo", name: "Ravi", passwordHash },
  });
  const meera = await tx.user.create({
    data: { email: "meera@trident.demo", name: "Meera", passwordHash },
  });
  return { amina, ravi, meera };
}

async function createWorkspaces(tx) {
  const colombo = await tx.workspace.create({
    data: { name: "Colombo Campaigns", slug: "colombo-campaigns" },
  });
  const archive = await tx.workspace.create({
    data: { name: "Archive", slug: "archive" },
  });
  return { colombo, archive };
}

async function createMemberships(tx, users, workspaces) {
  await tx.membership.createMany({
    data: [
      { userId: users.amina.id, workspaceId: workspaces.colombo.id, role: "owner" },
      { userId: users.amina.id, workspaceId: workspaces.archive.id, role: "owner" },
      { userId: users.ravi.id, workspaceId: workspaces.colombo.id, role: "editor" },
      { userId: users.meera.id, workspaceId: workspaces.colombo.id, role: "reviewer" },
    ],
  });
}

async function createClients(tx, workspaceId) {
  const specs = [
    ["Northwind", "northwind"],
    ["Lanka Homes", "lanka-homes"],
    ["Island Eats", "island-eats"],
    ["Metro Loans", "metro-loans"],
    ["City Clinic", "city-clinic"],
  ];
  const clients = {};
  for (const [name, slug] of specs) {
    clients[slug] = await tx.client.create({
      data: { workspaceId, name, slug },
    });
  }
  return clients;
}

async function createGrants(tx, users, clients) {
  const granted = ["northwind", "lanka-homes", "island-eats"];
  const rows = [];
  for (const slug of granted) {
    rows.push(
      { userId: users.ravi.id, clientId: clients[slug].id },
      { userId: users.meera.id, clientId: clients[slug].id },
    );
  }
  await tx.clientGrant.createMany({ data: rows });
}

async function createFields(tx) {
  const fields = new Map();
  for (const [index, [key, pageKey, label, sensitive]] of FIELD_CATALOG.entries()) {
    const field = await tx.contentField.create({
      data: { key, pageKey, label, sensitive, sortOrder: index },
    });
    fields.set(key, field.id);
  }
  return fields;
}

async function createSites(tx, { clients, languages, fields, offer, actorId }) {
  const created = [];
  const bySlug = new Map();

  for (const spec of SITES) {
    const site = await tx.site.create({
      data: {
        clientId: clients[spec.clientSlug].id,
        name: spec.name,
        slug: spec.slug,
        status: "draft",
        internalNotes: spec.internalNotes,
        createdAt: PUBLISHED_ON,
      },
    });
    bySlug.set(spec.slug, site);
    await tx.theme.create({
      data: { siteId: site.id, ...spec.theme },
    });
    await tx.page.createMany({
      data: spec.pages.map((page) => ({ siteId: site.id, ...page })),
    });
    if (spec.analytics) {
      await tx.analyticsSettings.create({
        data: { siteId: site.id, ...spec.analytics },
      });
    }
    if (spec.privateLine) {
      await tx.contentValue.create({
        data: {
          siteId: site.id,
          fieldId: fields.get("contact.private_line"),
          languageId: languages.en.id,
          draftValue: spec.privateLine,
          publishedValue: null,
          updatedById: actorId,
        },
      });
    }

    for (const language of spec.languages) {
      const languageRow = languages[language.code];
      await tx.siteLanguage.create({
        data: {
          siteId: site.id,
          languageId: languageRow.id,
          status: language.status,
          createdAt: PUBLISHED_ON,
        },
      });
      const publish = language.status === "published";
      await tx.contentValue.createMany({
        data: Object.entries(language.copy).map(([key, value]) => ({
          siteId: site.id,
          fieldId: fields.get(key),
          languageId: languageRow.id,
          draftValue: value,
          publishedValue: publish ? value : null,
          updatedById: actorId,
        })),
      });
      await tx.siteOffer.create({
        data: {
          siteId: site.id,
          offerId: offer.id,
          languageId: languageRow.id,
          draftLabel: language.offerLabel,
          publishedLabel: publish ? language.offerLabel : null,
          draftPrice: OFFER_PRICE,
          publishedPrice: publish ? OFFER_PRICE : null,
          updatedById: actorId,
        },
      });
    }

    created.push({ spec, site });
  }

  for (const { spec, site } of created) {
    if (!spec.sourceSlug) continue;
    await tx.site.update({
      where: { id: site.id },
      data: { sourceSiteId: bySlug.get(spec.sourceSlug).id },
    });
  }

  return created;
}

async function publishLiveSites(tx, sites, actorId, workspaceId) {
  for (const { spec } of sites) {
    if (spec.status !== "live") continue;
    const full = await tx.site.findUnique({
      where: { slug: spec.slug },
      include: detailInclude,
    });
    const names = publishedLanguageNames(spec);
    const sentence = `${spec.name} was published in ${joinNames(names)} by Amina on 9 Oct 2026.`;
    const snapshot = await tx.snapshot.create({
      data: {
        siteId: full.id,
        kind: "publish",
        label: sentence,
        payload: snapshotPayload(full),
        createdById: actorId,
        createdAt: PUBLISHED_ON,
      },
    });
    await tx.site.update({
      where: { id: full.id },
      data: { status: "live", liveSnapshotId: snapshot.id },
    });
    await tx.historyEvent.create({
      data: {
        workspaceId,
        actorId,
        sentence,
        siteIds: [full.id],
        snapshotId: snapshot.id,
        createdAt: PUBLISHED_ON,
      },
    });
    await tx.launchAttempt.create({
      data: {
        siteId: full.id,
        outcome: "success",
        message: sentence,
        nextStep: "The public page is serving this version.",
        snapshotId: snapshot.id,
        createdById: actorId,
        createdAt: PUBLISHED_ON,
      },
    });
  }
}

function snapshotPayload(site) {
  const publishedIds = new Set(
    site.siteLanguages
      .filter((item) => item.status === "published")
      .map((item) => item.languageId),
  );
  return {
    theme: site.theme,
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

function joinNames(names) {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}
