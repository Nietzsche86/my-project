import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Alert,
} from "react-native";
import { colors, radius, spacing } from "../../../theme";
import { AppShell } from "../../../components/layout/AppShell";
import {
  ListItemCard,
  BottomSheetPicker,
  SyncCard,
  EmptyState,
  StickyFooterButton,
  FAB,
  HeaderAddButton,
  SegmentedTabs,
  StatCard,
  QuickAction,
  SearchBar,
  FilterChip,
  FilterChipGroup,
  FormSection,
  ConfirmDialog,
  useToast,
  Badge,
} from "../../../components/ui";
import { Ionicons } from "@expo/vector-icons";

export default function DevComponentsScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { showToast } = useToast();

  // BottomSheetPicker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedMapel, setSelectedMapel] = useState<string>("mapel-1");

  // SearchBar & FilterChip state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");

  // SegmentedTabs state
  const [activeTab, setActiveTab] = useState("siswa");

  // ConfirmDialog state
  const [confirmOpen, setConfirmOpen] = useState(false);

  // SyncCard test state
  const [syncCardState, setSyncCardState] = useState<
    "idle" | "syncing" | "error" | "offline" | "conflict"
  >("idle");

  const dummyMapel = [
    { id: "mapel-1", label: "Al-Qur'an Hadits", subtitle: "PAI - 2 Jam/Minggu" },
    { id: "mapel-2", label: "Akidah Akhlak", subtitle: "PAI - 2 Jam/Minggu" },
    { id: "mapel-3", label: "Fiqih", subtitle: "PAI - 2 Jam/Minggu" },
    { id: "mapel-4", label: "Sejarah Kebudayaan Islam", subtitle: "PAI - 2 Jam/Minggu" },
    { id: "mapel-5", label: "Bahasa Arab", subtitle: "Bahasa - 3 Jam/Minggu" },
    { id: "mapel-6", label: "Matematika", subtitle: "Umum - 4 Jam/Minggu" },
    { id: "mapel-7", label: "Bahasa Indonesia", subtitle: "Umum - 4 Jam/Minggu" },
  ];

  return (
    <AppShell
      title="Uji Komponen UI (Bagian 14)"
      subtitle="Verifikasi Checksheet Komponen Reusable"
      showBack
      onAdd={() => showToast("Tombol HeaderAddButton diklik!")}
      addLabel="Tambah Item"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section 1: FAB / HeaderAddButton */}
        <FormSection
          title="1. FAB & HeaderAddButton (Checksheet 6)"
          description={`Mode Layar: ${isDesktop ? "Layar Lebar (Desktop/Web)" : "HP Mobile (< 768px)"}`}
        >
          <Text style={styles.noteText}>
            {isDesktop
              ? "✓ HeaderAddButton tampil di kanan atas header. FAB disembunyikan otomatis."
              : "✓ FAB tampil di pojok kanan bawah dengan bottom: 16. HeaderAddButton disembunyikan."}
          </Text>
        </FormSection>

        {/* Section 2: ListItemCard */}
        <FormSection
          title="2. ListItemCard (Checksheet 1)"
          description="State: Default, Pressed, Loading (Skeleton)"
        >
          <Text style={styles.subHeading}>Default State:</Text>
          <ListItemCard
            title="Ahmad Fauzan Syahputra"
            subtitle="NISN: 0081293847 • Kelas 7A (Ganjil)"
            avatarText="AF"
            rightBadge={<Badge label="Aktif" variant="synced" size="sm" />}
            onPress={() => showToast("ListItemCard ditekan!")}
          />

          <Text style={styles.subHeading}>Loading State (Skeleton):</Text>
          <ListItemCard
            title=""
            subtitle=""
            loading={true}
            onPress={() => {}}
          />
        </FormSection>

        {/* Section 3: SyncCard */}
        <FormSection
          title="3. SyncCard (Checksheet 3)"
          description="State: Idle, Syncing, Error, Offline, Conflict"
        >
          <SegmentedTabs
            tabs={[
              { key: "idle", label: "Idle" },
              { key: "syncing", label: "Syncing" },
              { key: "error", label: "Error" },
              { key: "offline", label: "Offline" },
              { key: "conflict", label: "Conflict" },
            ]}
            activeKey={syncCardState}
            onChange={(k) => setSyncCardState(k as any)}
            scrollable
          />

          <View style={{ marginTop: 12 }}>
            <SyncCard
              forcedState={syncCardState}
              forcedPending={syncCardState === "conflict" ? 3 : syncCardState === "idle" ? 2 : 0}
              onSuccessMessage={(m) => showToast(m)}
              onErrorMessage={(m) => showToast(m, { type: "error" })}
            />
          </View>
        </FormSection>

        {/* Section 4: BottomSheetPicker */}
        <FormSection
          title="4. BottomSheetPicker (Checksheet 2)"
          description="State: Open, Close, Search aktif, Hasil kosong. Fokus hanya saat diketuk."
        >
          <ListItemCard
            title="Pilih Mata Pelajaran"
            subtitle={
              dummyMapel.find((m) => m.id === selectedMapel)?.label || "Belum dipilih"
            }
            avatarIcon="book-outline"
            onPress={() => setPickerOpen(true)}
          />

          <BottomSheetPicker
            visible={pickerOpen}
            title="Pilih Mata Pelajaran"
            items={dummyMapel}
            selectedId={selectedMapel}
            onSelect={(item) => {
              setSelectedMapel(item.id);
              showToast(`Dipilih: ${item.label}`);
            }}
            onClose={() => setPickerOpen(false)}
          />
        </FormSection>

        {/* Section 5: EmptyState */}
        <FormSection
          title="5. EmptyState (Checksheet 4)"
          description="State: Data Kosong vs Pencarian Nihil"
        >
          <Text style={styles.subHeading}>Kondisi 1: Data Kosong (dengan tombol tambah)</Text>
          <EmptyState
            type="empty"
            title="Belum Ada Arsip Surat"
            message="Klik tombol di bawah untuk membuat surat keluar baru."
            actionLabel="Buat Surat Baru"
            canPerformAction={true}
            onAction={() => showToast("Aksi Tambah Surat!")}
          />

          <Text style={styles.subHeading}>Kondisi 2: Pencarian Nihil</Text>
          <EmptyState
            type="search_empty"
            title="Siswa Tidak Ditemukan"
            message="Tidak ada siswa yang cocok dengan filter atau kata kunci pencarian."
            canPerformAction={false}
          />
        </FormSection>

        {/* Section 6: StickyFooterButton */}
        <FormSection
          title="6. StickyFooterButton (Checksheet 5)"
          description="State: Normal, Disabled, Loading. Mengikuti lebar max-w-4xl di desktop."
        >
          <View style={styles.stickyDemoCard}>
            <Text style={styles.subHeading}>Demonstrasi Varian Tombol Footer:</Text>
            <StickyFooterButton
              title="Simpan (Normal)"
              onPress={() => showToast("Tombol Simpan ditekan!")}
              secondaryTitle="Batal"
              onSecondaryPress={() => showToast("Batal ditekan")}
            />
          </View>
        </FormSection>

        {/* Section 7: SearchBar, FilterChips, SegmentedTabs */}
        <FormSection
          title="7. Komponen Pendukung Input & Navigasi"
          description="SearchBar, FilterChip horizontal, SegmentedTabs"
        >
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari nama siswa atau NISN..."
          />

          <FilterChipGroup style={{ marginTop: 8 }}>
            <FilterChip
              label="Semua Kelas"
              selected={selectedFilter === "all"}
              onPress={() => setSelectedFilter("all")}
            />
            <FilterChip
              label="Kelas 7"
              count={32}
              selected={selectedFilter === "7"}
              onPress={() => setSelectedFilter("7")}
            />
            <FilterChip
              label="Kelas 8"
              count={28}
              selected={selectedFilter === "8"}
              onPress={() => setSelectedFilter("8")}
            />
            <FilterChip
              label="Kelas 9"
              count={30}
              selected={selectedFilter === "9"}
              onPress={() => setSelectedFilter("9")}
            />
          </FilterChipGroup>

          <SegmentedTabs
            tabs={[
              { key: "siswa", label: "Siswa Aktif", badge: 90 },
              { key: "alumni", label: "Alumni & Mutasi" },
              { key: "pegawai", label: "Guru & Tendik", badge: 14 },
            ]}
            activeKey={activeTab}
            onChange={setActiveTab}
            style={{ marginTop: 12 }}
          />
        </FormSection>

        {/* Section 8: StatCard & QuickAction */}
        <FormSection title="8. StatCard & QuickAction" description="Grid 2 Kolom & Grid 4 Aksi Cepat">
          <View style={styles.statGrid}>
            <StatCard
              title="Siswa Aktif"
              value="90"
              subtitle="Rombel 7A, 8A, 9A"
              icon={<Ionicons name="people" size={18} color={colors.primary[700]} />}
            />
            <StatCard
              title="Guru & Tendik"
              value="14"
              subtitle="Pendidik Madrasah"
              icon={<Ionicons name="id-card" size={18} color={colors.primary[700]} />}
            />
          </View>

          <QuickAction
            items={[
              {
                id: "1",
                label: "Tambah Siswa",
                icon: "person-add-outline",
                onPress: () => showToast("Aksi Tambah Siswa"),
              },
              {
                id: "2",
                label: "Surat Keluar",
                icon: "mail-outline",
                onPress: () => showToast("Aksi Surat Keluar"),
              },
              {
                id: "3",
                label: "Cetak Absensi",
                icon: "print-outline",
                onPress: () => showToast("Aksi Cetak Absensi"),
              },
              {
                id: "4",
                label: "Dialog Hapus",
                icon: "trash-outline",
                iconColor: colors.status.conflict,
                iconBg: colors.status.conflictBg,
                onPress: () => setConfirmOpen(true),
              },
            ]}
          />
        </FormSection>
      </ScrollView>

      {/* FAB (Hanya tampil di HP mobile < 768px) */}
      <FAB
        onPress={() => showToast("FAB (+ Tambah) ditekan!")}
        accessibilityLabel="Tambah Data Cepat"
      />

      {/* ConfirmDialog */}
      <ConfirmDialog
        visible={confirmOpen}
        title="Hapus Data Ini?"
        message="Data siswa yang dihapus akan dipindahkan ke arsip dan diberi penanda deleted_at."
        variant="danger"
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        onConfirm={() => {
          setConfirmOpen(false);
          showToast("Data berhasil dihapus.", { type: "info" });
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  subHeading: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textSmall,
    marginTop: 8,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: colors.neutral.textSecondary,
    lineHeight: 18,
  },
  stickyDemoCard: {
    backgroundColor: colors.neutral.canvas,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  statGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
});
