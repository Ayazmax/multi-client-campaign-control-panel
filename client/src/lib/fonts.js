export const CAMPAIGN_FONTS = [
  "DM Sans",
  "Figtree",
  "Fraunces",
  "Libre Baskerville",
  "Literata",
  "Lora",
  "Manrope",
  "Merriweather",
  "Newsreader",
  "Nunito Sans",
  "Outfit",
  "Playfair Display",
  "Source Sans 3",
  "Source Serif 4",
];

const FONT_AXES = {
  "Source Sans 3": "wght@400;600;700",
  "Source Serif 4": "opsz,wght@8..60,500;8..60,650",
  Fraunces: "opsz,wght@9..144,500",
  Literata: "opsz,wght@7..72,500",
  Newsreader: "opsz,wght@6..72,500",
};

export function fontStylesheet(families) {
  const names = [...new Set(families.filter((name) => CAMPAIGN_FONTS.includes(name)))];
  if (names.length === 0) return "";
  const query = names
    .map((name) => `family=${name.replaceAll(" ", "+")}:${FONT_AXES[name] || "wght@400;600"}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
