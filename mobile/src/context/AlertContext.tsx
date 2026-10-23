import React, { createContext, useContext, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, radii, shadows, spacing } from "../theme";

export type AlertType = "success" | "error" | "warning" | "info" | "confirm";

export interface AlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

export interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  buttons?: AlertButton[];
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType>({
  showAlert: () => {},
  hideAlert: () => {},
});

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertOptions>({
    title: "",
    message: "",
    type: "info",
    buttons: [{ text: "OK" }],
  });

  const showAlert = useCallback((options: AlertOptions) => {
    setConfig({
      title: options.title,
      message: options.message,
      type: options.type || "info",
      buttons: options.buttons && options.buttons.length > 0 ? options.buttons : [{ text: "Mengerti" }],
    });
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  const handleButtonPress = (btn: AlertButton) => {
    hideAlert();
    if (btn.onPress) {
      // Tunggu modal tertutup agar transisi mulus
      setTimeout(() => {
        btn.onPress?.();
      }, 100);
    }
  };

  const getTypeAttributes = () => {
    switch (config.type) {
      case "success":
        return {
          icon: "checkmark-circle" as const,
          iconColor: colors.primary[700],
          bgLight: colors.primary[50],
          borderColor: colors.primary[200],
          pillText: "BERHASIL",
        };
      case "error":
        return {
          icon: "alert-circle" as const,
          iconColor: colors.status.cancelled,
          bgLight: colors.status.cancelledBg,
          borderColor: colors.status.conflictBorder,
          pillText: "PERHATIAN",
        };
      case "warning":
        return {
          icon: "warning" as const,
          iconColor: colors.accent.gold,
          bgLight: colors.accent.goldLight,
          borderColor: colors.accent.goldBorder,
          pillText: "PERINGATAN",
        };
      case "confirm":
        return {
          icon: "help-circle" as const,
          iconColor: colors.accent.indigo,
          bgLight: colors.accent.indigoLight,
          borderColor: "#C7D2FE",
          pillText: "KONFIRMASI",
        };
      case "info":
      default:
        return {
          icon: "information-circle" as const,
          iconColor: colors.primary[700],
          bgLight: colors.primary[50],
          borderColor: colors.primary[200],
          pillText: "INFORMASI",
        };
    }
  };

  const typeAttr = getTypeAttributes();

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={hideAlert}
      >
        <Pressable style={styles.overlay} onPress={hideAlert}>
          <Pressable style={styles.dialogContainer} onPress={(e) => e.stopPropagation()}>
            {/* Header Badge & Icon */}
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: typeAttr.bgLight,
                    borderColor: typeAttr.borderColor,
                  },
                ]}
              >
                <Ionicons name={typeAttr.icon} size={26} color={typeAttr.iconColor} />
              </View>

              <View style={[styles.typePill, { backgroundColor: typeAttr.bgLight, borderColor: typeAttr.borderColor }]}>
                <Text style={[styles.typePillText, { color: typeAttr.iconColor }]}>
                  {typeAttr.pillText}
                </Text>
              </View>
            </View>

            {/* Title & Body Message */}
            <View style={styles.body}>
              <Text style={styles.title}>{config.title}</Text>
              <Text style={styles.message}>{config.message}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.btnRow}>
              {config.buttons?.map((btn, idx) => {
                const isCancel = btn.style === "cancel";
                const isDestructive = btn.style === "destructive";

                let btnBg = colors.primary[700];
                let btnTextColor = colors.neutral.white;
                let btnBorder = colors.primary[700];

                if (isCancel) {
                  btnBg = colors.neutral.canvas;
                  btnTextColor = colors.neutral.textSecondary;
                  btnBorder = colors.neutral.border;
                } else if (isDestructive) {
                  btnBg = colors.status.cancelled;
                  btnTextColor = colors.neutral.white;
                  btnBorder = colors.status.cancelled;
                }

                return (
                  <Pressable
                    key={idx}
                    accessibilityRole="button"
                    accessibilityLabel={btn.text}
                    onPress={() => handleButtonPress(btn)}
                    style={({ pressed }) => [
                      styles.btn,
                      {
                        backgroundColor: btnBg,
                        borderColor: btnBorder,
                      },
                      pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] },
                    ]}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        { color: btnTextColor },
                        isCancel && styles.btnTextCancel,
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AlertContext.Provider>
  );
};

export const useAlert = () => useContext(AlertContext);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialogContainer: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.neutral.white,
    borderRadius: radius.xl,
    borderCurve: "continuous",
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    ...shadows.medium,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  body: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
    marginBottom: 8,
    lineHeight: 24,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.neutral.textSecondary,
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  btnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  btnTextCancel: {
    fontWeight: "600",
  },
});
