import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  ViewStyle,
  StyleProp,
  Keyboard,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadows, spacing } from "../../theme";

interface StickyFooterButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondaryTitle?: string;
  onSecondaryPress?: () => void;
  variant?: "primary" | "danger";
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const StickyFooterButton: React.FC<StickyFooterButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  secondaryTitle,
  onSecondaryPress,
  variant = "primary",
  icon,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Saat keyboard muncul di HP, padding bawah cukup 12 agar tidak terbuang tinggi dan tombol langsung pas di atas keyboard
  const bottomPadding = isKeyboardVisible ? 12 : Math.max(insets.bottom, 0) + 12;
  const isInteractive = !disabled && !loading;

  return (
    <View style={[styles.outerContainer, shadows.raised]}>
      <View
        style={[
          styles.innerContainer,
          { paddingBottom: bottomPadding },
          isDesktop && styles.desktopContainer,
          style,
        ]}
      >
        {secondaryTitle && onSecondaryPress && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={secondaryTitle}
            disabled={!isInteractive}
            onPress={onSecondaryPress}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.pressed,
              !isInteractive && styles.btnDisabled,
            ]}
          >
            <Text style={styles.secondaryText}>{secondaryTitle}</Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{
            disabled: !isInteractive,
            busy: loading,
          }}
          disabled={!isInteractive}
          onPress={onPress}
          style={({ pressed }) => [
            styles.primaryBtn,
            variant === "danger" ? styles.dangerBtn : styles.brandBtn,
            !isInteractive && styles.btnDisabled,
            pressed && isInteractive && styles.pressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.neutral.white} size="small" />
          ) : (
            <View style={styles.btnContent}>
              {icon && <View style={styles.iconWrap}>{icon}</View>}
              <Text style={styles.primaryText}>{title}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: colors.neutral.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
    width: "100%",
  },
  innerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    width: "100%",
  },
  desktopContainer: {
    maxWidth: 896, // max-w-4xl
    alignSelf: "center",
  },
  primaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
  brandBtn: {
    backgroundColor: colors.primary[700],
  },
  dangerBtn: {
    backgroundColor: colors.status.conflict,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: colors.neutral.white,
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryText: {
    color: colors.neutral.textSmall,
    fontSize: 15,
    fontWeight: "600",
  },
  btnDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
});
