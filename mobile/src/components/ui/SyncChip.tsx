import React from "react";
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows } from "../../theme";
import { useSync } from "../../context/SyncContext";

interface SyncChipProps {
  onPress?: () => void;
  showLabel?: boolean;
}

export const SyncChip: React.FC<SyncChipProps> = ({ onPress, showLabel = false }) => {
  const { pendingCount, conflictCount, isSyncing, isOffline } = useSync();

  // Status prioritas: conflict > offline > syncing > pending > synced
  let iconName: keyof typeof Ionicons.glyphMap = "cloud-done-outline";
  let iconColor = colors.status.synced;
  let labelText = "Tersinkron";
  let badgeCount = 0;
  let badgeColor = colors.status.synced;

  if (conflictCount > 0) {
    iconName = "alert-circle-outline";
    iconColor = colors.status.conflict;
    labelText = `${conflictCount} Konflik`;
    badgeCount = conflictCount;
    badgeColor = colors.status.conflict;
  } else if (isOffline) {
    iconName = "cloud-offline-outline";
    iconColor = colors.neutral.textMuted;
    labelText = "Offline";
  } else if (isSyncing) {
    iconName = "sync-outline";
    iconColor = colors.primary[700];
    labelText = "Menyinkron...";
  } else if (pendingCount > 0) {
    iconName = "cloud-upload-outline";
    iconColor = colors.status.pending;
    labelText = `${pendingCount} Belum Diunggah`;
    badgeCount = pendingCount;
    badgeColor = colors.status.pending;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Status sinkronisasi: ${labelText}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={styles.iconWrap}>
        {isSyncing ? (
          <ActivityIndicator size="small" color={colors.primary[700]} />
        ) : (
          <Ionicons name={iconName} size={20} color={iconColor} />
        )}
        {badgeCount > 0 && !isSyncing && (
          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Text style={styles.badgeText}>
              {badgeCount > 99 ? "99+" : badgeCount}
            </Text>
          </View>
        )}
      </View>
      {showLabel && <Text style={styles.label}>{labelText}</Text>}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.neutral.white,
    fontSize: 9,
    fontWeight: "700",
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.neutral.textSmall,
  },
});
