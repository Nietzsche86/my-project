import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ViewStyle,
  StyleProp,
} from "react-native";
import { colors, radius, shadows } from "../../theme";

export interface TabOption {
  key: string;
  label: string;
  badge?: number | string;
}

interface SegmentedTabsProps {
  tabs: TabOption[];
  activeKey: string;
  onChange: (key: string) => void;
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const SegmentedTabs: React.FC<SegmentedTabsProps> = ({
  tabs,
  activeKey,
  onChange,
  scrollable = false,
  style,
}) => {
  const content = (
    <View style={[styles.container, !scrollable && styles.containerFill, style]}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              !scrollable && styles.tabFill,
              isActive && styles.tabActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.badge !== undefined && (
              <View
                style={[
                  styles.badge,
                  isActive ? styles.badgeActive : styles.badgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isActive ? styles.badgeTextActive : styles.badgeTextInactive,
                  ]}
                >
                  {tab.badge}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollWrapper}
      >
        {content}
      </ScrollView>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.neutral.surfaceHover,
    borderRadius: radius.pill,
    padding: 3,
    alignItems: "center",
  },
  containerFill: {
    width: "100%",
  },
  scrollWrapper: {
    paddingVertical: 2,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    minHeight: 38,
    gap: 6,
  },
  tabFill: {
    flex: 1,
  },
  tabActive: {
    backgroundColor: colors.neutral.surface,
    ...shadows.soft,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.neutral.textSmall,
  },
  tabTextActive: {
    color: colors.primary[700],
    fontWeight: "700",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeActive: {
    backgroundColor: colors.primary[100],
  },
  badgeInactive: {
    backgroundColor: colors.neutral.border,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  badgeTextActive: {
    color: colors.primary[800],
  },
  badgeTextInactive: {
    color: colors.neutral.textSmall,
  },
  pressed: {
    opacity: 0.8,
  },
});
