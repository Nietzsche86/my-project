import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  ViewStyle,
  StyleProp,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, spacing } from "../../theme";
import { SyncChip } from "./SyncChip";
import { HeaderAddButton } from "./HeaderAddButton";
import { useAuth } from "../../context/AuthContext";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  rightAction?: React.ReactNode;
  children?: React.ReactNode; // e.g. SearchBar, FilterChips, or SegmentedTabs
  style?: StyleProp<ViewStyle>;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  onAdd,
  addLabel = "Tambah",
  rightAction,
  children,
  style,
}) => {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.topRow}>
        {/* Left: Back button + Title */}
        <View style={styles.leftCol}>
          {showBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kembali"
              onPress={handleBack}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={22} color={colors.neutral.textPrimary} />
            </Pressable>
          )}
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Right: HeaderAddButton (desktop), Custom Actions, SyncChip, Avatar */}
        <View style={styles.rightCol}>
          {onAdd && isDesktop && (
            <HeaderAddButton label={addLabel} onPress={onAdd} />
          )}

          {rightAction}

          <SyncChip />

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userInitial}</Text>
          </View>
        </View>
      </View>

      {/* Subheader slot (SearchBar, FilterChip, SegmentedTabs) */}
      {children && <View style={styles.bottomSlot}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.neutral.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
  },
  leftCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.neutral.textSmall,
    marginTop: 2,
  },
  rightCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary[700],
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  avatarText: {
    color: colors.neutral.white,
    fontSize: 14,
    fontWeight: "700",
  },
  bottomSlot: {
    marginTop: 10,
    gap: 10,
  },
  pressed: {
    opacity: 0.7,
  },
});
