/**
 * Design Tokens: Radius
 * MTs Roudhotut Thowalib - UI/UX Guideline Compliant
 * Kartu: 16, Tombol: 12, Chip: pill (9999)
 */
export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,      // Tombol (12)
  lg: 16,      // Kartu (16)
  xl: 20,
  button: 12,  // Tombol
  card: 16,    // Kartu
  chip: 9999,  // Chip penuh (pill)
  pill: 9999,
  full: 9999,
} as const;

export const radii = radius;
export type Radius = typeof radius;
