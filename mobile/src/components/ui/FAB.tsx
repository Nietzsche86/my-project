import React from "react";
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows } from "../../theme";

interface FABProps {
  onPress: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Floating Action Button (+ Tambah)
 * - Hanya tampil pada layar HP mobile (< 768px).
 * - Otomatis HILANG pada layar laptop/desktop (>= 768px).
 * - Posisi bottom: 16, right: 16.
 * - Target sentuh minimal 56dp (memenuhi target >= 48dp).
 */
export const FAB: React.FC<FABProps> = ({
  onPress,
  iconName = "add",
  accessibilityLabel = "Tambah Data",
  style,
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Larangan Bagian 8: Dilarang menampilkan FAB di layar >= 768px
  if (isDesktop) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        shadows.medium,
        pressed && styles.pressed,
        style,
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name={iconName} size={28} color={colors.neutral.white} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary[700],
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.94 }],
  },
});
