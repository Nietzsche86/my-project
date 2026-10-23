/**
 * Design Tokens: Colors
 * MTs Roudhotut Thowalib - UI/UX Guideline Compliant
 */

export const colors = {
  primary: {
    50: "#F0FDFA",
    100: "#CCFBF1", // Primary soft
    200: "#99F6E4",
    300: "#5EEAD4",
    400: "#2DD4BF",
    500: "#14B8A6",
    600: "#0D9488",
    700: "#0F766E", // Brand Primary (teal tua)
    800: "#115E59",
    900: "#134E4A",
    soft: "#CCFBF1",
    brand: "#0F766E",
  },
  accent: {
    // Aksen emas lembut: HANYA untuk elemen non-teks (border, badge bg, ikon).
    // Teks di atas latar emas memakai #1F2937.
    gold: "#D4A24C",
    goldLight: "#FEF9EE",
    goldBorder: "#EAD7A1",
    teal: "#0F766E",
    tealLight: "#CCFBF1",
    indigo: "#4F46E5",
    indigoLight: "#EEF2FF",
  },
  neutral: {
    white: "#FFFFFF",
    canvas: "#F8FAF9", // Latar belakang utama
    background: "#F8FAF9",
    surface: "#FFFFFF", // Kartu & Sheet
    surfaceHover: "#F3F4F6",
    border: "#E5E7EB", // Garis border micro
    borderSubtle: "#F3F4F6",
    textPrimary: "#1F2937", // Teks utama
    textSecondary: "#6B7280", // Teks sekunder (ukuran >= 14)
    textSmall: "#4B5563", // Teks sekunder (ukuran < 14, mis. label 12)
    textMuted: "#4B5563",
    textSubtle: "#9CA3AF",
  },
  status: {
    synced: "#16A34A",
    syncedBg: "#F0FDF4",
    syncedBorder: "#BBF7D0",
    pending: "#F59E0B",
    pendingBg: "#FFFBEB",
    pendingBorder: "#FDE68A",
    conflict: "#DC2626",
    conflictBg: "#FEF2F2",
    conflictBorder: "#FECACA",
    active: "#16A34A",
    activeBg: "#F0FDF4",
    warning: "#F59E0B",
    danger: "#DC2626",
    success: "#16A34A",
    cancelled: "#DC2626",
    cancelledBg: "#FEF2F2",
  },
};

export { radii, radius } from "./radius";
export { shadows } from "./shadows";
