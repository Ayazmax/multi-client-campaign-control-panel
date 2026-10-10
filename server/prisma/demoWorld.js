export const DEMO_PASSWORD = "Demo1234!";
export const PUBLISHED_ON = new Date("2026-10-09T04:30:00.000Z");
export const OFFER_PRICE = "Rs 4,999";

export const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "si", name: "Sinhala", nativeName: "සිංහල" },
];

export const FIELD_CATALOG = [
  ["home.seo.title", "home", "Page title", false],
  ["home.seo.description", "home", "Search description", false],
  ["home.h1", "home", "Main heading", false],
  ["home.hero.title", "home", "Hero title", false],
  ["home.hero.subtitle", "home", "Hero text", false],
  ["home.hero.image", "home", "Hero image URL", false],
  ["offers.seo.title", "offers", "Page title", false],
  ["offers.seo.description", "offers", "Search description", false],
  ["offers.h1", "offers", "Main heading", false],
  ["offers.intro", "offers", "Offers introduction", false],
  ["contact.seo.title", "contact", "Page title", false],
  ["contact.seo.description", "contact", "Search description", false],
  ["contact.h1", "contact", "Main heading", false],
  ["contact.intro", "contact", "Contact introduction", false],
  ["contact.phone", "contact", "Phone", false],
  ["contact.email", "contact", "Email", false],
  ["contact.address", "contact", "Address", false],
  ["contact.private_line", "contact", "Private contact line", true],
];

export const PUBLIC_FIELD_KEYS = FIELD_CATALOG.filter((field) => !field[3]).map(
  (field) => field[0],
);

const PAGES = [
  { key: "home", path: "", sortOrder: 0 },
  { key: "offers", path: "offers", sortOrder: 1 },
  { key: "contact", path: "contact", sortOrder: 2 },
];

function pack(spec) {
  const copy = {
    "home.seo.title": spec.seoTitle,
    "home.seo.description": spec.seoDescription,
    "home.h1": spec.h1,
    "home.hero.title": spec.heroTitle,
    "home.hero.subtitle": spec.heroSubtitle,
    "home.hero.image": spec.image,
    "offers.seo.title": spec.offersSeoTitle,
    "offers.seo.description": spec.offersSeoDescription,
    "offers.h1": spec.offersH1,
    "offers.intro": spec.offersIntro,
    "contact.seo.title": spec.contactSeoTitle,
    "contact.seo.description": spec.contactSeoDescription,
    "contact.h1": spec.contactH1,
    "contact.intro": spec.contactIntro,
    "contact.phone": spec.phone,
    "contact.email": spec.email,
    "contact.address": spec.address,
  };
  for (const key of PUBLIC_FIELD_KEYS) {
    if (!copy[key]) {
      throw new Error(`Demo copy is missing ${key} for ${spec.h1}`);
    }
  }
  return copy;
}

const mobileImage =
  "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1600&q=80";
const familyImage =
  "https://images.unsplash.com/photo-1609220136736-443140cffec6?auto=format&fit=crop&w=1600&q=80";
const homesImage =
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=80";
const eatsImage =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80";
const loansImage =
  "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1600&q=80";
const clinicImage =
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1600&q=80";
const campusImage =
  "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1600&q=80";

