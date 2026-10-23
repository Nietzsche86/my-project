import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from "react-native";
import { colors, radius, shadows, spacing } from "../../theme";

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
  style,
}) => {
  return (
    <View style={[styles.container, shadows.soft, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    padding: 16,
    marginBottom: spacing.cardGap,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  description: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.neutral.textSmall,
    marginTop: 2,
    lineHeight: 16,
  },
  content: {
    gap: 12,
  },
});
