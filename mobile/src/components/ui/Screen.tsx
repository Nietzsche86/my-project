import React from "react";
import {
  View,
  StyleSheet,
  useWindowDimensions,
  ViewStyle,
  StyleProp,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";
import { colors } from "../../theme";

interface ScreenProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  keyboardAvoiding?: boolean;
  keyboardOffset?: number;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  style,
  contentStyle,
  edges = ["top"],
  keyboardAvoiding = false,
  keyboardOffset = Platform.OS === "ios" ? 64 : 0,
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const content = (
    <View
      style={[
        styles.content,
        isDesktop && styles.desktopContent,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.container, style]}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={keyboardOffset}
          style={styles.keyboardView}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.canvas,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: "100%",
  },
  desktopContent: {
    maxWidth: 896, // max-w-4xl
    alignSelf: "center",
  },
});
