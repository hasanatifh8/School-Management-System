export const ID_CARD_LAYOUTS = {
  duplex: { label: "Double-sided (front, then back page)", perPage: 9 },
  pair: { label: "Front and back side by side", perPage: 4 },
  front: { label: "Front only", perPage: 9 },
} as const;
export type IdCardLayout = keyof typeof ID_CARD_LAYOUTS;

export const parseLayout = (v: unknown): IdCardLayout => (typeof v === "string" && v in ID_CARD_LAYOUTS ? (v as IdCardLayout) : "duplex");

/** Card aspect ratio (CR80 portrait, 54 × 85.6 mm). */
export const CARD_RATIO = 85.6 / 54;

export const IMAGE_SIZES = {
  print300: { label: "Print quality · 300 DPI", width: 638 },
  print600: { label: "High-res print · 600 DPI", width: 1276 },
  screen: { label: "Phone / WhatsApp", width: 540 },
  custom: { label: "Custom width", width: 0 },
} as const;
export type ImageSizeKey = keyof typeof IMAGE_SIZES;
export const CUSTOM_WIDTH = { min: 200, max: 4000 };
