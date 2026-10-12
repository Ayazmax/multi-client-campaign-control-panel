import { fontStylesheet } from "../lib/fonts.js";

export function FontFaces({ families }) {
  const href = fontStylesheet(families);
  if (!href) return null;
  return <link rel="stylesheet" href={href} />;
}
