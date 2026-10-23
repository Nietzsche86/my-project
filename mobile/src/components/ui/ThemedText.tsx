import React from "react";
import { Text, TextProps, StyleSheet } from "react-native";
import { type, TypographyVariant } from "../../theme/typography";

export interface ThemedTextProps extends TextProps {
  variant?: TypographyVariant;
}

/**
 * Standard ThemedText component
 * Replaces hardcoded fontSize in favor of design system typography tokens.
 */
export const ThemedText: React.FC<ThemedTextProps> = ({
  variant = "body",
  style,
  children,
  ...props
}) => {
  return (
    <Text style={[type[variant], style]} {...props}>
      {children}
    </Text>
  );
};
