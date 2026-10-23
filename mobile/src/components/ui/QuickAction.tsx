import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, spacing } from "../../theme";

export interface QuickActionItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badge?: number | string;
  iconColor?: string;
  iconBg?: string;
}

interface QuickActionProps {
  items: QuickActionItem[];
  style?: StyleProp<ViewStyle>;
}

export const QuickAction: React.FC<QuickActionProps> = ({ items, style }) => {
  return (
    <View style={[styles.container, style]}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          onPress={item.onPress}
          style={({ pressed }) => [
            styles.item,
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.iconBox,
              shadows.soft,
              { backgroundColor: item.iconBg || colors.primary[50] },
            ]}
          >
            <Ionicons
              name={item.icon}
              size={22}
              color={item.iconColor || colors.primary[700]}
            />
            {item.badge !== undefined && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.label} numberOfLines={2}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginVertical: spacing.cardGap,
    gap: 12,
  },
  item: {
    width: "22%",
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.status.conflict,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    color: colors.neutral.white,
    fontSize: 9,
    fontWeight: "700",
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.neutral.textSmall,
    textAlign: "center",
    lineHeight: 15,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
});
