import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, spacing } from "../../theme";
import { useSync } from "../../context/SyncContext";
import { ConfirmDialog } from "./ConfirmDialog";

interface SyncCardProps {
  onSuccessMessage?: (msg: string) => void;
  onErrorMessage?: (msg: string) => void;
  // Memungkinkan override state untuk pengujian di /dev/components
  forcedState?: "idle" | "syncing" | "error" | "offline" | "conflict";
  forcedPending?: number;
}

export const SyncCard: React.FC<SyncCardProps> = ({
  onSuccessMessage,
  onErrorMessage,
  forcedState,
  forcedPending,
}) => {
  const syncContext = useSync();

  const isSyncing = forcedState === "syncing" || (!forcedState && syncContext.isSyncing);
  const isOffline = forcedState === "offline" || (!forcedState && syncContext.isOffline);
  const hasConflict = forcedState === "conflict" || (!forcedState && syncContext.conflictCount > 0);
  const hasError = forcedState === "error" || (!forcedState && !!syncContext.lastSyncError);
  const pendingCount = forcedPending !== undefined ? forcedPending : syncContext.pendingCount;

  const [confirmUploadVisible, setConfirmUploadVisible] = useState(false);
  const [pullLoading, setPullLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp || timestamp.startsWith("1970")) return "Belum pernah sinkron";
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return "Belum pernah sinkron";
      return `Terakhir: ${d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      })} ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return `Terakhir: ${timestamp}`;
    }
  };

  const handlePull = async () => {
    if (isOffline || isSyncing) return;
    setPullLoading(true);
    setLocalFeedback(null);
    const res = await syncContext.triggerPullAsync();
    setPullLoading(false);
    if (res.success) {
      setLocalFeedback("Data berhasil ditarik dari server.");
      onSuccessMessage?.(res.message);
    } else {
      setLocalFeedback(res.message);
      onErrorMessage?.(res.message);
    }
  };

  const handlePushConfirm = async () => {
    setConfirmUploadVisible(false);
    setPushLoading(true);
    setLocalFeedback(null);
    const res = await syncContext.triggerPushAsync();
    setPushLoading(false);
    if (res.success) {
      setLocalFeedback("Data perubahan berhasil diunggah.");
      onSuccessMessage?.(res.message);
    } else {
      setLocalFeedback(res.message);
      onErrorMessage?.(res.message);
    }
  };

  const isButtonsDisabled = isOffline || isSyncing || pullLoading || pushLoading;

  // Feedback banner state text
  let statusBannerText: string | null = null;
  let statusBannerType: "warning" | "danger" | "info" = "info";

  if (hasConflict) {
    statusBannerText = "Ada konflik data dengan server yang perlu ditinjau.";
    statusBannerType = "danger";
  } else if (isOffline) {
    statusBannerText = "Perangkat sedang offline. Butuh koneksi internet untuk sinkronisasi.";
    statusBannerType = "warning";
  } else if (hasError && syncContext.lastSyncError) {
    statusBannerText = syncContext.lastSyncError;
    statusBannerType = "danger";
  } else if (localFeedback) {
    statusBannerText = localFeedback;
    statusBannerType = "info";
  }

  return (
    <View style={[styles.card, shadows.soft]}>
      {/* Header Bar */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View style={styles.iconBadge}>
            <Ionicons
              name={hasConflict ? "alert-circle" : isOffline ? "cloud-offline" : "sync"}
              size={18}
              color={hasConflict ? colors.status.conflict : colors.primary[700]}
            />
          </View>
          <View>
            <Text style={styles.cardTitle}>Status Sinkronisasi</Text>
            <Text style={styles.lastSyncText}>
              {formatLastSync(syncContext.lastSyncedAt)}
            </Text>
          </View>
        </View>

        {/* Pending Badge */}
        <View
          style={[
            styles.pendingBadge,
            pendingCount > 0 ? styles.pendingBadgeActive : styles.pendingBadgeNeutral,
          ]}
        >
          <Text
            style={[
              styles.pendingBadgeText,
              pendingCount > 0 && styles.pendingBadgeTextActive,
            ]}
          >
            {pendingCount} belum diunggah
          </Text>
        </View>
      </View>

      {/* Status Warning / Error Banner if needed */}
      {statusBannerText && (
        <View
          style={[
            styles.banner,
            statusBannerType === "danger"
              ? styles.bannerDanger
              : statusBannerType === "warning"
              ? styles.bannerWarning
              : styles.bannerInfo,
          ]}
        >
          <Ionicons
            name={
              statusBannerType === "danger"
                ? "alert-circle"
                : statusBannerType === "warning"
                ? "warning"
                : "information-circle"
            }
            size={16}
            color={
              statusBannerType === "danger"
                ? colors.status.conflict
                : statusBannerType === "warning"
                ? colors.status.pending
                : colors.primary[700]
            }
          />
          <Text
            style={[
              styles.bannerText,
              statusBannerType === "danger"
                ? styles.bannerTextDanger
                : statusBannerType === "warning"
                ? styles.bannerTextWarning
                : styles.bannerTextInfo,
            ]}
          >
            {statusBannerText}
          </Text>
        </View>
      )}

      {/* Action Buttons: Tarik Data & Upload Data */}
      <View style={styles.actionRow}>
        {/* Tombol Tarik Data */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tarik Data dari Server"
          disabled={isButtonsDisabled}
          onPress={handlePull}
          style={({ pressed }) => [
            styles.button,
            styles.pullButton,
            isButtonsDisabled && styles.btnDisabled,
            pressed && !isButtonsDisabled && styles.pressed,
          ]}
        >
          {pullLoading ? (
            <ActivityIndicator size="small" color={colors.primary[700]} />
          ) : (
            <>
              <Ionicons name="download-outline" size={16} color={colors.primary[700]} />
              <Text style={styles.pullButtonText}>Tarik Data</Text>
            </>
          )}
        </Pressable>

        {/* Tombol Upload Data: hanya menonjol saat pendingCount > 0 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload Perubahan ke Server"
          disabled={isButtonsDisabled || pendingCount === 0}
          onPress={() => setConfirmUploadVisible(true)}
          style={({ pressed }) => [
            styles.button,
            pendingCount > 0 ? styles.pushButtonProminent : styles.pushButtonMuted,
            (isButtonsDisabled || pendingCount === 0) && styles.btnDisabled,
            pressed && !isButtonsDisabled && styles.pressed,
          ]}
        >
          {pushLoading ? (
            <ActivityIndicator
              size="small"
              color={pendingCount > 0 ? colors.neutral.white : colors.neutral.textSmall}
            />
          ) : (
            <>
              <Ionicons
                name="cloud-upload-outline"
                size={16}
                color={pendingCount > 0 ? colors.neutral.white : colors.neutral.textSmall}
              />
              <Text
                style={[
                  styles.pushButtonText,
                  pendingCount > 0 ? styles.pushButtonTextWhite : styles.pushButtonTextMuted,
                ]}
              >
                Upload Data
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Confirmation Dialog for Push */}
      <ConfirmDialog
        visible={confirmUploadVisible}
        title="Konfirmasi Upload Data"
        message={`Unggah ${pendingCount} perubahan ke server? Data di server akan diperbarui dengan data lokal ini.`}
        confirmLabel="Unggah"
        cancelLabel="Batal"
        loading={pushLoading}
        onConfirm={handlePushConfirm}
        onCancel={() => setConfirmUploadVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: spacing.cardGap,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  lastSyncText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.neutral.textSmall,
    marginTop: 2,
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pendingBadgeNeutral: {
    backgroundColor: colors.neutral.surfaceHover,
  },
  pendingBadgeActive: {
    backgroundColor: colors.status.pendingBg,
    borderWidth: 1,
    borderColor: colors.status.pendingBorder,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.neutral.textSmall,
  },
  pendingBadgeTextActive: {
    color: colors.neutral.textPrimary, // Guideline: Teks di atas warna aksen memakai #1F2937
    fontWeight: "600",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    marginBottom: 12,
  },
  bannerWarning: {
    backgroundColor: colors.status.pendingBg,
    borderWidth: 1,
    borderColor: colors.status.pendingBorder,
  },
  bannerDanger: {
    backgroundColor: colors.status.conflictBg,
    borderWidth: 1,
    borderColor: colors.status.conflictBorder,
  },
  bannerInfo: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  bannerTextWarning: {
    color: colors.neutral.textPrimary,
  },
  bannerTextDanger: {
    color: colors.status.conflict,
  },
  bannerTextInfo: {
    color: colors.primary[800],
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.button,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  pullButton: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  pullButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary[800],
  },
  pushButtonProminent: {
    backgroundColor: colors.primary[700],
  },
  pushButtonMuted: {
    backgroundColor: colors.neutral.canvas,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  pushButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pushButtonTextWhite: {
    color: colors.neutral.white,
  },
  pushButtonTextMuted: {
    color: colors.neutral.textSmall,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.75,
  },
});
