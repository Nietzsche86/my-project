import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  useWindowDimensions,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows } from "../../theme";

interface HeaderAddButtonProps {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Tombol "+ Tambah ..." di header konten untuk layar lebar (>= 768px).
 * Otomatis tersembunyi pada layar mobile (< 768px), di mana FAB digunakan sebagai gantinya.
 */
export const HeaderAddButton: React.FC<HeaderAddButtonProps> = ({
  label,
  onPress,
  style,
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  if (!isDesktop) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        shadows.soft,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name="add" size={18} color={colors.neutral.white} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[700],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.button,
    minHeight: 40,
    gap: 6,
  },
  text: {
    color: colors.neutral.white,
    fontSize: 13,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
