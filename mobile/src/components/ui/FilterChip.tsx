import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  ScrollView,
} from "react-native";
import { colors, radius, spacing } from "../../theme";

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  count?: number;
  style?: StyleProp<ViewStyle>;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  selected,
  onPress,
  count,
  style,
}) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}${count !== undefined ? ` (${count})` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipUnselected,
        pressed && styles.pressed,
        style,
      ]}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <Text
        style={[
          styles.text,
          selected ? styles.textSelected : styles.textUnselected,
        ]}
      >
        {label}
        {count !== undefined ? ` (${count})` : ""}
      </Text>
    </Pressable>
  );
};

export const FilterChipGroup: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.groupContainer, style]}
    >
      {children}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  groupContainer: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: colors.primary[700],
    borderColor: colors.primary[700],
  },
  chipUnselected: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.border,
  },
  text: {
    fontSize: 13,
    fontWeight: "500",
  },
  textSelected: {
    color: colors.neutral.white,
    fontWeight: "600",
  },
  textUnselected: {
    color: colors.neutral.textSmall,
  },
  pressed: {
    opacity: 0.8,
  },
});
