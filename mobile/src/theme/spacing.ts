/**
 * Design Tokens: Spacing
 * MTs Roudhotut Thowalib - UI/UX Guideline Compliant
 * Kelipatan 8 (padding layar 16, jarak antar kartu 12)
 */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  cardGap: 12,
  md: 12,
  screen: 16,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export type Spacing = typeof spacing;
