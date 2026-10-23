import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  Image,
  FlatList,
  ListRenderItem,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, radii, shadows, spacing } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { useSync } from "../../../context/SyncContext";
import { useAlert } from "../../../context/AlertContext";
import { AppShell } from "../../../components/layout/AppShell";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { Badge } from "../../../components/ui/Badge";
import {
  SearchBar,
  SegmentedTabs,
  FilterChip,
  FilterChipGroup,
  EmptyState,
  FAB,
  useToast,
} from "../../../components/ui";
import { db } from "../../../db/client";
import { berita, pengumuman, type Berita, type Pengumuman } from "../../../db/schema";
import { isNull, and, eq, desc, like, or } from "drizzle-orm";
import { Ionicons } from "@expo/vector-icons";
import { generateUUID, getIsoUtcString } from "../../../db/crypto";

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeContent(text: string): string {
  if (!text) return "";
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/javascript:[^"']*/gi, "");
}

function getTodayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function getFutureIsoDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function CmsScreen() {
  const { role, user } = useAuth();
  const { refreshPendingCountAsync } = useSync();
  const { showAlert } = useAlert();

  const [activeTab, setActiveTab] = useState<"berita" | "pengumuman">("berita");
  const [newsList, setNewsList] = useState<Berita[]>([]);
  const [announcementList, setAnnouncementList] = useState<Pengumuman[]>([]);
  const [search, setSearch] = useState("");
  const [filterNewsStatus, setFilterNewsStatus] = useState<string>("all"); // 'all' | 'terbit' | 'draft'
  const [refreshing, setRefreshing] = useState(false);

  // Modal Berita
  const [modalBeritaVisible, setModalBeritaVisible] = useState(false);
  const [editingBeritaId, setEditingBeritaId] = useState<string | null>(null);
  const [formJudul, setFormJudul] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formRingkasan, setFormRingkasan] = useState("");
  const [formIsi, setFormIsi] = useState("");
  const [formStatus, setFormStatus] = useState<"terbit" | "draft">("terbit");
  const [formThumbnail, setFormThumbnail] = useState<string | null>(null);
  const [savingBerita, setSavingBerita] = useState(false);

  // Modal Pengumuman
  const [modalPengumumanVisible, setModalPengumumanVisible] = useState(false);
  const [editingPengumumanId, setEditingPengumumanId] = useState<string | null>(null);
  const [formPJudul, setFormPJudul] = useState("");
  const [formPIsi, setFormPIsi] = useState("");
  const [formPTglMulai, setFormPTglMulai] = useState(getTodayIsoDate());
  const [formPTglSelesai, setFormPTglSelesai] = useState(getFutureIsoDate(14));
  const [formPStatus, setFormPStatus] = useState<"aktif" | "nonaktif">("aktif");
  const [savingPengumuman, setSavingPengumuman] = useState(false);

  // Guard: Hanya Super Admin & Staf TU
  if (role === "guru" || role === "guest") {
    return (
      <AppShell title="Akses Dibatasi">
        <View style={styles.forbiddenContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.status.conflict} />
          <Text style={styles.forbiddenTitle}>Akses CMS Dibatasi</Text>
          <Text style={styles.forbiddenSub}>
            Manajemen Konten Publik (Berita & Pengumuman) hanya dapat dikelola oleh Super Admin dan
            Staf Tata Usaha.
          </Text>
        </View>
      </AppShell>
    );
  }

  useEffect(() => {
    loadCmsData();
  }, [activeTab, search]);

  const loadCmsData = async () => {
    try {
      const term = search.trim();
      if (activeTab === "berita") {
        let res: Berita[] = [];
        if (term) {
          const pat = `%${term}%`;
          res = await db
            .select()
            .from(berita)
            .where(
              and(
                isNull(berita.deleted_at),
                or(like(berita.judul, pat), like(berita.ringkasan, pat))
              )
            )
            .orderBy(desc(berita.created_at));
        } else {
          res = await db
            .select()
            .from(berita)
            .where(isNull(berita.deleted_at))
            .orderBy(desc(berita.created_at));
        }
        setNewsList(res);
      } else {
        let res: Pengumuman[] = [];
        if (term) {
          const pat = `%${term}%`;
          res = await db
            .select()
            .from(pengumuman)
            .where(
              and(
                isNull(pengumuman.deleted_at),
                or(like(pengumuman.judul, pat), like(pengumuman.isi, pat))
              )
            )
            .orderBy(desc(pengumuman.created_at));
        } else {
          res = await db
            .select()
            .from(pengumuman)
            .where(isNull(pengumuman.deleted_at))
            .orderBy(desc(pengumuman.created_at));
        }
        setAnnouncementList(res);
      }
    } catch (e) {
      console.warn("Gagal memuat CMS:", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCmsData();
    setRefreshing(false);
  };

  // --- BERITA CRUD ---
  const openCreateBeritaModal = () => {
    setEditingBeritaId(null);
    setFormJudul("");
    setFormSlug("");
    setFormRingkasan("");
    setFormIsi("");
    setFormStatus("terbit");
    setFormThumbnail(null);
    setModalBeritaVisible(true);
  };

  const openEditBeritaModal = (item: Berita) => {
    setEditingBeritaId(item.id);
    setFormJudul(item.judul);
    setFormSlug(item.slug);
    setFormRingkasan(item.ringkasan || "");
    setFormIsi(item.isi);
    setFormStatus(item.status as any);
    setFormThumbnail(item.thumbnail_local_path || item.thumbnail_remote_url || null);
    setModalBeritaVisible(true);
  };

  const handleJudulChange = (text: string) => {
    setFormJudul(text);
    if (!editingBeritaId) {
      setFormSlug(generateSlug(text));
    }
  };

  const pickThumbnail = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        setFormThumbnail(res.assets[0].uri);
      }
    } catch (e) {
      console.warn("Gagal memilih thumbnail:", e);
    }
  };

  const handleSaveBerita = async () => {
    if (!formJudul.trim() || !formIsi.trim()) {
      showAlert({
        title: "Data Belum Lengkap",
        message: "Judul dan isi berita wajib diisi.",
        type: "warning",
      });
      return;
    }

    setSavingBerita(true);
    const nowIso = getIsoUtcString();
    const cleanIsi = sanitizeContent(formIsi.trim());
    const finalSlug = (formSlug.trim() || generateSlug(formJudul)).slice(0, 100);

    try {
      if (editingBeritaId) {
        await db
          .update(berita)
          .set({
            judul: formJudul.trim(),
            slug: finalSlug,
            ringkasan: formRingkasan.trim() || null,
            isi: cleanIsi,
            thumbnail_local_path: formThumbnail,
            status: formStatus,
            published_at: formStatus === "terbit" ? getTodayIsoDate() : null,
            updated_at: nowIso,
            sync_status: "pending_push",
          })
          .where(eq(berita.id, editingBeritaId));

        showAlert({
          title: "Berita Diperbarui",
          message: "Artikel berita berhasil diperbarui.",
          type: "success",
        });
      } else {
        await db.insert(berita).values({
          id: generateUUID(),
          created_at: nowIso,
          updated_at: nowIso,
          deleted_at: null,
          sync_status: "pending_push",
          last_synced_at: null,
          version: 1,
          judul: formJudul.trim(),
          slug: finalSlug,
          ringkasan: formRingkasan.trim() || null,
          isi: cleanIsi,
          thumbnail_local_path: formThumbnail,
          status: formStatus,
          published_at: formStatus === "terbit" ? getTodayIsoDate() : null,
          user_id: user?.id || null,
        });

        showAlert({
          title: "Berita Diterbitkan",
          message: `Berita "${formJudul.trim()}" berhasil disimpan.`,
          type: "success",
        });
      }

      await refreshPendingCountAsync();
      setModalBeritaVisible(false);
      await loadCmsData();
    } catch (e: any) {
      showAlert({
        title: "Gagal Menyimpan Berita",
        message: e?.message || "Terjadi kesalahan database.",
        type: "error",
      });
    } finally {
      setSavingBerita(false);
    }
  };

  const handleToggleBeritaStatus = async (item: Berita) => {
    const nextStatus = item.status === "terbit" ? "draft" : "terbit";
    const nowIso = getIsoUtcString();
    try {
      await db
        .update(berita)
        .set({
          status: nextStatus,
          published_at: nextStatus === "terbit" ? getTodayIsoDate() : null,
          updated_at: nowIso,
          sync_status: "pending_push",
        })
        .where(eq(berita.id, item.id));

      await refreshPendingCountAsync();
      await loadCmsData();
    } catch (e: any) {
      showAlert({ title: "Gagal Mengubah Status", message: e?.message, type: "error" });
    }
  };

  const handleDeleteBerita = (item: Berita) => {
    showAlert({
      title: "Hapus Berita",
      message: `Apakah Anda yakin ingin menghapus artikel "${item.judul}"?`,
      type: "confirm",
      buttons: [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              const nowIso = getIsoUtcString();
              await db
                .update(berita)
                .set({
                  deleted_at: nowIso,
                  updated_at: nowIso,
                  sync_status: "pending_push",
                })
                .where(eq(berita.id, item.id));

              await refreshPendingCountAsync();
              await loadCmsData();
            } catch (e: any) {
              showAlert({ title: "Gagal Menghapus", message: e?.message, type: "error" });
            }
          },
        },
      ],
    });
  };

  // --- PENGUMUMAN CRUD ---
  const openCreatePengumumanModal = () => {
    setEditingPengumumanId(null);
    setFormPJudul("");
    setFormPIsi("");
    setFormPTglMulai(getTodayIsoDate());
    setFormPTglSelesai(getFutureIsoDate(14));
    setFormPStatus("aktif");
    setModalPengumumanVisible(true);
  };

  const openEditPengumumanModal = (item: Pengumuman) => {
    setEditingPengumumanId(item.id);
    setFormPJudul(item.judul);
    setFormPIsi(item.isi);
    setFormPTglMulai(item.tanggal_mulai);
    setFormPTglSelesai(item.tanggal_selesai);
    setFormPStatus(item.status as any);
    setModalPengumumanVisible(true);
  };

  const handleSavePengumuman = async () => {
    if (!formPJudul.trim() || !formPIsi.trim()) {
      showAlert({
        title: "Data Belum Lengkap",
        message: "Judul dan isi pengumuman wajib diisi.",
        type: "warning",
      });
      return;
    }

    setSavingPengumuman(true);
    const nowIso = getIsoUtcString();

    try {
      if (editingPengumumanId) {
        await db
          .update(pengumuman)
          .set({
            judul: formPJudul.trim(),
            isi: formPIsi.trim(),
            tanggal_mulai: formPTglMulai,
            tanggal_selesai: formPTglSelesai,
            status: formPStatus,
            updated_at: nowIso,
            sync_status: "pending_push",
          })
          .where(eq(pengumuman.id, editingPengumumanId));

        showAlert({
          title: "Pengumuman Diperbarui",
          message: "Data pengumuman berhasil disimpan.",
          type: "success",
        });
      } else {
        await db.insert(pengumuman).values({
          id: generateUUID(),
          created_at: nowIso,
          updated_at: nowIso,
          deleted_at: null,
          sync_status: "pending_push",
          last_synced_at: null,
          version: 1,
          judul: formPJudul.trim(),
          isi: formPIsi.trim(),
          tanggal_mulai: formPTglMulai,
          tanggal_selesai: formPTglSelesai,
          status: formPStatus,
          user_id: user?.id || null,
        });

        showAlert({
          title: "Pengumuman Dibuat",
          message: "Pengumuman baru berhasil dipublikasikan.",
          type: "success",
        });
      }

      await refreshPendingCountAsync();
      setModalPengumumanVisible(false);
      await loadCmsData();
    } catch (e: any) {
      showAlert({
        title: "Gagal Menyimpan",
        message: e?.message || "Terjadi kesalahan database.",
        type: "error",
      });
    } finally {
      setSavingPengumuman(false);
    }
  };

  const handleTogglePengumumanStatus = async (item: Pengumuman) => {
    const next = item.status === "aktif" ? "nonaktif" : "aktif";
    const nowIso = getIsoUtcString();
    try {
      await db
        .update(pengumuman)
        .set({
          status: next,
          updated_at: nowIso,
          sync_status: "pending_push",
        })
        .where(eq(pengumuman.id, item.id));

      await refreshPendingCountAsync();
      await loadCmsData();
    } catch (e: any) {
      showAlert({ title: "Gagal Mengubah Status", message: e?.message, type: "error" });
    }
  };

  const handleDeletePengumuman = (item: Pengumuman) => {
    showAlert({
      title: "Hapus Pengumuman",
      message: `Hapus pengumuman "${item.judul}"?`,
      type: "confirm",
      buttons: [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              const nowIso = getIsoUtcString();
              await db
                .update(pengumuman)
                .set({
                  deleted_at: nowIso,
                  updated_at: nowIso,
                  sync_status: "pending_push",
                })
                .where(eq(pengumuman.id, item.id));

              await refreshPendingCountAsync();
              await loadCmsData();
            } catch (e: any) {
              showAlert({ title: "Gagal Menghapus", message: e?.message, type: "error" });
            }
          },
        },
      ],
    });
  };

  // Filtered views
  const filteredNews = useMemo(() => {
    if (filterNewsStatus === "all") return newsList;
    return newsList.filter((n) => n.status === filterNewsStatus);
  }, [newsList, filterNewsStatus]);

  // List item renderers
  const renderBeritaItem = ({ item }: { item: Berita }) => (
    <ModernCard key={item.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <Badge
          label={item.status === "terbit" ? "TERBIT" : "DRAFT"}
          variant={item.status === "terbit" ? "active" : "neutral"}
          size="sm"
        />
        <Text style={styles.dateText}>
          {item.published_at || item.created_at.slice(0, 10)}
        </Text>
      </View>

      {item.thumbnail_local_path || item.thumbnail_remote_url ? (
        <Image
          source={{ uri: item.thumbnail_local_path || item.thumbnail_remote_url || "" }}
          style={styles.newsThumb}
        />
      ) : null}

      <Text style={styles.newsTitle}>{item.judul}</Text>
      {item.ringkasan ? (
        <Text style={styles.newsSnippet} numberOfLines={2}>
          {item.ringkasan}
        </Text>
      ) : (
        <Text style={styles.newsSnippet} numberOfLines={2}>
          {item.isi}
        </Text>
      )}

      <View style={styles.slugRow}>
        <Ionicons name="link-outline" size={12} color={colors.neutral.textMuted} />
        <Text style={styles.slugText}>{item.slug}</Text>
      </View>

      {/* Card Actions */}
      <View style={styles.cardActionRow}>
        <Pressable
          style={({ pressed }) => [styles.toggleBtn, pressed && styles.pressedState]}
          onPress={() => handleToggleBeritaStatus(item)}
          accessibilityRole="button"
          accessibilityLabel={item.status === "terbit" ? "Jadikan draft" : "Terbitkan"}
        >
          <Ionicons
            name={item.status === "terbit" ? "eye-off-outline" : "send-outline"}
            size={14}
            color={colors.primary[700]}
          />
          <Text style={styles.toggleBtnText}>
            {item.status === "terbit" ? "Jadikan Draft" : "Terbitkan"}
          </Text>
        </Pressable>

        <View style={styles.actionButtonGroup}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressedOpacity]}
            onPress={() => openEditBeritaModal(item)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit berita"
          >
            <Ionicons name="create-outline" size={15} color={colors.neutral.textSecondary} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressedOpacity]}
            onPress={() => handleDeleteBerita(item)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Hapus berita"
          >
            <Ionicons name="trash-outline" size={15} color={colors.status.cancelled} />
            <Text style={[styles.actionBtnText, { color: colors.status.cancelled }]}>
              Hapus
            </Text>
          </Pressable>
        </View>
      </View>
    </ModernCard>
  );

  const renderPengumumanItem = ({ item }: { item: Pengumuman }) => (
    <ModernCard key={item.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <Badge
          label={item.status === "aktif" ? "AKTIF" : "NONAKTIF"}
          variant={item.status === "aktif" ? "gold" : "neutral"}
          size="sm"
        />
        <Text style={styles.dateText}>
          {item.tanggal_mulai} s/d {item.tanggal_selesai}
        </Text>
      </View>

      <Text style={styles.newsTitle}>{item.judul}</Text>
      <Text style={styles.announcementBody}>{item.isi}</Text>

      {/* Card Actions */}
      <View style={styles.cardActionRow}>
        <Pressable
          style={({ pressed }) => [styles.toggleBtn, pressed && styles.pressedState]}
          onPress={() => handleTogglePengumumanStatus(item)}
          accessibilityRole="button"
          accessibilityLabel={item.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
        >
          <Ionicons
            name={item.status === "aktif" ? "pause-outline" : "play-outline"}
            size={14}
            color={colors.primary[700]}
          />
          <Text style={styles.toggleBtnText}>
            {item.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
          </Text>
        </Pressable>

        <View style={styles.actionButtonGroup}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressedOpacity]}
            onPress={() => openEditPengumumanModal(item)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit pengumuman"
          >
            <Ionicons name="create-outline" size={15} color={colors.neutral.textSecondary} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressedOpacity]}
            onPress={() => handleDeletePengumuman(item)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Hapus pengumuman"
          >
            <Ionicons name="trash-outline" size={15} color={colors.status.cancelled} />
            <Text style={[styles.actionBtnText, { color: colors.status.cancelled }]}>
              Hapus
            </Text>
          </Pressable>
        </View>
      </View>
    </ModernCard>
  );

  return (
    <AppShell
      title="CMS & Publikasi"
      showBack
      onAdd={activeTab === "berita" ? openCreateBeritaModal : openCreatePengumumanModal}
      addLabel={activeTab === "berita" ? "Tulis Berita" : "Buat Pengumuman"}
      headerChildren={
        <View style={styles.headerSlot}>
          <SegmentedTabs
            tabs={[
              { key: "berita", label: "Berita Madrasah", badge: newsList.length },
              { key: "pengumuman", label: "Pengumuman", badge: announcementList.length },
            ]}
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as "berita" | "pengumuman")}
          />

          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder={
              activeTab === "berita"
                ? "Cari judul atau ringkasan berita..."
                : "Cari judul atau isi pengumuman..."
            }
          />

          {activeTab === "berita" && (
            <FilterChipGroup>
              {[
                { id: "all", label: "Semua Status" },
                { id: "terbit", label: "Terbit" },
                { id: "draft", label: "Draft" },
              ].map((chip) => (
                <FilterChip
                  key={chip.id}
                  label={chip.label}
                  selected={filterNewsStatus === chip.id}
                  onPress={() => setFilterNewsStatus(chip.id)}
                />
              ))}
            </FilterChipGroup>
          )}
        </View>
      }
    >
      {activeTab === "berita" ? (
        <FlatList<Berita>
          data={filteredNews}
          keyExtractor={(item) => item.id}
          renderItem={renderBeritaItem}
          ListEmptyComponent={
            <EmptyState
              icon="newspaper-outline"
              title="Belum Ada Berita"
              message={
                search.trim()
                  ? "Tidak ada artikel berita yang cocok dengan pencarian Anda."
                  : "Belum ada artikel berita. Klik '+ Tulis Berita' untuk menambahkan konten publikasi madrasah."
              }
              actionLabel={!search.trim() ? "+ Tulis Berita Baru" : undefined}
              onAction={!search.trim() ? openCreateBeritaModal : undefined}
            />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary[700]]}
              tintColor={colors.primary[700]}
            />
          }
        />
      ) : (
        <FlatList<Pengumuman>
          data={announcementList}
          keyExtractor={(item) => item.id}
          renderItem={renderPengumumanItem}
          ListEmptyComponent={
            <EmptyState
              icon="megaphone-outline"
              title="Belum Ada Pengumuman"
              message={
                search.trim()
                  ? "Tidak ada pengumuman yang cocok dengan pencarian Anda."
                  : "Belum ada pengumuman aktif. Klik '+ Buat Pengumuman' untuk menambahkan agenda tayang."
              }
              actionLabel={!search.trim() ? "+ Buat Pengumuman Baru" : undefined}
              onAction={!search.trim() ? openCreatePengumumanModal : undefined}
            />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary[700]]}
              tintColor={colors.primary[700]}
            />
          }
        />
      )}

      {/* FAB Tambah Konten (Mobile only < 768px untuk Operator) */}
      <FAB
        onPress={activeTab === "berita" ? openCreateBeritaModal : openCreatePengumumanModal}
        accessibilityLabel={activeTab === "berita" ? "Tulis Berita Baru" : "Buat Pengumuman Baru"}
      />

      {/* ================= MODAL FORM BERITA ================= */}
      <Modal visible={modalBeritaVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "90%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingBeritaId ? "Edit Artikel Berita" : "Tulis Berita Baru"}
                </Text>
                <Text style={styles.modalSubtitle}>Publikasi informasi & prestasi madrasah</Text>
              </View>
              <Pressable
                onPress={() => setModalBeritaVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedOpacity]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Judul Berita *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formJudul}
                  onChangeText={handleJudulChange}
                  placeholder="Contoh: Prestasi Siswa MTs RTH di Kompetisi Sains"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Slug URL (Otomatis)</Text>
                <TextInput
                  style={[styles.textInput, { color: colors.neutral.textMuted }]}
                  value={formSlug}
                  onChangeText={setFormSlug}
                  placeholder="slug-otomatis-dari-judul"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Ringkasan / Cuplikan Singkat</Text>
                <TextInput
                  style={[styles.textInput, { height: 60 }]}
                  value={formRingkasan}
                  onChangeText={setFormRingkasan}
                  placeholder="Ringkasan 1-2 kalimat untuk kartu depan..."
                  multiline
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Isi Artikel Lengkap * (Sanitasi XSS Aktif)</Text>
                <TextInput
                  style={[styles.textInput, { height: 120 }]}
                  value={formIsi}
                  onChangeText={setFormIsi}
                  placeholder="Tuliskan berita lengkap madrasah di sini..."
                  multiline
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Status Publikasi</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {(["terbit", "draft"] as const).map((st) => (
                    <Pressable
                      key={st}
                      style={({ pressed }) => [
                        styles.sifatBtn,
                        formStatus === st && styles.sifatBtnActive,
                        pressed && styles.pressedState,
                      ]}
                      onPress={() => setFormStatus(st)}
                      accessibilityRole="button"
                      accessibilityLabel={st === "terbit" ? "Langsung terbit" : "Simpan draft"}
                    >
                      <Text
                        style={[
                          styles.sifatBtnText,
                          formStatus === st && styles.sifatBtnTextActive,
                        ]}
                      >
                        {st === "terbit" ? "LANGSUNG TERBIT" : "SIMPAN DRAFT"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Foto Thumbnail Utama</Text>
                <Pressable
                  style={({ pressed }) => [styles.uploadDocBtn, pressed && styles.pressedState]}
                  onPress={pickThumbnail}
                  accessibilityRole="button"
                  accessibilityLabel="Pilih gambar thumbnail"
                >
                  <Ionicons name="image-outline" size={18} color={colors.primary[700]} />
                  <Text style={styles.uploadDocBtnText}>
                    {formThumbnail ? "Ganti Gambar Thumbnail" : "Pilih Gambar dari Galeri"}
                  </Text>
                </Pressable>
                {formThumbnail && (
                  <Image source={{ uri: formThumbnail }} style={styles.thumbPreview} />
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                onPress={() => setModalBeritaVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title={savingBerita ? "Menyimpan..." : "Simpan Berita"}
                variant="primary"
                size="md"
                onPress={handleSaveBerita}
                loading={savingBerita}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL FORM PENGUMUMAN ================= */}
      <Modal visible={modalPengumumanVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingPengumumanId ? "Edit Pengumuman" : "Buat Pengumuman Baru"}
                </Text>
                <Text style={styles.modalSubtitle}>Pemberitahuan resmi agenda madrasah</Text>
              </View>
              <Pressable
                onPress={() => setModalPengumumanVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedOpacity]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Judul Pengumuman *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formPJudul}
                  onChangeText={setFormPJudul}
                  placeholder="Contoh: Libur Hari Raya Idul Adha 1447 H"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Isi Pengumuman Lengkap *</Text>
                <TextInput
                  style={[styles.textInput, { height: 90 }]}
                  value={formPIsi}
                  onChangeText={setFormPIsi}
                  placeholder="Tuliskan isi pengumuman untuk siswa dan wali..."
                  multiline
                />
              </View>

              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Tgl Mulai Tayang *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formPTglMulai}
                    onChangeText={setFormPTglMulai}
                    placeholder="YYYY-MM-DD"
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Tgl Berakhir *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formPTglSelesai}
                    onChangeText={setFormPTglSelesai}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Status Tayang</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {(["aktif", "nonaktif"] as const).map((st) => (
                    <Pressable
                      key={st}
                      style={({ pressed }) => [
                        styles.sifatBtn,
                        formPStatus === st && styles.sifatBtnActive,
                        pressed && styles.pressedState,
                      ]}
                      onPress={() => setFormPStatus(st)}
                      accessibilityRole="button"
                      accessibilityLabel={st === "aktif" ? "Aktif tayang" : "Nonaktif"}
                    >
                      <Text
                        style={[
                          styles.sifatBtnText,
                          formPStatus === st && styles.sifatBtnTextActive,
                        ]}
                      >
                        {st === "aktif" ? "AKTIF TAYANG" : "NONAKTIF"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                onPress={() => setModalPengumumanVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title={savingPengumuman ? "Menyimpan..." : "Simpan Pengumuman"}
                variant="primary"
                size="md"
                onPress={handleSavePengumuman}
                loading={savingPengumuman}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingBottom: spacing.xxl,
  },
  headerContainer: {
    marginBottom: spacing.xs,
  },
  headerSlot: {
    gap: 8,
    paddingTop: 4,
  },
  forbiddenContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    marginTop: 60,
  },
  forbiddenTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.status.conflict,
    marginTop: 14,
    marginBottom: 8,
  },
  forbiddenSub: {
    fontSize: 13,
    color: colors.neutral.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.neutral.surface,
    padding: 4,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  tabBtnActive: {
    backgroundColor: colors.primary[700],
    ...shadows.soft,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.neutral.textMuted,
  },
  tabTextActive: {
    color: colors.neutral.white,
  },
  actionTopRow: {
    marginBottom: spacing.sm,
  },
  searchRow: {
    marginBottom: spacing.sm,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    height: 42,
    ...shadows.soft,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.neutral.textPrimary,
  },
  filterSection: {
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.neutral.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  chipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral.textMuted,
  },
  chipTextActive: {
    color: colors.primary[700],
    fontWeight: "700",
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.xl,
    borderCurve: "continuous",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  dateText: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    fontWeight: "500",
  },
  newsThumb: {
    width: "100%",
    height: 150,
    borderRadius: radius.md,
    borderCurve: "continuous",
    marginBottom: spacing.sm,
  },
  newsTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
    marginBottom: 4,
    lineHeight: 20,
  },
  newsSnippet: {
    fontSize: 12,
    color: colors.neutral.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  announcementBody: {
    fontSize: 13,
    color: colors.neutral.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  slugRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: spacing.sm,
  },
  slugText: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    fontFamily: "monospace",
  },
  cardActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.borderSubtle,
    paddingTop: spacing.sm,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primary[50],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderCurve: "continuous",
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary[700],
  },
  actionButtonGroup: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
  },
  emptyCard: {
    alignItems: "center",
    padding: spacing.xl,
    gap: 6,
    borderRadius: radius.xl,
    borderCurve: "continuous",
    marginTop: spacing.md,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    textAlign: "center",
    lineHeight: 18,
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
    maxWidth: 480,
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    borderCurve: "continuous",
    padding: spacing.lg,
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
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
  },
  modalSubtitle: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
    borderRadius: radius.full,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
    marginBottom: 5,
  },
  textInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.neutral.textPrimary,
    backgroundColor: colors.neutral.canvas,
  },
  sifatBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  sifatBtnActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  sifatBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral.textMuted,
  },
  sifatBtnTextActive: {
    color: colors.primary[700],
    fontWeight: "800",
  },
  uploadDocBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[300],
    borderStyle: "dashed",
    backgroundColor: colors.primary[50],
  },
  uploadDocBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary[700],
  },
  thumbPreview: {
    width: "100%",
    height: 120,
    borderRadius: radius.md,
    borderCurve: "continuous",
    marginTop: spacing.sm,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
    paddingTop: spacing.sm,
  },
  pressedState: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  pressedOpacity: {
    opacity: 0.6,
  },
});
