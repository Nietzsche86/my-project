import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { colors, radius, shadows, spacing } from "../../theme";

interface ModernCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: "flat" | "elevated" | "accent";
  padding?: number;
}

/**
 * Standard ModernCard component
 * Grouping container with continuous corner radii and modern elevation.
 */
export const ModernCard: React.FC<ModernCardProps> = ({
  children,
  style,
  variant = "flat",
  padding = spacing.lg,
}) => {
  return (
    <View
      style={[
        styles.base,
        { padding },
        variant === "elevated" && styles.elevated,
        variant === "accent" && styles.accent,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  elevated: {
    ...shadows.soft,
    borderColor: "rgba(226, 232, 240, 0.6)",
  },
  accent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[700],
    ...shadows.soft,
  },
});
