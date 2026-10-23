import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, radius, radii, shadows, spacing } from "../../theme";
import { db } from "../../db/client";
import { berita, pengumuman, pengaturan, type Berita, type Pengumuman } from "../../db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import { Ionicons } from "@expo/vector-icons";
import { ModernButton } from "../../components/ui/ModernButton";
import { Badge } from "../../components/ui/Badge";
import { useSync } from "../../context/SyncContext";
import { useAlert } from "../../context/AlertContext";
import { AppShell } from "../../components/layout/AppShell";
import { useDoubleBackToExit } from "../../hooks";

export default function LandingScreen() {
  useDoubleBackToExit();

  const [newsList, setNewsList] = useState<Berita[]>([]);
  const [announcements, setAnnouncements] = useState<Pengumuman[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Read Modal States
  const [selectedNews, setSelectedNews] = useState<Berita | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Pengumuman | null>(null);

  const { triggerPullAsync, isSyncing } = useSync();
  const { showAlert } = useAlert();

  useEffect(() => {
    loadPublicData();
  }, []);

  const loadPublicData = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      // 1. Berita: Hanya yang berstatus 'terbit' dan tidak dihapus
      const bList = await db
        .select()
        .from(berita)
        .where(and(eq(berita.status, "terbit"), isNull(berita.deleted_at)))
        .orderBy(desc(berita.published_at), desc(berita.created_at))
        .limit(6);

      // 2. Pengumuman: Hanya yang berstatus 'aktif', tidak dihapus, dan berada dalam rentang tanggal tayang
      const allActiveAnnouncements = await db
        .select()
        .from(pengumuman)
        .where(and(eq(pengumuman.status, "aktif"), isNull(pengumuman.deleted_at)))
        .orderBy(desc(pengumuman.created_at));

      // Filter tanggal tayang aktif
      const filteredAnnouncements = allActiveAnnouncements.filter((a) => {
        if (a.tanggal_mulai && a.tanggal_mulai > todayStr) return false;
        if (a.tanggal_selesai && a.tanggal_selesai < todayStr) return false;
        return true;
      });

      // 3. Pengaturan Identitas Madrasah
      const settings = await db.select().from(pengaturan);
      const map: Record<string, string> = {};
      settings.forEach((s) => {
        map[s.key] = s.value;
      });

      setNewsList(bList);
      setAnnouncements(filteredAnnouncements);
      setSchoolInfo(map);
    } catch (e) {
      console.warn("Gagal membaca data publik:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (isSyncing) return;
    const res = await triggerPullAsync();
    showAlert({
      title: res.success ? "Tarik Data Berhasil" : "Koneksi Server",
      message: res.message,
      type: res.success ? "success" : "error",
      buttons: [{ text: "Mengerti", style: "default" }],
    });
    loadPublicData();
  };

  return (
    <AppShell noHeader>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* TOP BAR BRAND */}
        <View style={styles.navBar}>
          <View style={styles.brandGroup}>
            <View style={styles.brandIcon}>
              <Ionicons name="school" size={24} color={colors.primary[700]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandName} numberOfLines={1}>MTs Roudhotut Thowalib</Text>
              <Text style={styles.brandSub} numberOfLines={1}>
                NSM: {schoolInfo["nsm"] || "121235170045"} • NPSN: {schoolInfo["npsn"] || "20582415"}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleSync}
            disabled={isSyncing}
            style={({ pressed }) => [
              styles.syncBtnTop,
              pressed && styles.pressedState,
              isSyncing && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Tarik Pembaruan Data"
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={colors.primary[700]} />
            ) : (
              <Ionicons name="sync-outline" size={16} color={colors.primary[700]} />
            )}
            <Text style={styles.syncBtnTopText}>{isSyncing ? "Sync..." : "Sync"}</Text>
          </Pressable>
        </View>

        {/* HERO SECTION */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <Badge label="MADRASAH UNGGUL" variant="gold" />
            <Badge label="AKREDITASI A" variant="primary" />
          </View>
          <Text style={styles.heroTitle}>
            Pendidikan Qur'ani & Sains Berkarakter Ahlussunnah wal Jama'ah
          </Text>
          <Text style={styles.heroSubtitle}>
            Sistem Informasi & Database Akademik Terpadu berbasis *Local-First*. Bekerja 100% offline
            secara mandiri, siap disinkronkan saat terhubung ke jaringan madrasah.
          </Text>
        </View>

        {/* PENGUMUMAN PENTING (DITAMPILKAN JIKA BERADA DALAM RENTANG TANGGAL AKTIF) */}
        {announcements.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="megaphone-outline" size={20} color={colors.accent.gold} />
                <Text style={styles.sectionTitle}>Pengumuman Terkini</Text>
              </View>
            </View>

            {announcements.map((a) => (
              <Pressable
                key={a.id}
                style={({ pressed }) => [styles.announcementCard, pressed && styles.pressedState]}
                onPress={() => setSelectedAnnouncement(a)}
                accessibilityRole="button"
                accessibilityLabel={`Pengumuman: ${a.judul}`}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={styles.announcementTitle}>{a.judul}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.accent.gold} />
                </View>
                <Text style={styles.announcementBody} numberOfLines={2}>
                  {a.isi}
                </Text>
                <View style={styles.announcementDateRow}>
                  <Ionicons name="calendar-outline" size={13} color={colors.neutral.textMuted} />
                  <Text style={styles.announcementDate}>
                    Aktif: {a.tanggal_mulai} s/d {a.tanggal_selesai}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* BERITA MADRASAH (HANYA STATUS 'TERBIT') */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="newspaper-outline" size={20} color={colors.primary[700]} />
              <Text style={styles.sectionTitle}>Kabar & Berita Madrasah</Text>
            </View>
          </View>

          {newsList.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.newsCard, pressed && styles.pressedState]}
              onPress={() => setSelectedNews(item)}
              accessibilityRole="button"
              accessibilityLabel={`Berita: ${item.judul}`}
            >
              {item.thumbnail_local_path || item.thumbnail_remote_url ? (
                <Image
                  source={{ uri: item.thumbnail_local_path || item.thumbnail_remote_url || "" }}
                  style={styles.newsThumb}
                />
              ) : null}

              <Text style={styles.newsTitle}>{item.judul}</Text>
              <Text style={styles.newsSnippet} numberOfLines={2}>
                {item.ringkasan || item.isi}
              </Text>

              <View style={styles.newsMeta}>
                <Text style={styles.newsDate}>
                  {item.published_at || item.created_at.slice(0, 10)}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={styles.readMoreText}>Baca Selengkapnya</Text>
                  <Ionicons name="arrow-forward" size={13} color={colors.primary[700]} />
                </View>
              </View>
            </Pressable>
          ))}

          {newsList.length === 0 && (
            <View style={styles.emptyNoticeBox}>
              <Text style={styles.emptyNoticeText}>Belum ada artikel berita yang dipublikasikan.</Text>
            </View>
          )}
        </View>

        {/* VISI & MISI */}
        <View style={styles.visionCard}>
          <Text style={styles.visionHeading}>Visi Madrasah</Text>
          <Text style={styles.visionText}>
            "{schoolInfo["visi"] || "Generasi Qur'ani dan Berprestasi"}"
          </Text>
          <View style={styles.divider} />
          <Text style={styles.visionHeading}>Misi Utama</Text>
          <Text style={styles.misiText}>{schoolInfo["misi"]}</Text>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>MTs Roudhotut Thowalib</Text>
          <Text style={styles.footerText}>{schoolInfo["alamat"]}</Text>
          <Text style={styles.footerText}>
            Telp: {schoolInfo["telepon"]} • Email: {schoolInfo["email"]}
          </Text>
          <Text style={styles.footerCopy}>© 2026 MTs RTH — Local-First React Native Edition</Text>
        </View>
      </ScrollView>

      {/* ================= MODAL DETAIL BERITA ================= */}
      <Modal
        visible={Boolean(selectedNews)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedNews(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Badge label="KABAR MADRASAH" variant="primary" size="sm" />
                <Text style={styles.modalDate}>
                  Diterbitkan: {selectedNews?.published_at || selectedNews?.created_at.slice(0, 10)}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedNews(null)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedOpacity]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedNews?.thumbnail_local_path || selectedNews?.thumbnail_remote_url ? (
                <Image
                  source={{
                    uri:
                      selectedNews.thumbnail_local_path ||
                      selectedNews.thumbnail_remote_url ||
                      "",
                  }}
                  style={styles.detailThumb}
                />
              ) : null}

              <Text style={styles.detailArticleTitle}>{selectedNews?.judul}</Text>

              {selectedNews?.ringkasan ? (
                <View style={styles.leadBox}>
                  <Text style={styles.leadText}>{selectedNews.ringkasan}</Text>
                </View>
              ) : null}

              <Text style={styles.detailArticleBody}>{selectedNews?.isi}</Text>
            </ScrollView>

            <View style={{ marginTop: spacing.md }}>
              <ModernButton
                title="Tutup"
                variant="outline"
                size="md"
                onPress={() => setSelectedNews(null)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL DETAIL PENGUMUMAN ================= */}
      <Modal
        visible={Boolean(selectedAnnouncement)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAnnouncement(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Badge label="PENGUMUMAN RESMI" variant="gold" size="sm" />
                <Text style={styles.modalDate}>
                  Aktif: {selectedAnnouncement?.tanggal_mulai} s/d {selectedAnnouncement?.tanggal_selesai}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedAnnouncement(null)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedOpacity]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.detailArticleTitle}>{selectedAnnouncement?.judul}</Text>
              <Text style={styles.detailArticleBody}>{selectedAnnouncement?.isi}</Text>
            </ScrollView>

            <View style={{ marginTop: spacing.md }}>
              <ModernButton
                title="Tutup"
                variant="outline"
                size="md"
                onPress={() => setSelectedAnnouncement(null)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral.canvas,
  },
  scroll: {
    flex: 1,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.border,
  },
  brandGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginRight: spacing.sm,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
  },
  brandSub: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    fontWeight: "500",
  },
  syncBtnTop: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    gap: 6,
  },
  syncBtnTopText: {
    color: colors.primary[700],
    fontWeight: "700",
    fontSize: 12,
  },
  heroCard: {
    margin: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    ...shadows.soft,
  },
  heroBadgeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary[900],
    lineHeight: 30,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.neutral.textSecondary,
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
  },
  announcementCard: {
    backgroundColor: colors.accent.goldLight,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent.goldBorder,
    marginBottom: spacing.sm,
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.accent.gold,
    flex: 1,
  },
  announcementBody: {
    fontSize: 13,
    color: colors.neutral.textPrimary,
    lineHeight: 18,
    marginBottom: 6,
  },
  announcementDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  announcementDate: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    fontWeight: "600",
  },
  newsCard: {
    backgroundColor: colors.neutral.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  newsThumb: {
    width: "100%",
    height: 140,
    borderRadius: radius.md,
    borderCurve: "continuous",
    marginBottom: spacing.sm,
  },
  newsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
    marginBottom: 6,
  },
  newsSnippet: {
    fontSize: 13,
    color: colors.neutral.textSecondary,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  newsMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.borderSubtle,
    paddingTop: spacing.sm,
  },
  newsDate: {
    fontSize: 11,
    color: colors.neutral.textMuted,
  },
  readMoreText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary[700],
  },
  emptyNoticeBox: {
    padding: spacing.lg,
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  emptyNoticeText: {
    fontSize: 12,
    color: colors.neutral.textMuted,
  },
  visionCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
  },
  visionHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary[800],
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  visionText: {
    fontSize: 14,
    fontStyle: "italic",
    color: colors.primary[900],
    fontWeight: "600",
    lineHeight: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.primary[200],
    marginVertical: 14,
  },
  misiText: {
    fontSize: 13,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
  },
  footer: {
    padding: spacing.xl,
    backgroundColor: colors.neutral.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
    alignItems: "center",
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
    marginBottom: 4,
  },
  footerText: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    marginBottom: 2,
    textAlign: "center",
  },
  footerCopy: {
    fontSize: 11,
    color: colors.neutral.textSubtle,
    marginTop: spacing.md,
  },
  // Modal Common
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    borderCurve: "continuous",
    padding: spacing.lg,
    maxHeight: "85%",
    ...shadows.medium,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.border,
    paddingBottom: spacing.sm,
  },
  modalDate: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 4,
  },
  closeBtn: {
    padding: 4,
    borderRadius: radius.full,
  },
  detailThumb: {
    width: "100%",
    height: 180,
    borderRadius: radius.md,
    borderCurve: "continuous",
    marginBottom: spacing.md,
  },
  detailArticleTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  leadBox: {
    backgroundColor: colors.neutral.canvas,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[700],
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderCurve: "continuous",
    marginBottom: spacing.md,
  },
  leadText: {
    fontSize: 13,
    color: colors.neutral.textSecondary,
    fontStyle: "italic",
    lineHeight: 19,
  },
  detailArticleBody: {
    fontSize: 14,
    color: colors.neutral.textPrimary,
    lineHeight: 22,
  },
  pressedState: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  pressedOpacity: {
    opacity: 0.6,
  },
});
