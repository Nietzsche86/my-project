import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  FlatList,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { colors, radius, radii, shadows, spacing } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { useSync } from "../../../context/SyncContext";
import { useAlert } from "../../../context/AlertContext";
import { AppShell } from "../../../components/layout/AppShell";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { Badge } from "../../../components/ui/Badge";
import {
  SegmentedTabs,
  TabOption,
  EmptyState,
} from "../../../components/ui";
import { db } from "../../../db/client";
import {
  siswa,
  pegawai,
  suratMasuk,
  suratKeluar,
  logEksport,
  kelas,
  pengampuKelas,
  users,
  type LogEksport,
} from "../../../db/schema";
import { isNull, and, eq, desc } from "drizzle-orm";
import { Ionicons } from "@expo/vector-icons";
import {
  exportSiswaToExcel,
  exportPegawaiToExcel,
  exportSuratToExcel,
  downloadTemplateImportSiswa,
  downloadTemplateImportPegawai,
  importSiswaFromExcel,
  importPegawaiFromExcel,
  type ImportReport,
} from "../../../utils/excelManager";

type AuditLogItem = LogEksport & { userName?: string | null };

export default function DataIoScreen() {
  const { role, user, pegawaiData } = useAuth();
  const { refreshPendingCountAsync } = useSync();
  const { showAlert } = useAlert();

  const isOperator = role === "super_admin" || role === "staf_tu";
  const isSuperAdmin = role === "super_admin";

  const [activeTab, setActiveTab] = useState<"export" | "import" | "audit">("export");
  const [refreshing, setRefreshing] = useState(false);

  // Counts
  const [siswaCount, setSiswaCount] = useState(0);
  const [pegawaiCount, setPegawaiCount] = useState(0);
  const [suratMasukCount, setSuratMasukCount] = useState(0);
  const [suratKeluarCount, setSuratKeluarCount] = useState(0);
  const [teacherClassIds, setTeacherClassIds] = useState<string[]>([]);

  // Export Loading States
  const [exportingSiswa, setExportingSiswa] = useState(false);
  const [exportingPegawai, setExportingPegawai] = useState(false);
  const [exportingSuratMasuk, setExportingSuratMasuk] = useState(false);
  const [exportingSuratKeluar, setExportingSuratKeluar] = useState(false);

  // Import State
  const [importTarget, setImportTarget] = useState<"siswa" | "pegawai">("siswa");
  const [importMode, setImportMode] = useState<"skip" | "update">("skip");
  const [selectedFileUri, setSelectedFileUri] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [processingImport, setProcessingImport] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  useEffect(() => {
    loadCountsAndData();
  }, [activeTab]);

  const loadCountsAndData = async () => {
    try {
      // 1. Siswa Aktif
      const sRes = await db
        .select({ id: siswa.id })
        .from(siswa)
        .where(and(eq(siswa.status, "aktif"), isNull(siswa.deleted_at)));
      setSiswaCount(sRes.length);

      // 2. Pegawai
      const pRes = await db
        .select({ id: pegawai.id })
        .from(pegawai)
        .where(isNull(pegawai.deleted_at));
      setPegawaiCount(pRes.length);

      // 3. Surat
      const smRes = await db
        .select({ id: suratMasuk.id })
        .from(suratMasuk)
        .where(isNull(suratMasuk.deleted_at));
      setSuratMasukCount(smRes.length);

      const skRes = await db.select({ id: suratKeluar.id }).from(suratKeluar);
      setSuratKeluarCount(skRes.length);

      // 4. Jika Guru, cari kelas yang diampu / diwalikan
      if (role === "guru" && pegawaiData?.id) {
        const wali = await db
          .select({ id: kelas.id })
          .from(kelas)
          .where(and(eq(kelas.wali_kelas_id, pegawaiData.id), isNull(kelas.deleted_at)));
        const pengampu = await db
          .select({ id: pengampuKelas.kelas_id })
          .from(pengampuKelas)
          .where(and(eq(pengampuKelas.pegawai_id, pegawaiData.id), isNull(pengampuKelas.deleted_at)));
        const setIds = new Set<string>();
        wali.forEach((w) => setIds.add(w.id));
        pengampu.forEach((p) => setIds.add(p.id));
        setTeacherClassIds(Array.from(setIds));
      }

      // 5. Audit Log (Khusus Super Admin)
      if (activeTab === "audit" && isSuperAdmin) {
        const logs = await db
          .select({
            id: logEksport.id,
            created_at: logEksport.created_at,
            updated_at: logEksport.updated_at,
            deleted_at: logEksport.deleted_at,
            sync_status: logEksport.sync_status,
            last_synced_at: logEksport.last_synced_at,
            version: logEksport.version,
            user_id: logEksport.user_id,
            jenis_data: logEksport.jenis_data,
            filter: logEksport.filter,
            jumlah_baris: logEksport.jumlah_baris,
            nama_file: logEksport.nama_file,
            ip_address: logEksport.ip_address,
            userName: users.name,
          })
          .from(logEksport)
          .leftJoin(users, eq(logEksport.user_id, users.id))
          .orderBy(desc(logEksport.created_at))
          .limit(50);

        setAuditLogs(logs);
      }
    } catch (e) {
      console.warn("Gagal memuat metrik data:", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCountsAndData();
    setRefreshing(false);
  };

  // --- ACTIONS: EXPORT ---
  const handleExportSiswa = async () => {
    setExportingSiswa(true);
    const res = await exportSiswaToExcel({
      role,
      userId: user?.id,
      teacherClassIds,
    });
    setExportingSiswa(false);
    showAlert({
      title: res.success ? "Eksport Selesai" : "Gagal Eksport",
      message: res.message,
      type: res.success ? "success" : "error",
    });
  };

  const handleExportPegawai = async () => {
    setExportingPegawai(true);
    const res = await exportPegawaiToExcel({ userId: user?.id });
    setExportingPegawai(false);
    showAlert({
      title: res.success ? "Eksport Selesai" : "Gagal Eksport",
      message: res.message,
      type: res.success ? "success" : "error",
    });
  };

  const handleExportSuratMasuk = async () => {
    setExportingSuratMasuk(true);
    const res = await exportSuratToExcel({ userId: user?.id, jenis: "masuk" });
    setExportingSuratMasuk(false);
    showAlert({
      title: res.success ? "Eksport Selesai" : "Gagal Eksport",
      message: res.message,
      type: res.success ? "success" : "error",
    });
  };

  const handleExportSuratKeluar = async () => {
    setExportingSuratKeluar(true);
    const res = await exportSuratToExcel({ userId: user?.id, jenis: "keluar" });
    setExportingSuratKeluar(false);
    showAlert({
      title: res.success ? "Eksport Selesai" : "Gagal Eksport",
      message: res.message,
      type: res.success ? "success" : "error",
    });
  };

  // --- ACTIONS: IMPORT ---
  const pickImportFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
        ],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets[0]) {
        setSelectedFileUri(res.assets[0].uri);
        setSelectedFileName(res.assets[0].name);
      }
    } catch (e) {
      console.warn("Gagal memilih file Excel:", e);
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedFileUri) {
      showAlert({
        title: "Pilih File",
        message: "Pilih file Excel (.xlsx) terlebih dahulu.",
        type: "warning",
      });
      return;
    }

    setProcessingImport(true);
    try {
      let rep: ImportReport;
      if (importTarget === "siswa") {
        rep = await importSiswaFromExcel(selectedFileUri, importMode);
      } else {
        rep = await importPegawaiFromExcel(selectedFileUri, importMode);
      }

      await refreshPendingCountAsync();
      setImportReport(rep);
      setReportModalVisible(true);
      setSelectedFileUri(null);
      setSelectedFileName(null);
      await loadCountsAndData();
    } catch (e: any) {
      showAlert({
        title: "Gagal Mengimpor",
        message: e?.message || "Terjadi kesalahan proses file.",
        type: "error",
      });
    } finally {
      setProcessingImport(false);
    }
  };

  const ioTabs: TabOption[] = useMemo(() => {
    const tabs: TabOption[] = [{ key: "export", label: "Eksport Excel" }];
    if (isOperator) {
      tabs.push({ key: "import", label: "Import Excel" });
    }
    if (isSuperAdmin) {
      tabs.push({ key: "audit", label: "Log Audit", badge: auditLogs.length });
    }
    return tabs;
  }, [isOperator, isSuperAdmin, auditLogs.length]);

  return (
    <AppShell
      title="Eksport & Import Data"
      showBack
      headerChildren={
        <View style={styles.headerSlot}>
          <SegmentedTabs
            tabs={ioTabs}
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as "export" | "import" | "audit")}
          />
        </View>
      }
    >
      {/* If activeTab is audit, render virtualized FlatList */}
      {activeTab === "audit" && isSuperAdmin ? (
        <FlatList<AuditLogItem>
          data={auditLogs}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.sm }}>
              <View style={styles.infoBanner}>
                <Ionicons name="shield-checkmark" size={18} color={colors.primary[700]} />
                <Text style={styles.infoBannerText}>
                  Catatan audit log mencatat seluruh aktivitas pengunduhan data sensitif madrasah oleh
                  pengguna demi menjaga kepatuhan privasi dan rekam jejak sistem.
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <ModernCard style={styles.logCard}>
              <View style={styles.logHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Badge label={item.jenis_data.toUpperCase()} variant="primary" size="sm" />
                  <Badge
                    label={item.sync_status === "synced" ? "SYNCED" : "PENDING"}
                    variant={item.sync_status === "synced" ? "synced" : "pending"}
                    size="sm"
                  />
                </View>
                <Text style={styles.logDate}>{item.created_at.slice(0, 16).replace("T", " ")}</Text>
              </View>

              <Text style={styles.logFileName}>📁 {item.nama_file}</Text>
              <View style={styles.logMetaRow}>
                <Text style={styles.logMeta}>User: {item.userName || "Petugas TU"}</Text>
                <Text style={styles.logMeta}>•</Text>
                <Text style={styles.logMeta}>Baris: {item.jumlah_baris} entri</Text>
              </View>
            </ModernCard>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="Belum Ada Aktivitas Eksport"
              message="Aktivitas pengunduhan data akan tercatat secara otomatis di sini."
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
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        >
          {/* ================= TAB 1: EKSPORT DATA ================= */}
          {activeTab === "export" && (
            <View style={styles.tabContent}>
              <View style={styles.infoBanner}>
                <Ionicons name="information-circle" size={18} color={colors.primary[700]} />
                <Text style={styles.infoBannerText}>
                  Eksport data berjalan 100% offline langsung dari database SQLite perangkat ke file
                  spreadsheet Excel (.xlsx). Setiap aktivitas eksport otomatis tercatat di log audit.
                </Text>
              </View>

              {/* 1. Siswa Aktif Card */}
              <ModernCard style={styles.exportCard}>
                <View style={styles.exportRow}>
                  <View style={styles.iconBoxEmerald}>
                    <Ionicons name="people" size={24} color={colors.primary[700]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exportTitle}>Database Siswa Aktif</Text>
                    <Text style={styles.exportSub}>
                      {role === "guru"
                        ? "Mengeksport siswa di rombel yang Anda ampu (kolom sensitif disensor)"
                        : `Total ${siswaCount} siswa aktif terdaftar di madrasah`}
                    </Text>
                  </View>
                </View>

                <View style={styles.exportFooter}>
                  <ModernButton
                    title={exportingSiswa ? "Membuat File..." : "Unduh Excel Siswa (.xlsx)"}
                    variant="primary"
                    size="sm"
                    onPress={handleExportSiswa}
                    loading={exportingSiswa}
                    icon={<Ionicons name="download-outline" size={16} color={colors.neutral.white} />}
                  />
                </View>
              </ModernCard>

              {/* 2. Pegawai Card (Admin & TU) */}
              {isOperator && (
                <ModernCard style={styles.exportCard}>
                  <View style={styles.exportRow}>
                    <View style={styles.iconBoxGold}>
                      <Ionicons name="id-card" size={24} color={colors.accent.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exportTitle}>Direktori Guru & Tendik (PTK)</Text>
                      <Text style={styles.exportSub}>
                        Total {pegawaiCount} guru & staf tata usaha lengkap dengan atribut EMIS Kemenag
                      </Text>
                    </View>
                  </View>

                  <View style={styles.exportFooter}>
                    <ModernButton
                      title={exportingPegawai ? "Membuat File..." : "Unduh Excel Pegawai (.xlsx)"}
                      variant="secondary"
                      size="sm"
                      onPress={handleExportPegawai}
                      loading={exportingPegawai}
                      icon={<Ionicons name="download-outline" size={16} color={colors.primary[700]} />}
                    />
                  </View>
                </ModernCard>
              )}

              {/* 3. Surat Keluar Card (Admin & TU) */}
              {isOperator && (
                <ModernCard style={styles.exportCard}>
                  <View style={styles.exportRow}>
                    <View style={styles.iconBoxBlue}>
                      <Ionicons name="paper-plane" size={24} color={colors.primary[600]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exportTitle}>Buku Agenda Surat Keluar</Text>
                      <Text style={styles.exportSub}>
                        Total {suratKeluarCount} surat keluar (Metode 1: Surat aktif & dibatalkan)
                      </Text>
                    </View>
                  </View>

                  <View style={styles.exportFooter}>
                    <ModernButton
                      title={exportingSuratKeluar ? "Membuat File..." : "Unduh Surat Keluar (.xlsx)"}
                      variant="outline"
                      size="sm"
                      onPress={handleExportSuratKeluar}
                      loading={exportingSuratKeluar}
                      icon={<Ionicons name="download-outline" size={16} color={colors.primary[700]} />}
                    />
                  </View>
                </ModernCard>
              )}

              {/* 4. Surat Masuk Card (Admin & TU) */}
              {isOperator && (
                <ModernCard style={styles.exportCard}>
                  <View style={styles.exportRow}>
                    <View style={styles.iconBoxTeal}>
                      <Ionicons name="file-tray-full" size={24} color={colors.accent.teal} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exportTitle}>Buku Agenda Surat Masuk</Text>
                      <Text style={styles.exportSub}>
                        Total {suratMasukCount} surat masuk yang telah dicatat dan terverifikasi
                      </Text>
                    </View>
                  </View>

                  <View style={styles.exportFooter}>
                    <ModernButton
                      title={exportingSuratMasuk ? "Membuat File..." : "Unduh Surat Masuk (.xlsx)"}
                      variant="outline"
                      size="sm"
                      onPress={handleExportSuratMasuk}
                      loading={exportingSuratMasuk}
                      icon={<Ionicons name="download-outline" size={16} color={colors.primary[700]} />}
                    />
                  </View>
                </ModernCard>
              )}
            </View>
          )}

          {/* ================= TAB 2: IMPORT EXCEL ================= */}
          {activeTab === "import" && isOperator && (
            <View style={styles.tabContent}>
              {/* Bagian 1: Download Template Resmi */}
              <ModernCard style={styles.importSectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="document-text-outline" size={20} color={colors.primary[700]} />
                  <Text style={styles.sectionHeaderTitle}>1. Unduh Format Template Resmi</Text>
                </View>
                <Text style={styles.sectionHeaderSub}>
                  Gunakan template resmi agar nama kolom cocok dengan skema database lokal madrasah:
                </Text>

                <View style={styles.templateBtnRow}>
                  <Pressable
                    style={({ pressed }) => [styles.templateBtn, pressed && styles.pressedState]}
                    onPress={downloadTemplateImportSiswa}
                    accessibilityRole="button"
                    accessibilityLabel="Unduh Template Siswa"
                  >
                    <Ionicons name="download" size={16} color={colors.primary[700]} />
                    <Text style={styles.templateBtnText}>Template Siswa (.xlsx)</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.templateBtn, pressed && styles.pressedState]}
                    onPress={downloadTemplateImportPegawai}
                    accessibilityRole="button"
                    accessibilityLabel="Unduh Template Pegawai"
                  >
                    <Ionicons name="download" size={16} color={colors.accent.gold} />
                    <Text style={[styles.templateBtnText, { color: colors.accent.gold }]}>
                      Template Pegawai (.xlsx)
                    </Text>
                  </Pressable>
                </View>
              </ModernCard>

              {/* Bagian 2: Unggah & Proses File */}
              <ModernCard style={styles.importSectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="cloud-upload-outline" size={20} color={colors.primary[700]} />
                  <Text style={styles.sectionHeaderTitle}>2. Unggah & Proses Berkas Excel</Text>
                </View>

                {/* Target Data Selector */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Pilih Target Data yang Diimpor:</Text>
                  <View style={styles.targetRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.targetBtn,
                        importTarget === "siswa" && styles.targetBtnActive,
                        pressed && styles.pressedState,
                      ]}
                      onPress={() => setImportTarget("siswa")}
                      accessibilityRole="button"
                      accessibilityLabel="Target data siswa"
                    >
                      <Ionicons
                        name="people-outline"
                        size={18}
                        color={importTarget === "siswa" ? colors.primary[700] : colors.neutral.textMuted}
                      />
                      <Text
                        style={[
                          styles.targetBtnText,
                          importTarget === "siswa" && styles.targetBtnTextActive,
                        ]}
                      >
                        Data Siswa
                      </Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.targetBtn,
                        importTarget === "pegawai" && styles.targetBtnActive,
                        pressed && styles.pressedState,
                      ]}
                      onPress={() => setImportTarget("pegawai")}
                      accessibilityRole="button"
                      accessibilityLabel="Target data pegawai"
                    >
                      <Ionicons
                        name="id-card-outline"
                        size={18}
                        color={importTarget === "pegawai" ? colors.primary[700] : colors.neutral.textMuted}
                      />
                      <Text
                        style={[
                          styles.targetBtnText,
                          importTarget === "pegawai" && styles.targetBtnTextActive,
                        ]}
                      >
                        Data Pegawai
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Mode Penanganan Duplikasi */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Opsi Penanganan Data Duplikat (NISN/NUPTK/NIP):</Text>
                  <View style={styles.targetRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.targetBtn,
                        importMode === "skip" && styles.targetBtnActive,
                        pressed && styles.pressedState,
                      ]}
                      onPress={() => setImportMode("skip")}
                      accessibilityRole="button"
                      accessibilityLabel="Lewati data duplikat"
                    >
                      <Text
                        style={[
                          styles.targetBtnText,
                          importMode === "skip" && styles.targetBtnTextActive,
                        ]}
                      >
                        Lewati (Jangan Timpa)
                      </Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.targetBtn,
                        importMode === "update" && styles.targetBtnActive,
                        pressed && styles.pressedState,
                      ]}
                      onPress={() => setImportMode("update")}
                      accessibilityRole="button"
                      accessibilityLabel="Perbarui data lama"
                    >
                      <Text
                        style={[
                          styles.targetBtnText,
                          importMode === "update" && styles.targetBtnTextActive,
                        ]}
                      >
                        Perbarui Data Lama
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* File Picker */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Pilih Berkas Spreadsheet:</Text>
                  <Pressable
                    style={({ pressed }) => [styles.filePickerBox, pressed && styles.pressedState]}
                    onPress={pickImportFile}
                    accessibilityRole="button"
                    accessibilityLabel="Pilih berkas Excel"
                  >
                    <Ionicons name="document-attach" size={24} color={colors.primary[700]} />
                    <Text style={styles.filePickerTitle}>
                      {selectedFileName || "Sentuh untuk memilih berkas .xlsx"}
                    </Text>
                    <Text style={styles.filePickerSub}>Mendukung format Microsoft Excel .xlsx</Text>
                  </Pressable>
                </View>

                <ModernButton
                  title={processingImport ? "Mengimpor & Memvalidasi..." : "Proses Import Sekarang"}
                  variant="primary"
                  size="md"
                  onPress={handleExecuteImport}
                  loading={processingImport}
                  disabled={!selectedFileUri || processingImport}
                  icon={<Ionicons name="checkmark-circle" size={18} color={colors.neutral.white} />}
                />
              </ModernCard>
            </View>
          )}
        </ScrollView>
      )}

      {/* ================= MODAL LAPORAN HASIL IMPORT ================= */}
      <Modal visible={reportModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Laporan Hasil Import Excel</Text>
                <Text style={styles.modalSubtitle}>Ringkasan verifikasi baris per baris</Text>
              </View>
              <Pressable
                onPress={() => setReportModalVisible(false)}
                hitSlop={8}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedOpacity]}
                accessibilityRole="button"
                accessibilityLabel="Tutup"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
              {/* Stat Cards */}
              <View style={styles.importStatRow}>
                <View style={styles.importStatBox}>
                  <Text style={[styles.importStatNum, { color: colors.status.active }]}>
                    {importReport?.successCount || 0}
                  </Text>
                  <Text style={styles.importStatLabel}>Baris Ditambah</Text>
                </View>

                <View style={styles.importStatBox}>
                  <Text style={[styles.importStatNum, { color: colors.primary[700] }]}>
                    {importReport?.updatedCount || 0}
                  </Text>
                  <Text style={styles.importStatLabel}>Baris Diperbarui</Text>
                </View>

                <View style={styles.importStatBox}>
                  <Text style={[styles.importStatNum, { color: colors.accent.gold }]}>
                    {importReport?.skippedCount || 0}
                  </Text>
                  <Text style={styles.importStatLabel}>Dilewati</Text>
                </View>
              </View>

              {/* Error list if any */}
              {importReport?.errors && importReport.errors.length > 0 && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>
                    Catatan Masalah ({importReport.errors.length}):
                  </Text>
                  {importReport.errors.slice(0, 10).map((err, i) => (
                    <Text key={i} style={styles.errorItem}>
                      • {err}
                    </Text>
                  ))}
                  {importReport.errors.length > 10 && (
                    <Text style={styles.errorMore}>
                      ...dan {importReport.errors.length - 10} baris lainnya
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={{ marginTop: spacing.md }}>
              <ModernButton
                title="Selesai & Tutup"
                variant="primary"
                size="md"
                onPress={() => setReportModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: spacing.xxl,
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
  tabContent: {
    gap: spacing.md,
  },
  headerSlot: {
    gap: 8,
    paddingTop: 4,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
    padding: spacing.sm,
    borderRadius: radius.md,
    borderCurve: "continuous",
    marginBottom: spacing.xs,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.primary[900],
    lineHeight: 16,
  },
  exportCard: {
    padding: spacing.md,
    borderRadius: radius.xl,
    borderCurve: "continuous",
  },
  exportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconBoxEmerald: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.primary[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxGold: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.accent.goldLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent.goldBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxBlue: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: "#EFF6FF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#BFDBFE",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxTeal: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.accent.tealLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#99F6E4",
    alignItems: "center",
    justifyContent: "center",
  },
  exportTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
  },
  exportSub: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  exportFooter: {
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.borderSubtle,
    paddingTop: spacing.sm,
  },
  // Import Specific
  importSectionCard: {
    padding: spacing.md,
    borderRadius: radius.xl,
    borderCurve: "continuous",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 4,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
  },
  sectionHeaderSub: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  templateBtnRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  templateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  templateBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary[700],
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
    marginBottom: 6,
  },
  targetRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  targetBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  targetBtnActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  targetBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral.textMuted,
  },
  targetBtnTextActive: {
    color: colors.primary[700],
    fontWeight: "800",
  },
  filePickerBox: {
    borderWidth: 1.5,
    borderColor: colors.primary[300],
    borderStyle: "dashed",
    borderRadius: radius.lg,
    borderCurve: "continuous",
    padding: spacing.lg,
    alignItems: "center",
    backgroundColor: colors.primary[50],
  },
  filePickerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary[800],
    marginTop: 6,
    textAlign: "center",
  },
  filePickerSub: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  // Audit Log
  logCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.xl,
    borderCurve: "continuous",
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  logDate: {
    fontSize: 11,
    color: colors.neutral.textMuted,
  },
  logFileName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
    marginBottom: 4,
  },
  logMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  logMeta: {
    fontSize: 11,
    color: colors.neutral.textMuted,
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
  importStatRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  importStatBox: {
    flex: 1,
    alignItems: "center",
    padding: spacing.sm,
    backgroundColor: colors.neutral.canvas,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  importStatNum: {
    fontSize: 18,
    fontWeight: "900",
  },
  importStatLabel: {
    fontSize: 10,
    color: colors.neutral.textMuted,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FECACA",
  },
  errorTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.status.cancelled,
    marginBottom: 4,
  },
  errorItem: {
    fontSize: 11,
    color: colors.status.cancelled,
    lineHeight: 16,
  },
  errorMore: {
    fontSize: 10,
    color: colors.status.cancelled,
    fontStyle: "italic",
    marginTop: 4,
  },
  pressedState: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  pressedOpacity: {
    opacity: 0.6,
  },
});
