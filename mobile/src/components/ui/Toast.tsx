import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import {
  Animated,
  Text,
  StyleSheet,
  View,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows } from "../../theme";

interface ToastOptions {
  type?: "success" | "error" | "info";
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const type = options?.type || "success";
      const duration = options?.duration || 2600;

      setToast({ message, type });

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -20,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setToast(null);
        });
      }, duration);
    },
    [opacity, translateY]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.container,
            {
              top: Math.max(insets.top, 16) + 12,
              opacity,
              transform: [{ translateY }],
            },
            isDesktop && styles.desktopContainer,
          ]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.toastBox,
              shadows.raised,
              toast.type === "error"
                ? styles.errorBox
                : toast.type === "info"
                ? styles.infoBox
                : styles.successBox,
            ]}
          >
            <Ionicons
              name={
                toast.type === "error"
                  ? "alert-circle"
                  : toast.type === "info"
                  ? "information-circle"
                  : "checkmark-circle"
              }
              size={20}
              color={
                toast.type === "error"
                  ? colors.status.conflict
                  : toast.type === "info"
                  ? colors.primary[700]
                  : colors.status.synced
              }
            />
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 9999,
  },
  desktopContainer: {
    maxWidth: 480,
    left: "50%",
    transform: [{ translateX: -240 }],
  },
  toastBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.neutral.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 48,
  },
  successBox: {
    borderColor: colors.status.syncedBorder,
  },
  errorBox: {
    borderColor: colors.status.conflictBorder,
  },
  infoBox: {
    borderColor: colors.primary[200],
  },
  message: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
});
