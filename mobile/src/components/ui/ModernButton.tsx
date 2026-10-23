import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
} from "react-native";
import { colors, radius, shadows, spacing } from "../../theme";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "gold" | "ghost";

interface ModernButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  size?: "sm" | "md" | "lg";
}

/**
 * Standard Native Button Component
 * - Uses Pressable with role-based feedback (replaces TouchableOpacity)
 * - Accessible: exposes button role, label, and disabled/busy states
 * - Minimum touch target compliant (>= 44pt)
 */
export const ModernButton: React.FC<ModernButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  size = "md",
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return {
          btn: { backgroundColor: colors.primary[700], borderColor: colors.primary[800] },
          text: { color: colors.neutral.white },
          loader: colors.neutral.white,
        };
      case "secondary":
        return {
          btn: { backgroundColor: colors.primary[50], borderColor: colors.primary[200] },
          text: { color: colors.primary[800] },
          loader: colors.primary[700],
        };
      case "outline":
        return {
          btn: { backgroundColor: "transparent", borderColor: colors.neutral.border },
          text: { color: colors.neutral.textPrimary },
          loader: colors.primary[700],
        };
      case "gold":
        return {
          btn: { backgroundColor: colors.accent.gold, borderColor: colors.accent.gold },
          text: { color: colors.neutral.white },
          loader: colors.neutral.white,
        };
      case "danger":
        return {
          btn: { backgroundColor: colors.status.conflict, borderColor: colors.status.conflict },
          text: { color: colors.neutral.white },
          loader: colors.neutral.white,
        };
      case "ghost":
        return {
          btn: { backgroundColor: "transparent", borderColor: "transparent" },
          text: { color: colors.primary[700] },
          loader: colors.primary[700],
        };
    }
  };

  const scheme = getVariantStyles();

  const getPadding = () => {
    if (size === "sm") {
      return {
        paddingVertical: spacing.xs + 2,
        paddingHorizontal: spacing.md,
        minHeight: 40,
      };
    }
    if (size === "lg") {
      return {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        minHeight: 52,
      };
    }
    return {
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      minHeight: 44,
    };
  };

  const isInteractive = !disabled && !loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{
        disabled: !isInteractive,
        busy: !!loading,
      }}
      disabled={!isInteractive}
      onPress={onPress}
      hitSlop={size === "sm" ? { top: 6, bottom: 6, left: 6, right: 6 } : undefined}
      style={({ pressed }) => [
        styles.button,
        scheme.btn,
        getPadding(),
        variant === "primary" && shadows.soft,
        !isInteractive && styles.disabled,
        pressed && isInteractive && styles.pressed,
        typeof style === "function" ? undefined : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={scheme.loader} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[styles.text, scheme.text, textStyle]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
