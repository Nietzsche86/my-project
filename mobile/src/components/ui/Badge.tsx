import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../../theme";

export type BadgeVariant =
  | "synced"
  | "pending"
  | "conflict"
  | "active"
  | "cancelled"
  | "danger"
  | "primary"
  | "gold"
  | "neutral";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = "neutral", size = "sm" }) => {
  const getColors = () => {
    switch (variant) {
      case "synced":
        return { bg: colors.status.syncedBg, text: colors.status.synced, border: colors.status.syncedBorder };
      case "pending":
        return { bg: colors.status.pendingBg, text: colors.status.pending, border: colors.status.pendingBorder };
      case "conflict":
        return { bg: colors.status.conflictBg, text: colors.status.conflict, border: colors.status.conflictBorder };
      case "active":
        return { bg: colors.status.activeBg, text: colors.status.active, border: colors.status.syncedBorder };
      case "cancelled":
      case "danger":
        return { bg: colors.status.cancelledBg, text: colors.status.cancelled, border: colors.status.conflictBorder };
      case "primary":
        return { bg: colors.primary[50], text: colors.primary[700], border: colors.primary[200] };
      case "gold":
        return { bg: colors.accent.goldLight, text: colors.accent.gold, border: colors.accent.goldBorder };
      case "neutral":
      default:
        return { bg: colors.neutral.surfaceHover, text: colors.neutral.textMuted, border: colors.neutral.border };
    }
  };

  const scheme = getColors();
  const isSm = size === "sm";

  return (
    <View
      accessibilityRole="text"
      style={[
        styles.badge,
        {
          backgroundColor: scheme.bg,
          borderColor: scheme.border,
          paddingVertical: isSm ? 2 : spacing.xs,
          paddingHorizontal: isSm ? spacing.sm : spacing.md,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: scheme.text,
            fontSize: isSm ? 11 : 12,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
