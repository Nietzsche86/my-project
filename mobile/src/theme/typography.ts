import { TextStyle } from "react-native";
import { colors } from "./colors";

/**
 * Design Tokens: Typography
 * UI/UX Guideline Compliant:
 * - Single font family
 * - Body: 14-16
 * - Screen Titles: 20-24 semibold
 * - Small Labels: 12 (font-medium, color #4B5563)
 */
export const type = {
  screenTitle: {
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
    color: colors.neutral.textPrimary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    color: colors.neutral.textPrimary,
  },
  body: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
    color: colors.neutral.textPrimary,
  },
  bodySecondary: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    color: colors.neutral.textSecondary,
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
    color: colors.neutral.textSmall,
  },
  caption: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 14,
    color: colors.neutral.textSubtle,
  },
  // Legacy aliases for backward compatibility
  largeTitle: {
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 32,
    color: colors.neutral.textPrimary,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
    color: colors.neutral.textPrimary,
  },
  title2: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
    color: colors.neutral.textPrimary,
  },
  headline: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    color: colors.neutral.textPrimary,
  },
  callout: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 20,
    color: colors.neutral.textPrimary,
  },
  subhead: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 18,
    color: colors.neutral.textSecondary,
  },
  footnote: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
    color: colors.neutral.textSmall,
  },
  caption2: {
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 14,
    color: colors.neutral.textSubtle,
  },
} as const satisfies Record<string, TextStyle>;

export type Typography = typeof type;
export type TypographyVariant = keyof typeof type;
