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

interface EmptyStateProps {
  type?: "empty" | "search_empty";
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  canPerformAction?: boolean; // Hanya jika peran berhak
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = "empty",
  title,
  message,
  actionLabel,
  onAction,
  canPerformAction = true,
  icon,
  style,
}) => {
  const isSearch = type === "search_empty";

  const defaultIcon: keyof typeof Ionicons.glyphMap = isSearch
    ? "search-outline"
    : "file-tray-outline";

  const defaultTitle = isSearch
    ? "Pencarian Tidak Ditemukan"
    : "Belum Ada Data";

  const defaultMessage = isSearch
    ? "Coba periksa kembali kata kunci atau atur ulang filter pencarian Anda."
    : "Data belum tersedia dalam sistem madrasah.";

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconBox}>
        <Ionicons
          name={icon || defaultIcon}
          size={36}
          color={colors.primary[700]}
        />
      </View>

      <Text style={styles.title}>{title || defaultTitle}</Text>
      <Text style={styles.message}>{message || defaultMessage}</Text>

      {actionLabel && onAction && canPerformAction && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [
            styles.actionBtn,
            shadows.soft,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add" size={18} color={colors.neutral.white} />
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
    textAlign: "center",
    marginBottom: 6,
  },
  message: {
    fontSize: 13,
    color: colors.neutral.textSmall,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: 20,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary[700],
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.button,
    minHeight: 44,
  },
  actionBtnText: {
    color: colors.neutral.white,
    fontSize: 14,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.8,
  },
});
