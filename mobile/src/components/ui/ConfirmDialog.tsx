import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, spacing } from "../../theme";
import { ModernButton } from "./ModernButton";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger" | "warning";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  variant = "primary",
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!visible) return null;

  const getIcon = () => {
    switch (variant) {
      case "danger":
        return { name: "alert-circle" as const, color: colors.status.conflict, bg: colors.status.conflictBg };
      case "warning":
        return { name: "warning" as const, color: colors.status.pending, bg: colors.status.pendingBg };
      default:
        return { name: "help-circle" as const, color: colors.primary[700], bg: colors.primary[50] };
    }
  };

  const iconInfo = getIcon();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dialogCard, shadows.overlay]}>
              <View style={[styles.iconWrap, { backgroundColor: iconInfo.bg }]}>
                <Ionicons name={iconInfo.name} size={28} color={iconInfo.color} />
              </View>

              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={cancelLabel}
                  disabled={loading}
                  onPress={onCancel}
                  style={({ pressed }) => [
                    styles.cancelBtn,
                    pressed && styles.pressed,
                    loading && styles.disabled,
                  ]}
                >
                  <Text style={styles.cancelText}>{cancelLabel}</Text>
                </Pressable>

                <View style={styles.confirmBtnWrap}>
                  <ModernButton
                    title={confirmLabel}
                    variant={variant === "danger" ? "danger" : "primary"}
                    loading={loading}
                    onPress={onConfirm}
                    size="md"
                  />
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.card,
    padding: 20,
    alignItems: "center",
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: colors.neutral.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.neutral.textSmall,
  },
  confirmBtnWrap: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
});
