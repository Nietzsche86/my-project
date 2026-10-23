import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { router } from "expo-router";
import { colors, radius, shadows, spacing } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { useSync } from "../../../context/SyncContext";
import { AppShell } from "../../../components/layout/AppShell";
import { ModernButton } from "../../../components/ui/ModernButton";
import { Badge } from "../../../components/ui/Badge";
import {
  SearchBar,
  FilterChipGroup,
  FilterChip,
  ListItemCard,
  EmptyState,
  FAB,
  ConfirmDialog,
  useToast,
} from "../../../components/ui";
import { db } from "../../../db/client";
import {
  kelas,
  pegawai,
  anggotaKelas,
  pengampuKelas,
  tahunAjaran,
  type Kelas,
  type TahunAjaran,
  type Pegawai,
} from "../../../db/schema";
import { isNull, eq, and, sql, desc } from "drizzle-orm";
import { Ionicons } from "@expo/vector-icons";
import { generateUUID, getIsoUtcString } from "../../../db/crypto";

type TingkatFilter = "Semua" | "7" | "8" | "9";

interface KelasWithRelations extends Kelas {
  waliName: string;
  totalSiswa: number;
  totalPengampu: number;
}

export default function KelasScreen() {
  const { role } = useAuth();
  const { refreshPendingCountAsync } = useSync();
  const { showToast } = useToast();
  const isOperator = role === "super_admin" || role === "staf_tu";

  const [tahunList, setTahunList] = useState<TahunAjaran[]>([]);
  const [selectedTaId, setSelectedTaId] = useState<string>("");
  const [selectedTa, setSelectedTa] = useState<TahunAjaran | null>(null);

  const [classList, setClassList] = useState<KelasWithRelations[]>([]);
  const [guruList, setGuruList] = useState<Pegawai[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTingkat, setSelectedTingkat] = useState<TingkatFilter>("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State Tambah / Edit Rombel
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedKelasId, setSelectedKelasId] = useState<string | null>(null);

  // Form State
  const [formTingkat, setFormTingkat] = useState<7 | 8 | 9>(7);
  const [formNama, setFormNama] = useState("");
  const [formWaliId, setFormWaliId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal Switch Periode
  const [taPickerVisible, setTaPickerVisible] = useState(false);

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState<KelasWithRelations | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    initScreen();
  }, []);

  const initScreen = async () => {
    try {
      const periods = await db
        .select()
        .from(tahunAjaran)
        .where(isNull(tahunAjaran.deleted_at))
        .orderBy(desc(tahunAjaran.nama), tahunAjaran.semester);

      setTahunList(periods);

      // Cari periode aktif
      const activeTa = periods.find((p) => p.is_active === 1) || periods[0];
      if (activeTa) {
        setSelectedTaId(activeTa.id);
        setSelectedTa(activeTa);
        await loadKelasData(activeTa.id);
      }

      // Ambil daftar guru aktif untuk wali kelas
      const teachers = await db
        .select()
        .from(pegawai)
        .where(
          and(
            eq(pegawai.jenis, "guru"),
            eq(pegawai.status_aktif, "aktif"),
            isNull(pegawai.deleted_at)
          )
        );
      setGuruList(teachers);
    } catch (e) {
      console.warn("Gagal inisialisasi kelas:", e);
    }
  };

  const loadKelasData = async (taId: string) => {
    try {
      const kList = await db
        .select()
        .from(kelas)
        .where(and(eq(kelas.tahun_ajaran_id, taId), isNull(kelas.deleted_at)));

      const results: KelasWithRelations[] = [];

      for (const k of kList) {
        let waliName = "Belum Ditentukan";
        if (k.wali_kelas_id) {
          const w = await db
            .select()
            .from(pegawai)
            .where(eq(pegawai.id, k.wali_kelas_id))
            .limit(1);
          if (w.length > 0 && w[0]) waliName = w[0].nama_lengkap;
        }

        const countSiswaRes = await db
          .select({ count: sql<number>`count(*)` })
          .from(anggotaKelas)
          .where(
            and(
              eq(anggotaKelas.kelas_id, k.id),
              isNull(anggotaKelas.deleted_at)
            )
          );

        const countPengampuRes = await db
          .select({ count: sql<number>`count(*)` })
          .from(pengampuKelas)
          .where(
            and(
              eq(pengampuKelas.kelas_id, k.id),
              isNull(pengampuKelas.deleted_at)
            )
          );

        results.push({
          ...k,
          waliName,
          totalSiswa: Number(countSiswaRes[0]?.count || 0),
          totalPengampu: Number(countPengampuRes[0]?.count || 0),
        });
      }

      // Urutkan berdasarkan tingkat, kemudian nama rombel
      results.sort((a, b) => {
        if (a.tingkat !== b.tingkat) return a.tingkat - b.tingkat;
        return a.nama.localeCompare(b.nama);
      });

      setClassList(results);
    } catch (e) {
      console.warn("Gagal membaca daftar kelas:", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedTaId) {
      await loadKelasData(selectedTaId);
    }
    setRefreshing(false);
  };

  const handleSelectPeriod = async (ta: TahunAjaran) => {
    setSelectedTaId(ta.id);
    setSelectedTa(ta);
    setTaPickerVisible(false);
    await loadKelasData(ta.id);
  };

  const openAddModal = () => {
    setIsEditing(false);
    setSelectedKelasId(null);
    setFormTingkat(7);
    setFormNama("");
    setFormWaliId(null);
    setModalVisible(true);
  };

  const handleSave = async () => {
    const cleanNama = formNama.trim().toUpperCase();

    if (!cleanNama) {
      showToast("Nama rombel wajib diisi (misal: 7A, 8B).", { type: "error" });
      return;
    }

    if (!selectedTaId) {
      showToast("Pilih tahun ajaran aktif terlebih dahulu.", { type: "error" });
      return;
    }

    setSaving(true);
    const now = getIsoUtcString();

    try {
      // Validasi keunikan nama rombel pada periode yang sama
      const existing = await db
        .select()
        .from(kelas)
        .where(
          and(
            eq(kelas.tahun_ajaran_id, selectedTaId),
            eq(kelas.nama, cleanNama),
            isNull(kelas.deleted_at)
          )
        );

      if (
        existing.length > 0 &&
        (!isEditing || (isEditing && existing[0]?.id !== selectedKelasId))
      ) {
        showToast(`Rombel '${cleanNama}' sudah terdaftar pada periode ini.`, { type: "error" });
        setSaving(false);
        return;
      }

      if (isEditing && selectedKelasId) {
        await db
          .update(kelas)
          .set({
            nama: cleanNama,
            tingkat: formTingkat,
            wali_kelas_id: formWaliId,
            updated_at: now,
            sync_status: "pending_push",
          })
          .where(eq(kelas.id, selectedKelasId));
        showToast("Rombel berhasil diperbarui", { type: "success" });
      } else {
        await db.insert(kelas).values({
          id: generateUUID(),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "pending_push",
          last_synced_at: null,
          version: 1,
          tahun_ajaran_id: selectedTaId,
          nama: cleanNama,
          tingkat: formTingkat,
          wali_kelas_id: formWaliId,
        });
        showToast("Rombel baru berhasil dibuat", { type: "success" });
      }

      await refreshPendingCountAsync();
      setModalVisible(false);
      await loadKelasData(selectedTaId);
    } catch (e: any) {
      showToast(e?.message || "Terjadi kesalahan database", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const now = getIsoUtcString();

      // Soft delete kelas
      await db
        .update(kelas)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
          version: deleteTarget.version + 1,
        })
        .where(eq(kelas.id, deleteTarget.id));

      // Soft delete anggota_kelas terkait
      await db
        .update(anggotaKelas)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
        })
        .where(eq(anggotaKelas.kelas_id, deleteTarget.id));

      // Soft delete pengampu_kelas terkait
      await db
        .update(pengampuKelas)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
        })
        .where(eq(pengampuKelas.kelas_id, deleteTarget.id));

      await refreshPendingCountAsync();
      setDeleteTarget(null);
      showToast(`Kelas ${deleteTarget.nama} berhasil dihapus`, { type: "success" });
      await loadKelasData(selectedTaId);
    } catch (e: any) {
      showToast(e?.message || "Gagal menghapus rombel", { type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const filteredList = useMemo(() => {
    return classList.filter((k) => {
      const matchTingkat =
        selectedTingkat === "Semua" ? true : String(k.tingkat) === selectedTingkat;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        k.nama.toLowerCase().includes(q) ||
        k.waliName.toLowerCase().includes(q);
      return matchTingkat && matchSearch;
    });
  }, [classList, selectedTingkat, searchQuery]);

  // Ringkasan Statistik
  const totalRombel = classList.length;
  const totalSiswaAll = classList.reduce((acc, curr) => acc + curr.totalSiswa, 0);

  const countTingkat7 = useMemo(
    () => classList.filter((k) => k.tingkat === 7).length,
    [classList]
  );
  const countTingkat8 = useMemo(
    () => classList.filter((k) => k.tingkat === 8).length,
    [classList]
  );
  const countTingkat9 = useMemo(
    () => classList.filter((k) => k.tingkat === 9).length,
    [classList]
  );

  const renderItem = useCallback(
    ({ item: k }: { item: KelasWithRelations }) => {
      const avatarBg =
        k.tingkat === 7
          ? colors.primary[50]
          : k.tingkat === 8
          ? "#EEF2FF"
          : colors.accent.goldLight;

      const avatarTextColor =
        k.tingkat === 7
          ? colors.primary[800]
          : k.tingkat === 8
          ? "#3730A3"
          : colors.neutral.textPrimary;

      return (
        <ListItemCard
          title={`Kelas ${k.nama}`}
          subtitle={`Wali: ${k.waliName} • ${k.totalPengampu} Mapel`}
          avatarText={String(k.tingkat)}
          avatarBg={avatarBg}
          avatarTextColor={avatarTextColor}
          rightBadge={
            <Badge
              label={`${k.totalSiswa} Siswa`}
              variant={k.totalSiswa > 0 ? "primary" : "neutral"}
              size="sm"
            />
          }
          onPress={() =>
            router.push({
              pathname: "/(app)/kelas/[id]",
              params: { id: k.id },
            })
          }
        />
      );
    },
    []
  );

  return (
    <AppShell
      title={role === "guru" ? "Kelas Saya" : "Kelas & Rombel"}
      subtitle={selectedTa ? `${selectedTa.nama} (${selectedTa.nama_semester})` : undefined}
      onAdd={isOperator ? openAddModal : undefined}
      addLabel="Tambah Rombel"
      headerChildren={
        <View style={styles.headerSlot}>
          {/* Periode Banner & Switcher Button */}
          <View style={styles.periodBanner}>
            <View style={styles.periodInfo}>
              <View style={styles.periodBadgeRow}>
                <Ionicons name="calendar-outline" size={13} color={colors.primary[700]} />
                <Text style={styles.periodHeaderLabel}>TAHUN AJARAN / SEMESTER</Text>
                {selectedTa?.is_active === 1 && (
                  <Badge label="AKTIF" variant="active" size="sm" />
                )}
              </View>
              <Text style={styles.periodName} numberOfLines={1}>
                {selectedTa ? `${selectedTa.nama} - Semester ${selectedTa.nama_semester}` : "Memuat..."}
              </Text>
            </View>

            {tahunList.length > 1 && (
              <Pressable
                onPress={() => setTaPickerVisible(true)}
                style={({ pressed }) => [
                  styles.changePeriodBtn,
                  pressed && styles.pressedState,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Ganti Tahun Ajaran"
              >
                <Text style={styles.changePeriodText}>Ganti</Text>
                <Ionicons name="swap-horizontal" size={14} color={colors.primary[700]} />
              </Pressable>
            )}
          </View>

          {/* SearchBar */}
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari rombel atau wali kelas..."
          />

          {/* Filter Chips Tingkat */}
          <FilterChipGroup>
            <FilterChip
              label={`Semua (${classList.length})`}
              selected={selectedTingkat === "Semua"}
              onPress={() => setSelectedTingkat("Semua")}
            />
            <FilterChip
              label={`Kelas 7 (${countTingkat7})`}
              selected={selectedTingkat === "7"}
              onPress={() => setSelectedTingkat("7")}
            />
            <FilterChip
              label={`Kelas 8 (${countTingkat8})`}
              selected={selectedTingkat === "8"}
              onPress={() => setSelectedTingkat("8")}
            />
            <FilterChip
              label={`Kelas 9 (${countTingkat9})`}
              selected={selectedTingkat === "9"}
              onPress={() => setSelectedTingkat("9")}
            />
          </FilterChipGroup>

          {/* Ringkasan Angka */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              Total: <Text style={styles.summaryBold}>{totalRombel} Rombel</Text> •{" "}
              <Text style={styles.summaryBold}>{totalSiswaAll} Siswa Terdaftar</Text>
            </Text>
          </View>
        </View>
      }
    >
      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[600]}
          />
        }
        ListEmptyComponent={
          searchQuery.trim().length > 0 ? (
            <EmptyState
              icon="search-outline"
              title="Rombel Tidak Ditemukan"
              message={`Tidak ada rombel yang cocok dengan kata kunci "${searchQuery}".`}
              actionLabel="Reset Pencarian"
              onAction={() => setSearchQuery("")}
            />
          ) : (
            <EmptyState
              icon="school-outline"
              title="Belum Ada Rombel"
              message="Belum ada rombel kelas yang terdaftar pada periode tahun ajaran ini."
              actionLabel={isOperator ? "+ Tambah Rombel Baru" : undefined}
              onAction={isOperator ? openAddModal : undefined}
            />
          )
        }
      />

      {/* FAB Tambah Rombel (Hanya mobile < 768px untuk Super Admin / Staf TU) */}
      {isOperator && (
        <FAB
          onPress={openAddModal}
          accessibilityLabel="Tambah Rombel Baru"
        />
      )}

      {/* Modal Tambah / Edit Rombel Kelas */}
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
                  {isEditing ? "Edit Rombel Kelas" : "Tambah Rombel Kelas"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Periode: {selectedTa?.nama} ({selectedTa?.nama_semester})
                </Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup modal"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Tingkat Kelas */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Tingkat Kelas</Text>
                <View style={styles.tingkatSelector}>
                  {([7, 8, 9] as const).map((t) => {
                    const isSelected = formTingkat === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setFormTingkat(t)}
                        style={({ pressed }) => [
                          styles.tingkatBtn,
                          isSelected && styles.tingkatBtnSelected,
                          pressed && styles.pressedState,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text
                          style={[
                            styles.tingkatBtnText,
                            isSelected && styles.tingkatBtnTextSelected,
                          ]}
                        >
                          Kelas {t}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Nama Rombel */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nama Rombel (Contoh: 7A, 8B, 9 Unggulan)</Text>
                <TextInput
                  value={formNama}
                  onChangeText={(val) => setFormNama(val.toUpperCase())}
                  placeholder="Misal: 7A"
                  style={styles.input}
                  maxLength={15}
                  autoCapitalize="characters"
                  placeholderTextColor={colors.neutral.textMuted}
                />
              </View>

              {/* Wali Kelas Selector */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Pilih Wali Kelas (Guru Aktif)</Text>
                <ScrollView
                  style={styles.teacherScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={true}
                >
                  <Pressable
                    onPress={() => setFormWaliId(null)}
                    style={({ pressed }) => [
                      styles.teacherItem,
                      formWaliId === null && styles.teacherItemSelected,
                      pressed && styles.pressedState,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: formWaliId === null }}
                  >
                    <Ionicons
                      name="remove-circle-outline"
                      size={18}
                      color={formWaliId === null ? colors.primary[700] : colors.neutral.textMuted}
                    />
                    <Text
                      style={[
                        styles.teacherItemText,
                        formWaliId === null && styles.teacherItemTextSelected,
                      ]}
                    >
                      (Belum Ditentukan)
                    </Text>
                  </Pressable>

                  {guruList.map((g) => {
                    const isSelected = formWaliId === g.id;
                    return (
                      <Pressable
                        key={g.id}
                        onPress={() => setFormWaliId(g.id)}
                        style={({ pressed }) => [
                          styles.teacherItem,
                          isSelected && styles.teacherItemSelected,
                          pressed && styles.pressedState,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Ionicons
                          name="person-outline"
                          size={18}
                          color={isSelected ? colors.primary[700] : colors.neutral.textMuted}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.teacherItemText,
                              isSelected && styles.teacherItemTextSelected,
                            ]}
                          >
                            {g.nama_lengkap}
                          </Text>
                          {g.nip && (
                            <Text style={styles.teacherSubtext}>NIP: {g.nip}</Text>
                          )}
                        </View>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color={colors.primary[700]}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
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
              {isEditing && role === "super_admin" && (
                <ModernButton
                  title="Hapus"
                  variant="danger"
                  size="md"
                  onPress={() => {
                    const current = classList.find((c) => c.id === selectedKelasId);
                    if (current) {
                      setModalVisible(false);
                      setDeleteTarget(current);
                    }
                  }}
                  style={{ flex: 1 }}
                />
              )}
              <ModernButton
                title={saving ? "Menyimpan..." : isEditing ? "Simpan" : "Simpan Rombel"}
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

      {/* Modal Switch Periode Akademik */}
      <Modal visible={taPickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Pilih Periode Tahun Ajaran</Text>
                <Text style={styles.modalSubtitle}>
                  Tampilkan rombel berdasarkan periode akademik
                </Text>
              </View>
              <Pressable
                onPress={() => setTaPickerVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog periode"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
              {tahunList.map((ta) => {
                const isSelected = selectedTaId === ta.id;
                return (
                  <Pressable
                    key={ta.id}
                    onPress={() => handleSelectPeriod(ta)}
                    style={({ pressed }) => [
                      styles.taPickItem,
                      isSelected && styles.taPickItemSelected,
                      pressed && styles.pressedState,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text
                          style={[
                            styles.taPickTitle,
                            isSelected && styles.taPickTitleSelected,
                          ]}
                        >
                          {ta.nama} - Semester {ta.nama_semester}
                        </Text>
                        {ta.is_active === 1 && (
                          <Badge label="AKTIF" variant="active" size="sm" />
                        )}
                      </View>
                      <Text style={styles.taPickSubtitle}>
                        {ta.tanggal_mulai} s/d {ta.tanggal_selesai}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.primary[700]}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title="Hapus Rombel Kelas"
        message={
          deleteTarget
            ? `Apakah Anda yakin ingin menghapus Kelas ${deleteTarget.nama}?${
                deleteTarget.totalSiswa > 0
                  ? `\n\nPerhatian: Terdapat ${deleteTarget.totalSiswa} siswa terdaftar di kelas ini.`
                  : ""
              }`
            : ""
        }
        confirmLabel="Hapus Rombel"
        variant="danger"
        loading={deleting}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  headerSlot: {
    gap: 8,
    paddingTop: 4,
  },
  listContent: {
    padding: spacing.screen,
    paddingBottom: 80,
  },
  periodBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  periodInfo: {
    flex: 1,
  },
  periodBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  periodHeaderLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary[700],
    letterSpacing: 0.5,
  },
  periodName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  changePeriodBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.neutral.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primary[200],
    minHeight: 36,
  },
  changePeriodText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary[700],
  },
  summaryRow: {
    paddingVertical: 2,
  },
  summaryText: {
    fontSize: 12,
    color: colors.neutral.textMuted,
  },
  summaryBold: {
    fontWeight: "700",
    color: colors.neutral.textSecondary,
  },
  pressedState: {
    opacity: 0.7,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.card,
    padding: spacing.xl,
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
    fontSize: 18,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.neutral.canvas,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 14,
    color: colors.neutral.textPrimary,
    minHeight: 48,
  },
  tingkatSelector: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tingkatBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.button,
    backgroundColor: colors.neutral.canvas,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  tingkatBtnSelected: {
    backgroundColor: colors.primary[700],
    borderColor: colors.primary[700],
  },
  tingkatBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
  },
  tingkatBtnTextSelected: {
    color: colors.neutral.white,
  },
  teacherScroll: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: radius.card,
    backgroundColor: colors.neutral.canvas,
  },
  teacherItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.borderSubtle,
    minHeight: 48,
  },
  teacherItemSelected: {
    backgroundColor: colors.primary[50],
  },
  teacherItemText: {
    fontSize: 13,
    color: colors.neutral.textPrimary,
    fontWeight: "600",
  },
  teacherItemTextSelected: {
    color: colors.primary[800],
    fontWeight: "700",
  },
  teacherSubtext: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 1,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
    paddingTop: spacing.md,
  },
  taPickItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.canvas,
    marginBottom: spacing.sm,
    minHeight: 48,
  },
  taPickItemSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[400],
  },
  taPickTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  taPickTitleSelected: {
    color: colors.primary[800],
  },
  taPickSubtitle: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
});