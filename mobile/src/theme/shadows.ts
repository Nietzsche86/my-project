import { ViewStyle } from "react-native";

/**
 * Design Tokens: Shadows & Elevations
 * Soft and subtle shadows per UI/UX Guideline
 */
export const shadows = {
  soft: {
    boxShadow: "0 1px 3px rgba(31, 41, 55, 0.05)",
    shadowColor: "#1F2937",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  } as ViewStyle,

  medium: {
    boxShadow: "0 4px 12px rgba(31, 41, 55, 0.06)",
    shadowColor: "#1F2937",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  } as ViewStyle,

  glowPrimary: {
    boxShadow: "0 4px 12px rgba(15, 118, 110, 0.15)",
    shadowColor: "#0F766E",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  } as ViewStyle,

  card: {
    boxShadow: "0 1px 2px rgba(31, 41, 55, 0.04)",
    shadowColor: "#1F2937",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  } as ViewStyle,

  raised: {
    boxShadow: "0 4px 14px rgba(31, 41, 55, 0.08)",
    shadowColor: "#1F2937",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  } as ViewStyle,

  overlay: {
    boxShadow: "0 10px 25px rgba(31, 41, 55, 0.15)",
    shadowColor: "#1F2937",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  } as ViewStyle,
} as const;

export type Shadows = typeof shadows;
