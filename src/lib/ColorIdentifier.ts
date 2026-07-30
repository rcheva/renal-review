export const COLORS = [
  "sky",
  "red",
  "orange",
  "lime",
  "fuchsia",
  "yellow",
  "slate",
] as const;

export type ColorIdentifier = (typeof COLORS)[number];
