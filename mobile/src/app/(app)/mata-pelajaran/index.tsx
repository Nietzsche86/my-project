import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { colors, radius, radii, shadows, spacing } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { useSync } from "../../../context/SyncContext";
import { AppShell } from "../../../components/layout/AppShell";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { Badge } from "../../../components/ui/Badge";
import {
  SearchBar,
  FilterChip,
  FilterChipGroup,
  EmptyState,
  FAB,
  useToast,
  ConfirmDialog,
} from "../../../components/ui";
import { db } from "../../../db/client";
import {
  mataPelajaran,
  guruMapel,
  pengampuKelas,
  type MataPelajaran,
} from "../../../db/schema";
import { isNull, eq, and, sql } from "drizzle-orm";
import { Ionicons } from "@expo/vector-icons";
import { generateUUID, getIsoUtcString } from "../../../db/crypto";

type KelompokFilter = "Semua" | "PAI" | "Umum" | "Mulok";

export default function MataPelajaranScreen() {
  const { role } = useAuth();
  const { refreshPendingCountAsync } = useSync();
  const isOperator = role === "super_admin" || role === "staf_tu";

  const [list, setList] = useState<MataPelajaran[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKelompok, setSelectedKelompok] = useState<KelompokFilter>("Semua");

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form State
  const [kodeMapel, setKodeMapel] = useState("");
  const [namaMapel, setNamaMapel] = useState("");
  const [kelompok, setKelompok] = useState<"PAI" | "Umum" | "Mulok">("PAI");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await db
        .select()
        .from(mataPelajaran)
        .where(isNull(mataPelajaran.deleted_at));
      setList(res);
    } catch (e) {
      console.warn("Gagal membaca mapel:", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const openAddModal = () => {
    setIsEditing(false);
    setSelectedId(null);
    setKodeMapel("");
    setNamaMapel("");
    setKelompok("PAI");
    setIsActive(true);
    setModalVisible(true);
  };

  const openEditModal = (item: MataPelajaran) => {
    setIsEditing(true);
    setSelectedId(item.id);
    setKodeMapel(item.kode_mapel);
    setNamaMapel(item.nama_mapel);
    setKelompok(item.kelompok as "PAI" | "Umum" | "Mulok");
    setIsActive(item.is_active === 1);
    setModalVisible(true);
  };

  const handleSave = async () => {
    const cleanKode = kodeMapel.trim().toUpperCase();
    const cleanNama = namaMapel.trim();

    if (!cleanKode || !cleanNama) {
      Alert.alert("Form Belum Lengkap", "Kode dan Nama Mata Pelajaran wajib diisi.");
      return;
    }

    setSaving(true);
    const now = getIsoUtcString();

    try {
      // Cek keunikan kode mapel (abaikan data sendiri saat edit)
      const existing = await db
        .select()
        .from(mataPelajaran)
        .where(
          and(
            eq(mataPelajaran.kode_mapel, cleanKode),
            isNull(mataPelajaran.deleted_at)
          )
        );

      if (
        existing.length > 0 &&
        (!isEditing || (isEditing && existing[0]?.id !== selectedId))
      ) {
        Alert.alert(
          "Kode Duplikat",
          `Mata pelajaran dengan kode '${cleanKode}' sudah digunakan oleh '${existing[0]?.nama_mapel}'.`
        );
        setSaving(false);
        return;
      }

      if (isEditing && selectedId) {
        await db
          .update(mataPelajaran)
          .set({
            kode_mapel: cleanKode,
            nama_mapel: cleanNama,
            kelompok,
            is_active: isActive ? 1 : 0,
            updated_at: now,
            sync_status: "pending_push",
          })
          .where(eq(mataPelajaran.id, selectedId));
      } else {
        await db.insert(mataPelajaran).values({
          id: generateUUID(),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "pending_push",
          last_synced_at: null,
          version: 1,
          kode_mapel: cleanKode,
          nama_mapel: cleanNama,
          kelompok,
          is_active: isActive ? 1 : 0,
        });
      }

      await refreshPendingCountAsync();
      setModalVisible(false);
      await loadData();
    } catch (e: any) {
      Alert.alert("Gagal Menyimpan", e?.message || "Terjadi kesalahan database");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (item: MataPelajaran) => {
    const nextStatus = item.is_active === 1 ? 0 : 1;
    const now = getIsoUtcString();

    try {
      await db
        .update(mataPelajaran)
        .set({
          is_active: nextStatus,
          updated_at: now,
          sync_status: "pending_push",
          version: item.version + 1,
        })
        .where(eq(mataPelajaran.id, item.id));

      await refreshPendingCountAsync();
      await loadData();
    } catch (e: any) {
      Alert.alert("Gagal Mengubah Status", e?.message);
    }
  };

  const handleDelete = (item: MataPelajaran) => {
    const isSuperAdmin = role === "super_admin";

    Alert.alert(
      isSuperAdmin ? "Hapus Mata Pelajaran (Super Admin)" : "Hapus Mata Pelajaran",
      isSuperAdmin
        ? `Apakah Anda yakin ingin menghapus '${item.nama_mapel}' (${item.kode_mapel})?\n\nSebagai Super Admin, seluruh relasi guru pengajar dan penugasan rombel terkait akan otomatis dicabut.`
        : `Apakah Anda yakin ingin menghapus '${item.nama_mapel}' (${item.kode_mapel})?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: isSuperAdmin ? "Ya, Hapus (Paksa)" : "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              // Validasi relasi hanya untuk non-super_admin
              if (!isSuperAdmin) {
                // 1. Cek relasi di guru_mapel
                const guruRelations = await db
                  .select({ count: sql<number>`count(*)` })
                  .from(guruMapel)
                  .where(
                    and(
                      eq(guruMapel.mata_pelajaran_id, item.id),
                      isNull(guruMapel.deleted_at)
                    )
                  );

                if (Number(guruRelations[0]?.count || 0) > 0) {
                  Alert.alert(
                    "Tidak Dapat Menghapus",
                    `Mata pelajaran ini masih terhubung dengan ${guruRelations[0]?.count} guru pengajar. Hapus penugasan guru terlebih dahulu.`
                  );
                  return;
                }

                // 2. Cek relasi di pengampu_kelas
                const pengampuRelations = await db
                  .select({ count: sql<number>`count(*)` })
                  .from(pengampuKelas)
                  .where(
                    and(
                      eq(pengampuKelas.mata_pelajaran_id, item.id),
                      isNull(pengampuKelas.deleted_at)
                    )
                  );

                if (Number(pengampuRelations[0]?.count || 0) > 0) {
                  Alert.alert(
                    "Tidak Dapat Menghapus",
                    `Mata pelajaran ini masih aktif diajarkan pada ${pengampuRelations[0]?.count} rombel kelas. Hapus penugasan rombel terlebih dahulu.`
                  );
                  return;
                }
              }

              // 3. Lakukan Soft Delete
              const now = getIsoUtcString();
              await db
                .update(mataPelajaran)
                .set({
                  deleted_at: now,
                  updated_at: now,
                  sync_status: "pending_push",
                  version: item.version + 1,
                })
                .where(eq(mataPelajaran.id, item.id));

              // Cascade soft-delete relasi jika dilakukan oleh super_admin
              if (isSuperAdmin) {
                await db
                  .update(guruMapel)
                  .set({
                    deleted_at: now,
                    updated_at: now,
                    sync_status: "pending_push",
                  })
                  .where(eq(guruMapel.mata_pelajaran_id, item.id));

                await db
                  .update(pengampuKelas)
                  .set({
                    deleted_at: now,
                    updated_at: now,
                    sync_status: "pending_push",
                  })
                  .where(eq(pengampuKelas.mata_pelajaran_id, item.id));
              }

              await refreshPendingCountAsync();
              await loadData();
            } catch (e: any) {
              Alert.alert("Gagal Menghapus", e?.message);
            }
          },
        },
      ]
    );
  };

  const filteredList = useMemo(() => {
    return list.filter((m) => {
      const matchKelompok =
        selectedKelompok === "Semua" ? true : m.kelompok === selectedKelompok;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.nama_mapel.toLowerCase().includes(q) ||
        m.kode_mapel.toLowerCase().includes(q);
      return matchKelompok && matchSearch;
    });
  }, [list, selectedKelompok, searchQuery]);

  // Statistik Ringkasan
  const totalMapel = list.length;
  const totalPai = list.filter((m) => m.kelompok === "PAI").length;
  const totalUmum = list.filter((m) => m.kelompok === "Umum").length;
  const totalMulok = list.filter((m) => m.kelompok === "Mulok").length;

  const getGroupedShape = (index: number, total: number) => {
    if (total <= 1) {
      return {
        borderRadius: radius.lg,
        borderCurve: "continuous" as const,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.neutral.border,
      };
    }
    if (index === 0) {
      return {
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        borderCurve: "continuous" as const,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderColor: colors.neutral.border,
      };
    }
    if (index === total - 1) {
      return {
        borderBottomLeftRadius: radius.lg,
        borderBottomRightRadius: radius.lg,
        borderCurve: "continuous" as const,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderColor: colors.neutral.border,
      };
    }
    return {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: colors.neutral.border,
    };
  };

  const renderMapelItem = useCallback(
    ({ item: m, index }: { item: MataPelajaran; index: number }) => {
      const shape = getGroupedShape(index, filteredList.length);
      const isActiveBool = m.is_active === 1;

      return (
        <View style={[styles.rowItem, shape]}>
          <View style={styles.row}>
            {/* Badge Kode Mapel */}
            <View
              style={[
                styles.kodeBadge,
                m.kelompok === "PAI" && styles.badgePai,
                m.kelompok === "Mulok" && styles.badgeMulok,
              ]}
            >
              <Text
                style={[
                  styles.kodeText,
                  m.kelompok === "PAI" && styles.kodeTextPai,
                  m.kelompok === "Mulok" && styles.kodeTextMulok,
                ]}
              >
                {m.kode_mapel}
              </Text>
            </View>

            {/* Informasi Mapel */}
            <View style={styles.infoCol}>
              <View style={styles.titleLine}>
                <Text style={styles.namaMapel}>{m.nama_mapel}</Text>
              </View>
              <View style={styles.metaLine}>
                <Text style={styles.kelompokBadge}>{m.kelompok}</Text>
                <Text style={styles.dotSeparator}>•</Text>
                <Badge
                  label={isActiveBool ? "AKTIF" : "NONAKTIF"}
                  variant={isActiveBool ? "active" : "neutral"}
                  size="sm"
                />
              </View>
            </View>

            {/* Operator Actions */}
            {isOperator && (
              <View style={styles.actionCol}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isActiveBool ? "Nonaktifkan mapel" : "Aktifkan mapel"}
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => handleToggleStatus(m)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={isActiveBool ? "eye" : "eye-off"}
                    size={18}
                    color={isActiveBool ? colors.primary[600] : colors.neutral.textMuted}
                  />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit mapel ${m.nama_mapel}`}
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => openEditModal(m)}
                  hitSlop={8}
                >
                  <Ionicons name="pencil" size={17} color={colors.accent.gold} />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Hapus mapel ${m.nama_mapel}`}
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => handleDelete(m)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.status.cancelled} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      );
    },
    [filteredList.length, isOperator]
  );

  return (
    <AppShell
      title="Master Mata Pelajaran"
      showBack
      onAdd={isOperator ? openAddModal : undefined}
      addLabel="Tambah Mapel"
      headerChildren={
        <View style={styles.headerSlot}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari nama atau kode mapel..."
          />
          <FilterChipGroup>
            {(["Semua", "PAI", "Umum", "Mulok"] as KelompokFilter[]).map((grp) => {
              const isSelected = selectedKelompok === grp;
              let count = totalMapel;
              if (grp === "PAI") count = totalPai;
              if (grp === "Umum") count = totalUmum;
              if (grp === "Mulok") count = totalMulok;
              return (
                <FilterChip
                  key={grp}
                  label={`${grp} (${count})`}
                  selected={isSelected}
                  onPress={() => setSelectedKelompok(grp)}
                />
              );
            })}
          </FilterChipGroup>
        </View>
      }
    >
      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.id}
        renderItem={renderMapelItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon="book-outline"
            title="Mata Pelajaran Tidak Ditemukan"
            message={
              searchQuery
                ? `Tidak ada mapel yang cocok dengan kata kunci "${searchQuery}".`
                : "Belum ada mata pelajaran pada kategori yang dipilih."
            }
            actionLabel={isOperator && !searchQuery ? "+ Tambah Mapel" : undefined}
            onAction={isOperator && !searchQuery ? openAddModal : undefined}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[700]]}
            tintColor={colors.primary[700]}
          />
        }
      />

      {/* FAB Tambah Mapel (Mobile only < 768px untuk Operator) */}
      {isOperator && (
        <FAB
          onPress={openAddModal}
          accessibilityLabel="Tambah Mata Pelajaran"
        />
      )}

      {/* Modal Tambah / Edit Mata Pelajaran */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 30 : 0}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {isEditing ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Kelola struktur kurikulum & identitas mapel
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog"
                onPress={() => setModalVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Kode Mapel */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Kode Mapel (Misal: MTK, QH, ASW)</Text>
                <TextInput
                  value={kodeMapel}
                  onChangeText={(val) => setKodeMapel(val.toUpperCase())}
                  placeholder="Contoh: FIQ"
                  style={styles.input}
                  maxLength={10}
                  autoCapitalize="characters"
                />
              </View>

              {/* Nama Mapel */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nama Mata Pelajaran</Text>
                <TextInput
                  value={namaMapel}
                  onChangeText={setNamaMapel}
                  placeholder="Contoh: Fiqih Ibadah & Muamalah"
                  style={styles.input}
                />
              </View>

              {/* Kelompok Mapel */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Kelompok Kurikulum</Text>
                <View style={styles.kelompokSelector}>
                  {(["PAI", "Umum", "Mulok"] as const).map((k) => {
                    const isSelected = kelompok === k;
                    return (
                      <Pressable
                        key={k}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setKelompok(k)}
                        style={({ pressed }) => [
                          styles.kelompokBtn,
                          isSelected && styles.kelompokBtnSelected,
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.kelompokBtnText,
                            isSelected && styles.kelompokBtnTextSelected,
                          ]}
                        >
                          {k}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Status Aktif */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Status Pembelajaran</Text>
                <View style={styles.statusToggleRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => setIsActive(true)}
                    style={({ pressed }) => [
                      styles.statusToggleBtn,
                      isActive && styles.statusToggleActive,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={isActive ? colors.primary[700] : colors.neutral.textMuted}
                    />
                    <Text
                      style={[
                        styles.statusToggleText,
                        isActive && styles.statusToggleTextActive,
                      ]}
                    >
                      Aktif Diajarkan
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: !isActive }}
                    onPress={() => setIsActive(false)}
                    style={({ pressed }) => [
                      styles.statusToggleBtn,
                      !isActive && styles.statusToggleInactive,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={!isActive ? colors.status.cancelled : colors.neutral.textMuted}
                    />
                    <Text
                      style={[
                        styles.statusToggleText,
                        !isActive && styles.statusToggleTextInactive,
                      ]}
                    >
                      Nonaktif
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                onPress={() => setModalVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title={saving ? "Menyimpan..." : isEditing ? "Simpan" : "Simpan Mapel"}
                variant="primary"
                size="md"
                onPress={handleSave}
                loading={saving}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 40,
  },
  headerSlot: {
    gap: 8,
    paddingTop: 4,
  },
  headerContainer: {
    marginBottom: spacing.xs,
  },
  rowItem: {
    backgroundColor: colors.neutral.surface,
    padding: spacing.md,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.neutral.borderSubtle,
    marginLeft: 72,
  },
  topSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    height: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    gap: 8,
    ...shadows.soft,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.neutral.textPrimary,
    padding: 0,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  chipSelected: {
    backgroundColor: colors.primary[700],
    borderColor: colors.primary[700],
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
  },
  chipTextSelected: {
    color: colors.neutral.white,
  },
  list: {
    gap: 8,
    paddingBottom: 28,
  },
  card: {
    marginBottom: 2,
    padding: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  kodeBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[100],
  },
  badgePai: {
    backgroundColor: colors.primary[100],
    borderColor: colors.primary[300],
  },
  badgeMulok: {
    backgroundColor: colors.accent.goldLight,
    borderColor: colors.accent.goldBorder,
  },
  kodeText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary[700],
  },
  kodeTextPai: {
    color: colors.primary[800],
  },
  kodeTextMulok: {
    color: colors.accent.gold,
  },
  infoCol: {
    flex: 1,
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  namaMapel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  kelompokBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
    backgroundColor: colors.neutral.canvas,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  dotSeparator: {
    fontSize: 10,
    color: colors.neutral.textMuted,
  },
  actionCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtn: {
    padding: 6,
    borderRadius: radii.md,
    backgroundColor: colors.neutral.canvas,
  },
  emptyCard: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.neutral.textMuted,
    textAlign: "center",
    marginTop: 6,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    borderCurve: "continuous",
    padding: 20,
    ...shadows.medium,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.border,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.neutral.textPrimary,
  },
  kelompokSelector: {
    flexDirection: "row",
    gap: 8,
  },
  kelompokBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  kelompokBtnSelected: {
    backgroundColor: colors.primary[700],
    borderColor: colors.primary[700],
  },
  kelompokBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
  },
  kelompokBtnTextSelected: {
    color: colors.neutral.white,
  },
  statusToggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  statusToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  statusToggleActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  statusToggleInactive: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  statusToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
  },
  statusToggleTextActive: {
    color: colors.primary[800],
  },
  statusToggleTextInactive: {
    color: colors.status.cancelled,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
    paddingTop: 14,
  },
});
