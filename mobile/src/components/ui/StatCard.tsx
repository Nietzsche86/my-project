import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  StyleProp,
} from "react-native";
import { colors, radius, shadows, spacing } from "../../theme";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg?: string;
  accentColor?: string;
  accentBg?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBg,
  accentColor,
  accentBg,
  onPress,
  style,
}) => {
  const bg = accentBg || iconBg || colors.primary[50];
  const content = (
    <View style={[styles.card, shadows.soft, style]}>
      <View style={styles.topRow}>
        <View style={[styles.iconContainer, { backgroundColor: bg }]}>
          {icon}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>

      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${value}`}
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.pressable}>{content}</View>;
};

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    minWidth: "46%",
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    minHeight: 104,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    color: colors.neutral.textSmall,
  },
  value: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.neutral.textSubtle,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
