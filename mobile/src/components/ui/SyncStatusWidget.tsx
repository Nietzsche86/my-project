import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { colors, radius, shadows, spacing } from "../../theme";
import { useSync } from "../../context/SyncContext";
import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../context/AlertContext";
import { Ionicons } from "@expo/vector-icons";

export const SyncStatusWidget: React.FC = () => {
  const { pendingCount, lastSyncedAt, isSyncing, triggerPullAsync, triggerPushAsync } = useSync();
  const { role } = useAuth();
  const { showAlert } = useAlert();

  const isSynced = pendingCount === 0;

  const formatLastSync = (iso: string | null) => {
    if (!iso || iso.startsWith("1970")) return "Belum pernah";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "Belum pernah";
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "-";
    }
  };

  const handlePull = async () => {
    const res = await triggerPullAsync();
    showAlert({
      title: res.success ? "Tarik Data Berhasil" : "Koneksi Server",
      message: res.message,
      type: res.success ? "success" : "error",
      buttons: [{ text: "Mengerti", style: "default" }],
    });
  };

  const handlePush = async () => {
    const res = await triggerPushAsync();
    showAlert({
      title: res.success ? "Upload Data Berhasil" : "Gagal Upload Data",
      message: res.message,
      type: res.success ? "success" : "error",
      buttons: [{ text: "Mengerti", style: "default" }],
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.infoCol}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.dot,
              { backgroundColor: isSynced ? colors.status.synced : colors.status.pending },
            ]}
          />
          <Text style={styles.statusText}>
            {isSynced ? "Database Sinkron" : `${pendingCount} Mutasi Lokal (Pending)`}
          </Text>
        </View>
        <Text style={styles.timeText}>Terakhir: {formatLastSync(lastSyncedAt)}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tarik Data Terbaru"
          onPress={handlePull}
          disabled={isSyncing}
          hitSlop={8}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPull,
            pressed && styles.btnPressed,
          ]}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.primary[700]} />
          ) : (
            <>
              <Ionicons name="cloud-download-outline" size={16} color={colors.primary[700]} />
              <Text style={styles.btnPullText}>Tarik</Text>
            </>
          )}
        </Pressable>

        {role !== "guest" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={role === "guru" ? "Upload Profil" : "Upload Data"}
            onPress={handlePush}
            disabled={isSyncing || isSynced}
            hitSlop={8}
            style={({ pressed }) => [
              styles.btn,
              styles.btnPush,
              isSynced && styles.btnDisabled,
              pressed && !isSynced && styles.btnPressed,
            ]}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={colors.neutral.white} />
            <Text style={styles.btnPushText}>
              {role === "guru" ? "Upload Profil" : "Upload"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadows.soft,
    marginVertical: spacing.sm,
  },
  infoCol: {
    flex: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  timeText: {
    fontSize: 11,
    color: colors.neutral.textMuted,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.md,
    borderCurve: "continuous",
    gap: 4,
    minHeight: 36,
  },
  btnPull: {
    backgroundColor: colors.primary[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
  },
  btnPullText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary[700],
  },
  btnPush: {
    backgroundColor: colors.primary[700],
  },
  btnPushText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.neutral.white,
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