export const SITES = [
  {
    slug: "northwind-mobile",
    name: "Northwind Mobile",
    clientSlug: "northwind",
    status: "live",
    internalNotes:
      "Billing contact is private. Do not copy this note onto a new campaign.",
    analytics: { gaMeasurementId: "G-NWMOBILE01", gtmContainerId: "GTM-NWM001" },
    privateLine: "Director mobile 077 412 8801",
    theme: {
      primaryColor: "#0f6e56",
      secondaryColor: "#16352e",
      accentColor: "#e2a33a",
      fontFamily: "Source Serif 4",
    },
    pages: PAGES,
    languages: [
      {
        code: "en",
        status: "published",
        offerLabel: "Festive Fibre Plan",
        copy: pack({
          seoTitle: "Northwind Mobile | Festive Fibre Plan",
          seoDescription:
            "Island-wide mobile plans with the Festive Fibre Plan at Rs 4,999.",
          h1: "Northwind Mobile",
          heroTitle: "Stay online across the island",
          heroSubtitle:
            "Move the whole household onto the Festive Fibre Plan before the season starts.",
          image: mobileImage,
          offersSeoTitle: "Offers | Northwind Mobile",
          offersSeoDescription: "One shared festive plan, with the price written out.",
          offersH1: "Current offers",
          offersIntro: "The Festive Fibre Plan is the offer running on this campaign.",
          contactSeoTitle: "Contact | Northwind Mobile",
          contactSeoDescription: "Call the Colombo desk about the Festive Fibre Plan.",
          contactH1: "Talk to Northwind",
          contactIntro: "The campaign desk answers in English.",
          phone: "011 2 555 100",
          email: "hello@northwindmobile.demo",
          address: "18 Galle Road, Colombo 03",
        }),
      },
    ],
  },
  {
    slug: "northwind-family",
    name: "Northwind Family",
    clientSlug: "northwind",
    status: "live",
    internalNotes: "Family-plan discount approval stays inside Northwind.",
    analytics: { gaMeasurementId: "G-NWFAMILY01", gtmContainerId: "GTM-NWF001" },
    privateLine: "Family desk lead 077 220 4418",
    theme: {
      primaryColor: "#1d4e89",
      secondaryColor: "#10243f",
      accentColor: "#f0b429",
      fontFamily: "Source Serif 4",
    },
    pages: PAGES,
    languages: [
      {
        code: "en",
        status: "published",
        offerLabel: "Festive Fibre Plan",
        copy: pack({
          seoTitle: "Northwind Family | One bill for the household",
          seoDescription: "A family mobile plan on the Festive Fibre Plan at Rs 4,999.",
          h1: "Northwind Family",
          heroTitle: "One bill for the whole family",
          heroSubtitle: "Parents and children stay on the same Festive Fibre Plan.",
          image: familyImage,
          offersSeoTitle: "Offers | Northwind Family",
          offersSeoDescription: "The shared festive plan, priced once for the household.",
          offersH1: "Current offers",
          offersIntro: "Every Northwind Family page uses the same Festive Fibre Plan.",
          contactSeoTitle: "Contact | Northwind Family",
          contactSeoDescription: "Ask the family desk about adding a line.",
          contactH1: "Talk to the family desk",
          contactIntro: "The family desk answers in English.",
          phone: "011 2 555 180",
          email: "family@northwind.demo",
          address: "18 Galle Road, Colombo 03",
        }),
      },
      {
        code: "ta",
        status: "published",
        offerLabel: "பண்டிகை ஃபைபர் திட்டம்",
        copy: pack({
          seoTitle: "நார்த்விண்ட் குடும்பம் | ஒரே பில்",
          seoDescription: "குடும்ப மொபைல் திட்டம். பண்டிகை ஃபைபர் திட்டம் ரூ 4,999.",
          h1: "நார்த்விண்ட் குடும்பம்",
          heroTitle: "குடும்பம் முழுவதும் ஒரே பில்",
          heroSubtitle: "பெற்றோரும் பிள்ளைகளும் ஒரே பண்டிகை ஃபைபர் திட்டத்தில் இருக்கிறார்கள்.",
          image: familyImage,
          offersSeoTitle: "சலுகைகள் | நார்த்விண்ட் குடும்பம்",
          offersSeoDescription: "பகிரப்பட்ட பண்டிகைத் திட்டம், தெளிவான விலை.",
          offersH1: "நடப்புச் சலுகைகள்",
          offersIntro: "இந்த பிரச்சாரத்தின் சலுகை பண்டிகை ஃபைபர் திட்டம்.",
          contactSeoTitle: "தொடர்பு | நார்த்விண்ட் குடும்பம்",
          contactSeoDescription: "ஒரு இணைப்பைச் சேர்க்க குடும்ப மேசையை அழைக்கவும்.",
          contactH1: "குடும்ப மேசையை அழைக்கவும்",
          contactIntro: "இந்த மேசை தமிழிலும் பதிலளிக்கும்.",
          phone: "011 2 555 180",
          email: "family@northwind.demo",
          address: "18 காலி வீதி, கொழும்பு 03",
        }),
      },
    ],
  },
  {
    slug: "lanka-homes",
    name: "Lanka Homes",
    clientSlug: "lanka-homes",
    status: "live",
    internalNotes: "Seller phone numbers on private listings must stay off the public page.",
    analytics: { gaMeasurementId: "G-LANKAHOMES", gtmContainerId: "GTM-LKH001" },
    privateLine: "Seller desk 077 618 2290",
    theme: {
      primaryColor: "#8c4a2f",
      secondaryColor: "#2c211c",
      accentColor: "#d4a017",
      fontFamily: "Source Serif 4",
    },
    pages: PAGES,
    languages: [
      {
        code: "en",
        status: "published",
        offerLabel: "Festive Fibre Plan",
        copy: pack({
          seoTitle: "Lanka Homes | A home for the new year",
          seoDescription: "View homes and the Festive Fibre Plan bundled at Rs 4,999.",
          h1: "Lanka Homes",
          heroTitle: "A home for the new year",
          heroSubtitle: "Browse listings, then ask the desk about the festive connection offer.",
          image: homesImage,
          offersSeoTitle: "Offers | Lanka Homes",
          offersSeoDescription: "The festive connection offer shown with every listing.",
          offersH1: "Current offers",
          offersIntro: "New viewers can add the Festive Fibre Plan with the viewing.",
          contactSeoTitle: "Contact | Lanka Homes",
          contactSeoDescription: "Book a viewing with the Colombo desk.",
          contactH1: "Book a viewing",
          contactIntro: "The viewing desk answers in English.",
          phone: "011 4 220 880",
          email: "visits@lankahomes.demo",
          address: "42 Duplication Road, Colombo 04",
        }),
      },
      {
        code: "ta",
        status: "published",
        offerLabel: "பண்டிகை ஃபைபர் திட்டம்",
        copy: pack({
          seoTitle: "லங்கா ஹோம்ஸ் | புத்தாண்டுக்கு ஒரு வீடு",
          seoDescription: "வீடுகளைப் பாருங்கள். பண்டிகை ஃபைபர் திட்டம் ரூ 4,999.",
          h1: "லங்கா ஹோம்ஸ்",
          heroTitle: "புத்தாண்டுக்கு ஒரு வீடு",
          heroSubtitle: "பட்டியல்களைப் பார்த்து, பண்டிகை இணைப்புச் சலுகையை மேசையிடம் கேளுங்கள்.",
          image: homesImage,
          offersSeoTitle: "சலுகைகள் | லங்கா ஹோம்ஸ்",
          offersSeoDescription: "ஒவ்வொரு பட்டியலுடனும் காட்டப்படும் பண்டிகை இணைப்புச் சலுகை.",
          offersH1: "நடப்புச் சலுகைகள்",
          offersIntro: "பார்வையுடன் பண்டிகை ஃபைபர் திட்டத்தைச் சேர்க்கலாம்.",
          contactSeoTitle: "தொடர்பு | லங்கா ஹோம்ஸ்",
          contactSeoDescription: "கொழும்பு மேசையில் ஒரு பார்வையை முன்பதிவு செய்யுங்கள்.",
          contactH1: "பார்வையை முன்பதிவு செய்யுங்கள்",
          contactIntro: "இந்த மேசை தமிழிலும் பதிலளிக்கும்.",
          phone: "011 4 220 880",
          email: "visits@lankahomes.demo",
          address: "42 டூப்ளிகேஷன் வீதி, கொழும்பு 04",
        }),
      },
      {
        code: "si",
        status: "draft",
        offerLabel: "උත්සව ෆයිබර් සැලැස්ම",
        partial: true,
        copy: {
          "home.hero.title": "අලුත් අවුරුද්දට නිවසක්",
          "home.hero.subtitle": "ලැයිස්තු බලා, උත්සව සම්බන්ධතා දීමනාව ගැන අසන්න.",
          "contact.phone": "011 4 220 880",
        },
      },
    ],
  },
  {
    slug: "island-eats",
    name: "Island Eats",
    clientSlug: "island-eats",
    status: "live",
    internalNotes: "Kitchen complaint line is internal.",
    analytics: null,
    privateLine: "Kitchen lead 077 300 1194",
    theme: {
      primaryColor: "#b42318",
      secondaryColor: "#3f1d1a",
      accentColor: "#f4b942",
      fontFamily: "Source Sans 3",
    },
    pages: PAGES,
    languages: [
      {
        code: "en",
        status: "published",
        offerLabel: "Festive Fibre Plan",
        copy: pack({
          seoTitle: "Island Eats | Festive plates tonight",
          seoDescription: "Order festive plates. The campaign offer is Rs 4,999.",
          h1: "Island Eats",
          heroTitle: "Festive plates, delivered tonight",
          heroSubtitle: "The neighbourhood kitchen is taking festive orders until 10 pm.",
          image: eatsImage,
          offersSeoTitle: "Offers | Island Eats",
          offersSeoDescription: "The festive offer served with tonight's menu.",
          offersH1: "Current offers",
          offersIntro: "Mention the Festive Fibre Plan when you book a festive table.",
          contactSeoTitle: "Contact | Island Eats",
          contactSeoDescription: "Call the order desk for tonight's festive menu.",
          contactH1: "Call the order desk",
          contactIntro: "The order desk answers in English.",
          phone: "011 7 300 221",
          email: "desk@islandeats.demo",
          address: "9 Park Street, Colombo 02",
        }),
      },
    ],
  },
  {
    slug: "metro-loans",
    name: "Metro Loans",
    clientSlug: "metro-loans",
    status: "live",
    internalNotes: "Applicant income notes never go on the public site.",
    analytics: { gaMeasurementId: "G-METROLOAN", gtmContainerId: "GTM-MTL001" },
    privateLine: "Credit desk 077 515 7720",
    theme: {
      primaryColor: "#1f4b3a",
      secondaryColor: "#14261f",
      accentColor: "#c4a35a",
      fontFamily: "Source Serif 4",
    },
    pages: PAGES,
    languages: [
      {
        code: "en",
        status: "published",
        offerLabel: "Festive Fibre Plan",
        copy: pack({
          seoTitle: "Metro Loans | The festive price in writing",
          seoDescription: "A festive loan page with the shared plan at Rs 4,999.",
          h1: "Metro Loans",
          heroTitle: "A festive loan with the price in writing",
          heroSubtitle: "See the Festive Fibre Plan beside the repayment example.",
          image: loansImage,
          offersSeoTitle: "Offers | Metro Loans",
          offersSeoDescription: "The shared festive plan, shown before you apply.",
          offersH1: "Current offers",
          offersIntro: "The Festive Fibre Plan on this page is the same offer used across the campaign.",
          contactSeoTitle: "Contact | Metro Loans",
          contactSeoDescription: "Talk to the Colombo branch about the festive plan.",
          contactH1: "Talk to the branch",
          contactIntro: "The branch desk answers in English.",
          phone: "011 5 118 400",
          email: "loans@metroloans.demo",
          address: "100 Union Place, Colombo 02",
        }),
      },
      {
        code: "ta",
        status: "published",
        offerLabel: "பண்டிகை ஃபைபர் திட்டம்",
        copy: pack({
          seoTitle: "மெட்ரோ லோன்ஸ் | விலை எழுத்தில்",
          seoDescription: "பண்டிகைக் கடன் பக்கம். பகிரப்பட்ட திட்டம் ரூ 4,999.",
          h1: "மெட்ரோ லோன்ஸ்",
          heroTitle: "விலை எழுத்தில் இருக்கும் பண்டிகைக் கடன்",
          heroSubtitle: "தவணை உதாரணத்தின் அருகில் பண்டிகை ஃபைபர் திட்டத்தைப் பாருங்கள்.",
          image: loansImage,
          offersSeoTitle: "சலுகைகள் | மெட்ரோ லோன்ஸ்",
          offersSeoDescription: "விண்ணப்பிக்கும் முன் காட்டப்படும் பகிரப்பட்ட பண்டிகைத் திட்டம்.",
          offersH1: "நடப்புச் சலுகைகள்",
          offersIntro: "இந்தப் பக்கத்தின் பண்டிகை ஃபைபர் திட்டம் பிரச்சாரம் முழுவதும் ஒன்று.",
          contactSeoTitle: "தொடர்பு | மெட்ரோ லோன்ஸ்",
          contactSeoDescription: "பண்டிகைத் திட்டம் பற்றி கொழும்பு கிளையை அழைக்கவும்.",
          contactH1: "கிளையை அழைக்கவும்",
          contactIntro: "இந்த மேசை தமிழிலும் பதிலளிக்கும்.",
          phone: "011 5 118 400",
          email: "loans@metroloans.demo",
          address: "100 யூனியன் பிளேஸ், கொழும்பு 02",
        }),
      },
    ],
  },
  {
    slug: "city-clinic",
    name: "City Clinic",
    clientSlug: "city-clinic",
    status: "live",
    internalNotes: "Patient callback numbers are private.",
    analytics: { gaMeasurementId: "G-CITYCLINIC", gtmContainerId: "GTM-CLC001" },
    privateLine: "Duty nurse 077 909 3341",
    theme: {
      primaryColor: "#0f5c75",
      secondaryColor: "#12323d",
      accentColor: "#7dba9a",
      fontFamily: "Source Serif 4",
    },
    pages: PAGES,
    languages: [
      {
        code: "en",
        status: "published",
        offerLabel: "Festive Fibre Plan",
        copy: pack({
          seoTitle: "City Clinic | Evening hours this festive week",
          seoDescription: "Evening clinic hours, with the campaign offer listed at Rs 4,999.",
          h1: "City Clinic",
          heroTitle: "Evening clinic hours through the festive week",
          heroSubtitle: "Walk-in evening hours stay open, and the festive plan price is on the page.",
          image: clinicImage,
          offersSeoTitle: "Offers | City Clinic",
          offersSeoDescription: "The festive plan listed for families visiting this week.",
          offersH1: "Current offers",
          offersIntro: "The Festive Fibre Plan is listed here so families can compare it while they visit.",
          contactSeoTitle: "Contact | City Clinic",
          contactSeoDescription: "Call the reception desk for evening hours.",
          contactH1: "Call reception",
          contactIntro: "Reception answers in English.",
          phone: "011 2 690 330",
          email: "desk@cityclinic.demo",
          address: "7 Ward Place, Colombo 07",
        }),
      },
    ],
  },
  {
    slug: "northwind-campus",
    name: "Northwind Campus",
    clientSlug: "northwind",
    status: "draft",
    sourceSlug: "northwind-mobile",
    internalNotes: null,
    analytics: null,
    privateLine: null,
    theme: {
      primaryColor: "#3d4c8a",
      secondaryColor: "#1c2140",
      accentColor: "#f08a5d",
      fontFamily: "Source Serif 4",
    },
    pages: PAGES,
    languages: [
      {
        code: "en",
        status: "draft",
        offerLabel: "Festive Fibre Plan",
        copy: pack({
          seoTitle: "Northwind Campus | Data for the new term",
          seoDescription: "A draft campus campaign. This page is not public yet.",
          h1: "Northwind Campus",
          heroTitle: "Campus data for the new term",
          heroSubtitle: "A draft for students. It stays off the public site until a reviewer publishes it.",
          image: campusImage,
          offersSeoTitle: "Offers | Northwind Campus",
          offersSeoDescription: "Draft offer copy for the campus campaign.",
          offersH1: "Current offers",
          offersIntro: "The Festive Fibre Plan is prepared here as a draft.",
          contactSeoTitle: "Contact | Northwind Campus",
          contactSeoDescription: "Draft contact details for the campus desk.",
          contactH1: "Campus desk",
          contactIntro: "This contact block is still a draft.",
          phone: "011 2 555 190",
          email: "campus@northwind.demo",
          address: "18 Galle Road, Colombo 03",
        }),
      },
    ],
  },
];

export function publishedLanguageNames(site) {
  return site.languages
    .filter((language) => language.status === "published")
    .map((language) => {
      if (language.code === "en") return "English";
      if (language.code === "ta") return "Tamil";
      if (language.code === "si") return "Sinhala";
      return language.code;
    });
}
