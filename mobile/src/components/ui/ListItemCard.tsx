import React from "react";
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, spacing } from "../../theme";
import { ListItemCardSkeleton } from "./Skeleton";

interface ListItemCardProps {
  title: string;
  subtitle: string;
  avatarText?: string;
  avatarIcon?: keyof typeof Ionicons.glyphMap;
  avatarBg?: string;
  avatarTextColor?: string;
  rightBadge?: React.ReactNode;
  onPress: () => void;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const ListItemCard: React.FC<ListItemCardProps> = ({
  title,
  subtitle,
  avatarText,
  avatarIcon,
  avatarBg = colors.primary[50],
  avatarTextColor = colors.primary[800],
  rightBadge,
  onPress,
  loading = false,
  accessibilityLabel,
  style,
}) => {
  if (loading) {
    return <ListItemCardSkeleton />;
  }

  const label = accessibilityLabel || `${title}, ${subtitle}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadows.soft,
        pressed && styles.pressed,
        style,
      ]}
    >
      {/* Avatar / Initial Box */}
      <View style={[styles.avatarBox, { backgroundColor: avatarBg }]}>
        {avatarIcon ? (
          <Ionicons name={avatarIcon} size={20} color={avatarTextColor} />
        ) : (
          <Text style={[styles.avatarText, { color: avatarTextColor }]}>
            {avatarText || title.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>

      {/* 2 Baris Teks: Nama (Teks utama) + Info Sekunder */}
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {/* Right slot: Badge + Chevron */}
      <View style={styles.rightSlot}>
        {rightBadge}
        <Ionicons name="chevron-forward" size={18} color={colors.neutral.textSubtle} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    minHeight: 64,
    gap: 12,
  },
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
  },
  textCol: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.neutral.textSmall,
    marginTop: 2,
    lineHeight: 16,
  },
  rightSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pressed: {
    opacity: 0.82,
    backgroundColor: colors.neutral.surfaceHover,
    transform: [{ scale: 0.99 }],
  },
});
