import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Image,
  Modal,
  TextInput,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { colors, radius, radii, shadows, spacing } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { useSync } from "../../../context/SyncContext";
import { useAlert } from "../../../context/AlertContext";
import { AppShell } from "../../../components/layout/AppShell";
import {
  ModernCard,
  ModernButton,
  Badge,
  SegmentedTabs,
  StickyFooterButton,
  ConfirmDialog,
  useToast,
} from "../../../components/ui";
import { db } from "../../../db/client";
import {
  siswa,
  waliSiswa,
  anggotaKelas,
  kelas,
  tahunAjaran,
  dokumenPendukung,
  type Siswa,
  type WaliSiswa,
  type DokumenPendukung,
} from "../../../db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import {
  decryptSensitive,
  generateUUID,
  getIsoUtcString,
} from "../../../db/crypto";
import { generateAndShareSiswaBukuIndukPdf } from "../../../utils/pdfGenerator";
import { Ionicons } from "@expo/vector-icons";

type ActiveTab = "biodata" | "ortu" | "riwayat" | "dokumen";

interface KelasRiwayatItem {
  id: string;
  tahunAjaranNama: string;
  semester: number;
  namaSemester: string;
  kelasNama: string;
  tingkat: number;
  isActivePeriod: number;
}

export default function SiswaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, user } = useAuth();
  const { refreshPendingCountAsync } = useSync();
  const { showAlert } = useAlert();

  const isOperator = role === "super_admin" || role === "staf_tu";

  const [activeTab, setActiveTab] = useState<ActiveTab>("biodata");
  const [data, setData] = useState<Siswa | null>(null);
  const [waliList, setWaliList] = useState<WaliSiswa[]>([]);
  const [kelasRiwayatList, setKelasRiwayatList] = useState<KelasRiwayatItem[]>([]);
  const [dokumenList, setDokumenList] = useState<DokumenPendukung[]>([]);
  const [currentKelasName, setCurrentKelasName] = useState<string>("Belum Masuk Rombel");

  const [nikDecrypted, setNikDecrypted] = useState("-");
  const [noKkDecrypted, setNoKkDecrypted] = useState("-");
  const [nikAyahDecrypted, setNikAyahDecrypted] = useState("-");
  const [nikIbuDecrypted, setNikIbuDecrypted] = useState("-");
  const [nikWaliDecrypted, setNikWaliDecrypted] = useState("-");

  // Modal Upload Berkas
  const [modalUploadVisible, setModalUploadVisible] = useState(false);
  const [uploadJenisDokumen, setUploadJenisDokumen] = useState("Kartu Keluarga (KK)");
  const [customJenisDokumen, setCustomJenisDokumen] = useState("");
  const [uploadNamaDokumen, setUploadNamaDokumen] = useState("");
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; size?: number } | null>(null);
  const [savingUpload, setSavingUpload] = useState(false);

  const { showToast } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Menu Titik Tiga & Konfirmasi Hapus
  const [menuActionVisible, setMenuActionVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Status Mutasi / Keluar
  const [modalMutasiVisible, setModalMutasiVisible] = useState(false);
  const [mutasiStatus, setMutasiStatus] = useState<"aktif" | "lulus" | "pindah" | "keluar">("aktif");
  const [tanggalKeluar, setTanggalKeluar] = useState("");
  const [catatanMutasi, setCatatanMutasi] = useState("");
  const [tahunLulus, setTahunLulus] = useState("2026/2027");
  const [savingMutasi, setSavingMutasi] = useState(false);

  useEffect(() => {
    if (id) {
      loadAll();
    }
  }, [id]);

  const loadAll = async () => {
    if (!id) return;
    try {
      // 1. Data Siswa
      const sRes = await db.select().from(siswa).where(eq(siswa.id, id)).limit(1);
      if (sRes.length === 0 || !sRes[0]) {
        showAlert({
          title: "Siswa Tidak Ditemukan",
          message: "Data peserta didik tidak ditemukan dalam database.",
          type: "error",
        });
        router.back();
        return;
      }
      const s = sRes[0];
      setData(s);
      setMutasiStatus((s.status as any) || "aktif");
      setTanggalKeluar(s.tanggal_keluar || "");
      setCatatanMutasi(s.catatan_mutasi || "");
      setTahunLulus(s.tahun_lulus || "2026/2027");

      // 2. Data Orang Tua / Wali
      const wRes = await db
        .select()
        .from(waliSiswa)
        .where(and(eq(waliSiswa.siswa_id, id), isNull(waliSiswa.deleted_at)));
      setWaliList(wRes);

      const ayahObj = wRes.find((w) => w.hubungan === "ayah");
      const ibuObj = wRes.find((w) => w.hubungan === "ibu");
      const waliObj = wRes.find((w) => w.hubungan === "wali");

      // Dekripsi NIK & KK & NIK Ayah & NIK Ibu (hanya untuk Admin & TU; disensor untuk Guru)
      if (isOperator) {
        if (s.nik) {
          const decNik = await decryptSensitive(s.nik);
          setNikDecrypted(decNik || "-");
        }
        if (s.no_kk) {
          const decKk = await decryptSensitive(s.no_kk);
          setNoKkDecrypted(decKk || "-");
        }
        const ayahEnc = s.nik_ayah || ayahObj?.nik;
        if (ayahEnc) {
          const decAyah = await decryptSensitive(ayahEnc);
          setNikAyahDecrypted(decAyah || "-");
        } else {
          setNikAyahDecrypted("-");
        }
        const ibuEnc = s.nik_ibu || ibuObj?.nik;
        if (ibuEnc) {
          const decIbu = await decryptSensitive(ibuEnc);
          setNikIbuDecrypted(decIbu || "-");
        } else {
          setNikIbuDecrypted("-");
        }
        if (waliObj?.nik) {
          const decWali = await decryptSensitive(waliObj.nik);
          setNikWaliDecrypted(decWali || "-");
        } else {
          setNikWaliDecrypted("-");
        }
      } else {
        setNikDecrypted("••••••••••••••••");
        setNoKkDecrypted("••••••••••••••••");
        setNikAyahDecrypted("••••••••••••••••");
        setNikIbuDecrypted("••••••••••••••••");
        setNikWaliDecrypted("••••••••••••••••");
      }

      // 3. Riwayat Kelas
      const kRes = await db
        .select({
          id: anggotaKelas.id,
          tahunAjaranNama: tahunAjaran.nama,
          semester: tahunAjaran.semester,
          namaSemester: tahunAjaran.nama_semester,
          kelasNama: kelas.nama,
          tingkat: kelas.tingkat,
          isActivePeriod: tahunAjaran.is_active,
        })
        .from(anggotaKelas)
        .innerJoin(kelas, eq(anggotaKelas.kelas_id, kelas.id))
        .innerJoin(tahunAjaran, eq(anggotaKelas.tahun_ajaran_id, tahunAjaran.id))
        .where(and(eq(anggotaKelas.siswa_id, id), isNull(anggotaKelas.deleted_at)))
        .orderBy(desc(tahunAjaran.nama), desc(tahunAjaran.semester));

      setKelasRiwayatList(kRes);

      // Cari kelas saat ini pada tahun ajaran aktif
      const activeEntry = kRes.find((k) => k.isActivePeriod === 1);
      if (activeEntry) {
        setCurrentKelasName(`Kelas ${activeEntry.kelasNama} (Tingkat ${activeEntry.tingkat})`);
      } else if (kRes.length > 0) {
        setCurrentKelasName(`Kelas ${kRes[0]?.kelasNama} (${kRes[0]?.tahunAjaranNama})`);
      } else {
        setCurrentKelasName("Belum Masuk Rombel");
      }

      // 4. Dokumen Pendukung
      const dRes = await db
        .select()
        .from(dokumenPendukung)
        .where(
          and(
            eq(dokumenPendukung.documentable_type, "siswa"),
            eq(dokumenPendukung.documentable_id, id),
            isNull(dokumenPendukung.deleted_at)
          )
        );
      setDokumenList(dRes);
    } catch (e) {
      console.warn("Gagal membaca detail siswa:", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // Cetak Buku Induk Siswa PDF
  const handlePrintPdf = async () => {
    if (!data) return;
    setGeneratingPdf(true);
    try {
      const res = await generateAndShareSiswaBukuIndukPdf({
        siswa: data,
        nikDecrypted,
        noKkDecrypted,
        nikAyahDecrypted,
        nikIbuDecrypted,
        nikWaliDecrypted,
        waliList,
        kelasRiwayat: kelasRiwayatList,
      });

      if (!res.success) {
        showAlert({
          title: "Gagal Mencetak",
          message: res.message,
          type: "error",
        });
      }
    } catch (e: any) {
      showAlert({
        title: "Gagal Mencetak PDF",
        message: e?.message || "Terjadi kesalahan sistem",
        type: "error",
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Simpan Status Mutasi / Keluar
  const handleSaveMutasi = async () => {
    if (!id || !data) return;
    setSavingMutasi(true);
    const now = getIsoUtcString();

    try {
      await db
        .update(siswa)
        .set({
          status: mutasiStatus,
          tanggal_keluar: mutasiStatus !== "aktif" ? tanggalKeluar.trim() || null : null,
          catatan_mutasi: mutasiStatus !== "aktif" ? catatanMutasi.trim() || null : null,
          tahun_lulus: mutasiStatus === "lulus" ? tahunLulus.trim() || null : null,
          updated_at: now,
          sync_status: "pending_push",
          version: (data.version || 1) + 1,
        })
        .where(eq(siswa.id, id));

      await refreshPendingCountAsync();
      setModalMutasiVisible(false);
      await loadAll();

      showAlert({
        title: "Status Siswa Diperbarui",
        message: `Status siswa berhasil diubah menjadi '${mutasiStatus.toUpperCase()}'.`,
        type: "success",
      });
    } catch (e: any) {
      showAlert({
        title: "Gagal Mengubah Status",
        message: e?.message || "Terjadi kesalahan database.",
        type: "error",
      });
    } finally {
      setSavingMutasi(false);
    }
  };

  // Hapus Siswa (Soft-delete dengan deleted_at & cascade relasi)
  const handleDeleteStudent = async () => {
    if (!id || !data) return;
    setIsDeleting(true);
    try {
      const now = getIsoUtcString();

      // 1. Soft-delete siswa
      await db
        .update(siswa)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
          version: (data.version || 1) + 1,
        })
        .where(eq(siswa.id, id));

      // 2. Cascade soft-delete anggota kelas
      await db
        .update(anggotaKelas)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
        })
        .where(eq(anggotaKelas.siswa_id, id));

      // 3. Cascade soft-delete data wali siswa
      await db
        .update(waliSiswa)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
        })
        .where(eq(waliSiswa.siswa_id, id));

      // 4. Cascade soft-delete dokumen berkas siswa
      await db
        .update(dokumenPendukung)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
        })
        .where(eq(dokumenPendukung.documentable_id, id));

      await refreshPendingCountAsync();
      setConfirmDeleteVisible(false);
      showToast("Data siswa berhasil dihapus.");
      router.back();
    } catch (e: any) {
      showAlert({
        title: "Gagal Menghapus",
        message: e?.message || "Terjadi kesalahan saat menghapus data.",
        type: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const JENIS_BERKAS_LIST = [
    "Kartu Keluarga (KK)",
    "Akta Kelahiran",
    "Ijazah SD / MI",
    "Surat Keterangan Lulus (SKL)",
    "Kartu Bantuan (KIP / PKH / KKS)",
    "KTP Orang Tua / Wali",
    "Pasfoto Resmi Siswa",
    "Surat Pindah / Mutasi",
    "Piagam Prestasi",
    "Lainnya",
  ];

  // Buka Modal Upload Dokumen
  const handleOpenUploadModal = () => {
    setUploadJenisDokumen("Kartu Keluarga (KK)");
    setCustomJenisDokumen("");
    setUploadNamaDokumen("Kartu Keluarga (KK)");
    setSelectedFile(null);
    setModalUploadVisible(true);
  };

  // Pilih file dokumen dari penyimpanan HP
  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        setSelectedFile({
          uri: file.uri,
          name: file.name,
          size: file.size,
        });
        if (!uploadNamaDokumen || JENIS_BERKAS_LIST.includes(uploadNamaDokumen)) {
          setUploadNamaDokumen(file.name);
        }
      }
    } catch (e: any) {
      showAlert({
        title: "Gagal Membuka File",
        message: e?.message || "Terjadi kesalahan saat memilih dokumen",
        type: "error",
      });
    }
  };

  // Simpan Dokumen Terpilih ke Database
  const handleSaveUploadedDocument = async () => {
    if (!id) return;
    if (!selectedFile) {
      showAlert({
        title: "Pilih File Terlebih Dahulu",
        message: "Silakan pilih dokumen berupa file PDF atau gambar terlebih dahulu.",
        type: "warning",
      });
      return;
    }

    setSavingUpload(true);
    try {
      const now = getIsoUtcString();
      const finalJenis =
        uploadJenisDokumen === "Lainnya"
          ? customJenisDokumen.trim() || "Dokumen Lainnya"
          : uploadJenisDokumen;
      const finalNama = uploadNamaDokumen.trim() || selectedFile.name;
      const docId = generateUUID();

      let savedLocalPath = selectedFile.uri;
      // Salin berkas ke direktori dokumen permanen internal aplikasi agar aman dan terisolasi
      try {
        const docDir = `${FileSystem.documentDirectory}dokumen/`;
        const dirInfo = await FileSystem.getInfoAsync(docDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(docDir, { intermediates: true });
        }
        const ext = selectedFile.name.includes(".")
          ? selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase()
          : "";
        const targetPath = `${docDir}${docId}${ext}`;
        await FileSystem.copyAsync({
          from: selectedFile.uri,
          to: targetPath,
        });
        savedLocalPath = targetPath;
      } catch (copyErr) {
        console.warn("Gagal menyalin file ke dokumen permanen, memakai URI asli:", copyErr);
      }

      await db.insert(dokumenPendukung).values({
        id: docId,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        sync_status: "pending_push",
        last_synced_at: null,
        version: 1,
        documentable_type: "siswa",
        documentable_id: id,
        jenis_dokumen: finalJenis,
        nama_dokumen: finalNama,
        local_file_path: savedLocalPath,
        remote_file_url: null,
        ukuran_file: selectedFile.size || null,
        uploaded_by: user?.id || null,
      });

      await refreshPendingCountAsync();
      await loadAll();
      setModalUploadVisible(false);

      showToast(`Berkas '${finalNama}' berhasil diunggah.`);
    } catch (e: any) {
      showAlert({
        title: "Gagal Mengunggah Berkas",
        message: e?.message || "Terjadi kesalahan database.",
        type: "error",
      });
    } finally {
      setSavingUpload(false);
    }
  };

  // Unduh / Bagikan Dokumen ke Luar Aplikasi
  const handleDownloadDokumen = async (doc: DokumenPendukung) => {
    let sourcePath = doc.local_file_path;

    if (!sourcePath && !doc.remote_file_url) {
      showAlert({
        title: "Berkas Tidak Ditemukan",
        message: "Jalur berkas lokal pada perangkat ini tidak tersedia.",
        type: "warning",
      });
      return;
    }

    try {
      // Normalisasi scheme jika berupa path lokal tanpa file://
      if (sourcePath && sourcePath.startsWith("/")) {
        sourcePath = `file://${sourcePath}`;
      }

      let exists = false;
      if (sourcePath) {
        try {
          const info = await FileSystem.getInfoAsync(sourcePath);
          exists = info.exists;
        } catch {
          exists = false;
        }
      }

      // Jika file lokal belum ada tapi ada remote_file_url, unduh terlebih dahulu
      if (!exists && doc.remote_file_url) {
        const downloadDir = `${FileSystem.cacheDirectory}downloads/`;
        const dirInfo = await FileSystem.getInfoAsync(downloadDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
        }
        const cleanName = (doc.nama_dokumen || "dokumen").replace(/[^a-zA-Z0-9._-]/g, "_");
        const downloadTarget = `${downloadDir}${Date.now()}_${cleanName}`;
        const downloadRes = await FileSystem.downloadAsync(doc.remote_file_url, downloadTarget);
        sourcePath = downloadRes.uri;
        exists = true;
      }

      if (!exists || !sourcePath) {
        showAlert({
          title: "File Tidak Tersedia",
          message: "Berkas tidak ditemukan pada direktori penyimpanan lokal perangkat.",
          type: "error",
        });
        return;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        showAlert({
          title: "Lokasi File",
          message: `Fitur unduh / bagikan sistem tidak tersedia. Jalur file: ${sourcePath}`,
          type: "info",
        });
        return;
      }

      // Pastikan berkas berada dalam direktori cache sandbox aplikasi dengan nama aman untuk Android FileProvider
      const shareDir = `${FileSystem.cacheDirectory}share/`;
      const shareDirInfo = await FileSystem.getInfoAsync(shareDir);
      if (!shareDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(shareDir, { intermediates: true });
      }

      const rawExt = doc.nama_dokumen?.includes(".")
        ? doc.nama_dokumen.substring(doc.nama_dokumen.lastIndexOf(".")).toLowerCase()
        : "";
      const fallbackExt = doc.nama_dokumen?.toLowerCase().endsWith(".pdf")
        ? ".pdf"
        : doc.nama_dokumen?.toLowerCase().endsWith(".png")
        ? ".png"
        : ".jpg";
      const ext = rawExt || fallbackExt;

      const baseName = (doc.nama_dokumen || "dokumen")
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_");

      const safeFilename = `${Date.now()}_${baseName || "berkas"}${ext}`;
      let shareableUri = `${shareDir}${safeFilename}`;

      // Salin ke shareableUri di cache sandbox aplikasi agar SharingFileProvider Android memiliki izin baca 100%
      try {
        await FileSystem.copyAsync({
          from: sourcePath,
          to: shareableUri,
        });
      } catch (copyErr) {
        console.warn("Gagal copyAsync untuk sharing, mencoba fallback base64:", copyErr);
        try {
          const content = await FileSystem.readAsStringAsync(sourcePath, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await FileSystem.writeAsStringAsync(shareableUri, content, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch {
          shareableUri = sourcePath;
        }
      }

      const mimeType = ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
        ? "image/png"
        : "image/jpeg";

      await Sharing.shareAsync(shareableUri, {
        dialogTitle: `Unduh Dokumen - ${doc.nama_dokumen}`,
        mimeType,
        UTI: ext === ".pdf" ? "com.adobe.pdf" : "public.image",
      });

      showToast("File siap diunduh atau dibagikan.");
    } catch (e: any) {
      showAlert({
        title: "Gagal Mengunduh Dokumen",
        message: e?.message || "Terjadi kesalahan saat mengunduh berkas.",
        type: "error",
      });
    }
  };

  const handleRemoveDokumen = (doc: DokumenPendukung) => {
    showAlert({
      title: "Hapus Dokumen Siswa",
      message: `Hapus berkas '${doc.nama_dokumen}' dari profil siswa ini?`,
      type: "confirm",
      buttons: [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              const now = getIsoUtcString();
              await db
                .update(dokumenPendukung)
                .set({
                  deleted_at: now,
                  updated_at: now,
                  sync_status: "pending_push",
                })
                .where(eq(dokumenPendukung.id, doc.id));

              await refreshPendingCountAsync();
              await loadAll();
            } catch (e: any) {
              showAlert({
                title: "Gagal Menghapus",
                message: e?.message,
                type: "error",
              });
            }
          },
        },
      ],
    });
  };

  if (!data) {
    return (
      <AppShell title="Detail Siswa">
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Memuat profil siswa...</Text>
        </View>
      </AppShell>
    );
  }

  const ayah = waliList.find((w) => w.hubungan === "ayah");
  const ibu = waliList.find((w) => w.hubungan === "ibu");
  const wali = waliList.find((w) => w.hubungan === "wali");

  return (
    <AppShell
      title="Detail Siswa"
      subtitle={data.nama_lengkap}
      showBack
      rightAction={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Opsi Tindakan Siswa"
          onPress={() => setMenuActionVisible(true)}
          style={({ pressed }) => [
            { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.neutral.textPrimary} />
        </Pressable>
      }
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile Card */}
        <ModernCard style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{data.nama_lengkap}</Text>
              <Text style={styles.profileClass}>{currentKelasName}</Text>
            </View>
            <Badge
              label={data.status.toUpperCase()}
              variant={
                data.status === "aktif"
                  ? "active"
                  : data.status === "lulus"
                  ? "gold"
                  : "cancelled"
              }
              size="sm"
            />
          </View>

          <View style={styles.profileRow}>
            {data.foto_local_path ? (
              <Image source={{ uri: data.foto_local_path }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {data.nama_lengkap.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.profileMeta}>
                NIS: {data.nis || "-"} • NISN: {data.nisn || "-"}
              </Text>
              <View style={styles.badgeRow}>
                <Badge
                  label={data.jenis_kelamin === "L" ? "LAKI-LAKI (L)" : "PEREMPUAN (P)"}
                  variant={data.jenis_kelamin === "L" ? "primary" : "gold"}
                  size="sm"
                />
              </View>
            </View>
          </View>
        </ModernCard>

        {/* Segmented Tabs (4 tab yang ikut ter-scroll bersama header sesuai Bagian 12) */}
        <SegmentedTabs
          tabs={[
            { key: "biodata", label: "Biodata" },
            { key: "ortu", label: "Orang Tua" },
            { key: "riwayat", label: `Rombel (${kelasRiwayatList.length})` },
            { key: "dokumen", label: `Berkas (${dokumenList.length})` },
          ]}
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as any)}
          scrollable
          style={{ marginBottom: 12 }}
        />
        {/* ================= TAB 1: BIODATA SISWA ================= */}
        {activeTab === "biodata" && (
          <View style={styles.tabContent}>
            {/* Identitas Diri */}
            <ModernCard style={styles.card}>
              <Text style={styles.cardSectionTitle}>Identitas Lengkap Siswa</Text>
              <View style={styles.infoTable}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nama Lengkap</Text>
                  <Text style={styles.infoVal}>{data.nama_lengkap}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NIS / NISN</Text>
                  <Text style={styles.infoVal}>
                    {data.nis || "-"} / {data.nisn || "-"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tempat, Tgl Lahir</Text>
                  <Text style={styles.infoVal}>
                    {data.tempat_lahir || "-"}, {data.tanggal_lahir || "-"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Agama</Text>
                  <Text style={styles.infoVal}>{data.agama || "Islam"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Anak Ke- / Saudara</Text>
                  <Text style={styles.infoVal}>
                    Anak ke-{data.anak_ke || "-"} dari {data.jumlah_saudara || "-"} bersaudara
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tinggal Bersama</Text>
                  <Text style={styles.infoVal}>{data.tinggal_bersama || "Orang Tua"}</Text>
                </View>
              </View>
            </ModernCard>

            {/* Pendidikan Sebelumnya */}
            <ModernCard style={styles.card}>
              <Text style={styles.cardSectionTitle}>Pendidikan Asal</Text>
              <View style={styles.infoTable}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Sekolah Asal (SD/MI)</Text>
                  <Text style={styles.infoVal}>{data.asal_sekolah || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NPSN Asal</Text>
                  <Text style={styles.infoVal}>{data.npsn_sekolah_asal || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tahun Masuk MTs</Text>
                  <Text style={styles.infoVal}>{data.tahun_masuk || "2026"}</Text>
                </View>
              </View>
            </ModernCard>

            {/* Domisili & Kontak */}
            <ModernCard style={styles.card}>
              <Text style={styles.cardSectionTitle}>Alamat & Kontak Domisili</Text>
              <View style={styles.infoTable}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>No. Handphone / WA</Text>
                  <Text style={styles.infoVal}>{data.no_hp || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoVal}>{data.email || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Alamat Lengkap</Text>
                  <Text style={styles.infoVal}>
                    {data.alamat_jalan || "-"} RT {data.rt || "-"} RW {data.rw || "-"}, Desa{" "}
                    {data.desa || "-"}, Kec. {data.kecamatan || "-"}, {data.kabupaten || "-"},{" "}
                    {data.provinsi || "-"} ({data.kode_pos || "-"})
                  </Text>
                </View>
              </View>
            </ModernCard>

            {/* Data Sensitif AES-256 */}
            <ModernCard style={styles.card}>
              <Text style={styles.cardSectionTitle}>Data Kependudukan (Terenkripsi AES-256)</Text>
              <View style={styles.infoTable}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NIK Siswa</Text>
                  <Text style={styles.infoVal}>{nikDecrypted}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nomor Kartu Keluarga</Text>
                  <Text style={styles.infoVal}>{noKkDecrypted}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NIK Ayah Kandung</Text>
                  <Text style={styles.infoVal}>{nikAyahDecrypted}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NIK Ibu Kandung</Text>
                  <Text style={styles.infoVal}>{nikIbuDecrypted}</Text>
                </View>
              </View>
            </ModernCard>
          </View>
        )}

        {/* ================= TAB 2: DATA ORANG TUA / WALI ================= */}
        {activeTab === "ortu" && (
          <View style={styles.tabContent}>
            {/* Ayah Kandung */}
            <ModernCard style={styles.card}>
              <Text style={styles.cardSectionTitle}>Data Ayah Kandung</Text>
              <View style={styles.infoTable}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nama Lengkap</Text>
                  <Text style={styles.infoVal}>
                    {ayah?.nama_lengkap || "-"} ({ayah?.status || "hidup"})
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NIK Ayah</Text>
                  <Text style={styles.infoVal}>{nikAyahDecrypted}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tempat, Tgl Lahir</Text>
                  <Text style={styles.infoVal}>
                    {[ayah?.tempat_lahir, ayah?.tanggal_lahir].filter(Boolean).join(", ") || "-"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Lulusan Pendidikan</Text>
                  <Text style={styles.infoVal}>{ayah?.pendidikan_terakhir || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Pekerjaan Utama</Text>
                  <Text style={styles.infoVal}>{ayah?.pekerjaan || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>No. Handphone / WA</Text>
                  <Text style={styles.infoVal}>{ayah?.no_hp || "-"}</Text>
                </View>
              </View>
            </ModernCard>

            {/* Ibu Kandung */}
            <ModernCard style={styles.card}>
              <Text style={styles.cardSectionTitle}>Data Ibu Kandung</Text>
              <View style={styles.infoTable}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nama Lengkap</Text>
                  <Text style={styles.infoVal}>
                    {ibu?.nama_lengkap || "-"} ({ibu?.status || "hidup"})
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NIK Ibu</Text>
                  <Text style={styles.infoVal}>{nikIbuDecrypted}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tempat, Tgl Lahir</Text>
                  <Text style={styles.infoVal}>
                    {[ibu?.tempat_lahir, ibu?.tanggal_lahir].filter(Boolean).join(", ") || "-"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Lulusan Pendidikan</Text>
                  <Text style={styles.infoVal}>{ibu?.pendidikan_terakhir || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Pekerjaan Utama</Text>
                  <Text style={styles.infoVal}>{ibu?.pekerjaan || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>No. Handphone / WA</Text>
                  <Text style={styles.infoVal}>{ibu?.no_hp || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Kartu Bantuan Sosial</Text>
                  <Text style={styles.infoVal}>
                    {ibu?.kartu_bantuan || ayah?.kartu_bantuan || "Tidak Menerima"}
                  </Text>
                </View>
              </View>
            </ModernCard>

            {/* Wali Siswa (jika ada) */}
            {wali && wali.nama_lengkap ? (
              <ModernCard style={styles.card}>
                <Text style={styles.cardSectionTitle}>Data Wali Siswa</Text>
                <View style={styles.infoTable}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Nama Lengkap</Text>
                    <Text style={styles.infoVal}>
                      {wali.nama_lengkap} ({wali.keterangan_hubungan || "Wali"})
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Status Keberadaan</Text>
                    <Text style={styles.infoVal}>{wali.status || "hidup"}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>NIK Wali</Text>
                    <Text style={styles.infoVal}>{nikWaliDecrypted}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Tempat, Tgl Lahir</Text>
                    <Text style={styles.infoVal}>
                      {[wali.tempat_lahir, wali.tanggal_lahir].filter(Boolean).join(", ") || "-"}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Lulusan Pendidikan</Text>
                    <Text style={styles.infoVal}>{wali.pendidikan_terakhir || "-"}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Pekerjaan Utama</Text>
                    <Text style={styles.infoVal}>{wali.pekerjaan || "-"}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>No. Handphone / WA</Text>
                    <Text style={styles.infoVal}>{wali.no_hp || "-"}</Text>
                  </View>
                </View>
              </ModernCard>
            ) : null}
          </View>
        )}

        {/* ================= TAB 3: RIWAYAT KELAS / ROMBEL ================= */}
        {activeTab === "riwayat" && (
          <View style={styles.tabContent}>
            <View style={styles.tabActionHeader}>
              <View>
                <Text style={styles.tabHeaderLabel}>Riwayat Penempatan Rombel</Text>
                <Text style={styles.tabHeaderSub}>
                  Histori rekam kelas peserta didik dari tahun ke tahun
                </Text>
              </View>
            </View>

            {kelasRiwayatList.length === 0 ? (
              <ModernCard style={styles.emptyCard}>
                <Ionicons name="school-outline" size={42} color={colors.neutral.textMuted} />
                <Text style={styles.emptyTitle}>Belum Masuk Rombel</Text>
                <Text style={styles.emptyDesc}>
                  Siswa ini belum ditempatkan pada rombel kelas manapun. Masukkan siswa melalui menu Kelas & Rombel.
                </Text>
              </ModernCard>
            ) : (
              kelasRiwayatList.map((k) => {
                const isCurrentActive = k.isActivePeriod === 1;
                return (
                  <ModernCard
                    key={k.id}
                    style={[
                      styles.itemCard,
                      isCurrentActive && {
                        borderColor: colors.status.synced,
                        backgroundColor: colors.primary[50] + "25",
                      },
                    ]}
                  >
                    <View style={styles.itemRow}>
                      <View
                        style={[
                          styles.tingkatBadge,
                          isCurrentActive && {
                            backgroundColor: colors.status.syncedBg,
                            borderColor: colors.status.synced,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tingkatText,
                            isCurrentActive && { color: colors.status.synced },
                          ]}
                        >
                          {k.tingkat}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            flexWrap: "wrap",
                            marginBottom: 2,
                          }}
                        >
                          <Text style={styles.itemName}>Kelas {k.kelasNama}</Text>
                          {isCurrentActive ? (
                            <Badge label="Aktif Saat Ini" variant="active" size="sm" />
                          ) : (
                            <Badge label="Riwayat Selesai" variant="neutral" size="sm" />
                          )}
                        </View>
                        <Text style={styles.itemMeta}>
                          Tahun Ajaran {k.tahunAjaranNama} • Semester {k.namaSemester}
                        </Text>
                      </View>
                      <Badge label={`Tingkat ${k.tingkat}`} variant="primary" size="sm" />
                    </View>
                  </ModernCard>
                );
              })
            )}
          </View>
        )}

        {/* ================= TAB 4: BERKAS DOKUMEN DIGITAL ================= */}
        {activeTab === "dokumen" && (
          <View style={styles.tabContent}>
            <View style={styles.tabActionHeader}>
              <Text style={styles.tabHeaderLabel}>Arsip Berkas Siswa (KK, Akta, Ijazah)</Text>
              {isOperator && (
                <ModernButton
                  title="+ Berkas"
                  size="sm"
                  onPress={handleOpenUploadModal}
                  icon={<Ionicons name="cloud-upload-outline" size={16} color={colors.neutral.white} />}
                />
              )}
            </View>

            {dokumenList.length === 0 ? (
              <ModernCard style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={42} color={colors.neutral.textMuted} />
                <Text style={styles.emptyTitle}>Belum Ada Dokumen Pendukung</Text>
                <Text style={styles.emptyDesc}>
                  Unggah scan Kartu Keluarga, Akta Kelahiran, Ijazah SD/MI, atau berkas siswa lainnya.
                </Text>
              </ModernCard>
            ) : (
              dokumenList.map((d) => (
                <ModernCard key={d.id} style={styles.itemCard}>
                  <View style={styles.itemRow}>
                    <Pressable
                      onPress={() => handleDownloadDokumen(d)}
                      style={styles.docIconBox}
                      accessibilityRole="button"
                      accessibilityLabel={`Unduh dokumen ${d.nama_dokumen}`}
                    >
                      <Ionicons name="document-attach" size={20} color={colors.primary[700]} />
                    </Pressable>
                    <Pressable
                      style={{ flex: 1 }}
                      onPress={() => handleDownloadDokumen(d)}
                      accessibilityRole="button"
                      accessibilityLabel={`Buka atau unduh ${d.nama_dokumen}`}
                    >
                      <Text style={styles.itemName}>{d.nama_dokumen}</Text>
                      <Text style={styles.itemMeta}>
                        Jenis: {d.jenis_dokumen} • Ukuran:{" "}
                        {d.ukuran_file ? `${Math.round(d.ukuran_file / 1024)} KB` : "-"}
                      </Text>
                    </Pressable>
                    <View style={styles.docActions}>
                      <Pressable
                        onPress={() => handleDownloadDokumen(d)}
                        hitSlop={8}
                        style={({ pressed }) => [styles.downloadBtn, pressed && styles.pressedState]}
                        accessibilityRole="button"
                        accessibilityLabel={`Unduh dokumen ${d.nama_dokumen}`}
                      >
                        <Ionicons
                          name="cloud-download-outline"
                          size={18}
                          color={colors.primary[700]}
                        />
                      </Pressable>
                      {isOperator && (
                        <Pressable
                          onPress={() => handleRemoveDokumen(d)}
                          hitSlop={8}
                          style={({ pressed }) => [styles.trashBtn, pressed && styles.pressedState]}
                          accessibilityRole="button"
                          accessibilityLabel={`Hapus dokumen ${d.nama_dokumen}`}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color={colors.status.cancelled}
                          />
                        </Pressable>
                      )}
                    </View>
                  </View>
                </ModernCard>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky footer: Maksimal satu tombol primer per layar (Bagian 3, 5 & 14) */}
      {isOperator && (
        <StickyFooterButton
          title="Edit Biodata Siswa"
          onPress={() =>
            router.push({
              pathname: "/(app)/siswa/form",
              params: { id: data.id },
            })
          }
          secondaryTitle="Cetak PDF"
          onSecondaryPress={handlePrintPdf}
          loading={generatingPdf}
        />
      )}

      {/* Modal Menu Titik Tiga Header */}
      <Modal
        visible={menuActionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuActionVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuActionVisible(false)}
        >
          <View style={[styles.modalContent, { maxWidth: 360 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Tindakan Siswa</Text>
                <Text style={styles.modalSubtitle}>{data.nama_lengkap}</Text>
              </View>
              <Pressable
                onPress={() => setMenuActionVisible(false)}
                hitSlop={8}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <View style={{ gap: 8, paddingVertical: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cetak Buku Induk PDF"
                onPress={() => {
                  setMenuActionVisible(false);
                  handlePrintPdf();
                }}
                style={({ pressed }) => [
                  styles.menuItemRow,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="print-outline" size={20} color={colors.primary[700]} />
                <Text style={styles.menuItemText}>Cetak Buku Induk PDF</Text>
              </Pressable>

              {isOperator && (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ubah Status Mutasi"
                    onPress={() => {
                      setMenuActionVisible(false);
                      setModalMutasiVisible(true);
                    }}
                    style={({ pressed }) => [
                      styles.menuItemRow,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons name="swap-vertical-outline" size={20} color={colors.primary[700]} />
                    <Text style={styles.menuItemText}>Ubah Status Siswa / Mutasi</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Hapus Data Siswa"
                    onPress={() => {
                      setMenuActionVisible(false);
                      setConfirmDeleteVisible(true);
                    }}
                    style={({ pressed }) => [
                      styles.menuItemRow,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.status.conflict} />
                    <Text style={[styles.menuItemText, { color: colors.status.conflict }]}>
                      Hapus Siswa Ini
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ConfirmDialog Hapus Siswa (Bagian 5 & 8: selalu dengan dialog konfirmasi) */}
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="Hapus Data Siswa?"
        message={`Apakah Anda yakin ingin menghapus data siswa '${data.nama_lengkap}'? Data akan ditandai terhapus di database lokal.`}
        variant="danger"
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        loading={isDeleting}
        onConfirm={handleDeleteStudent}
        onCancel={() => setConfirmDeleteVisible(false)}
      />

      {/* Modal Kelola Status Siswa & Mutasi */}
      <Modal visible={modalMutasiVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Status Siswa & Mutasi</Text>
                <Text style={styles.modalSubtitle}>{data.nama_lengkap}</Text>
              </View>
              <Pressable
                onPress={() => setModalMutasiVisible(false)}
                hitSlop={8}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog mutasi"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            {/* Pilihan Status */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Status Keberadaan Siswa</Text>
              <View style={styles.statusChoiceRow}>
                {(["aktif", "lulus", "pindah", "keluar"] as const).map((st) => {
                  const isSel = mutasiStatus === st;
                  return (
                    <Pressable
                      key={st}
                      onPress={() => setMutasiStatus(st)}
                      style={({ pressed }) => [
                        styles.statusChoiceBtn,
                        isSel && styles.statusChoiceBtnActive,
                        pressed && styles.pressedState,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSel }}
                    >
                      <Text
                        style={[
                          styles.statusChoiceText,
                          isSel && styles.statusChoiceTextActive,
                        ]}
                      >
                        {st.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {mutasiStatus === "lulus" && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Tahun Kelulusan (Misal: 2026/2027)</Text>
                <TextInput
                  value={tahunLulus}
                  onChangeText={setTahunLulus}
                  placeholder="2026/2027"
                  style={styles.modalInput}
                  placeholderTextColor={colors.neutral.textMuted}
                />
              </View>
            )}

            {mutasiStatus !== "aktif" && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tanggal Mutasi / Keluar (YYYY-MM-DD)</Text>
                  <TextInput
                    value={tanggalKeluar}
                    onChangeText={setTanggalKeluar}
                    placeholder="2026-10-21"
                    style={styles.modalInput}
                    placeholderTextColor={colors.neutral.textMuted}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Catatan Mutasi / Sekolah Tujuan</Text>
                  <TextInput
                    value={catatanMutasi}
                    onChangeText={setCatatanMutasi}
                    placeholder="Pindah ke MTs Negeri 1 Jombang / Pindah domisili orang tua"
                    multiline
                    numberOfLines={2}
                    style={[styles.modalInput, { height: 60 }]}
                    placeholderTextColor={colors.neutral.textMuted}
                  />
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                onPress={() => setModalMutasiVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title={savingMutasi ? "Menyimpan..." : "Simpan Status"}
                variant="primary"
                size="md"
                onPress={handleSaveMutasi}
                loading={savingMutasi}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Unggah Berkas Siswa */}
      <Modal visible={modalUploadVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "90%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Unggah Berkas Siswa</Text>
                <Text style={styles.modalSubtitle}>Pilih jenis berkas dan lampirkan dokumen</Text>
              </View>
              <Pressable
                onPress={() => setModalUploadVisible(false)}
                hitSlop={8}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog unggah berkas"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {/* Pilihan Jenis Berkas */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Pilihan Data / Jenis Berkas *</Text>
                <View style={styles.chipRow}>
                  {JENIS_BERKAS_LIST.map((jb) => {
                    const isSel = uploadJenisDokumen === jb;
                    return (
                      <Pressable
                        key={jb}
                        onPress={() => {
                          setUploadJenisDokumen(jb);
                          if (!uploadNamaDokumen || JENIS_BERKAS_LIST.includes(uploadNamaDokumen)) {
                            setUploadNamaDokumen(jb === "Lainnya" ? "" : jb);
                          }
                        }}
                        style={({ pressed }) => [
                          styles.chipItem,
                          isSel && styles.chipItemActive,
                          pressed && styles.pressedState,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Pilih jenis berkas ${jb}`}
                      >
                        <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                          {jb}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {uploadJenisDokumen === "Lainnya" && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Kategori Dokumen Kustom</Text>
                  <TextInput
                    value={customJenisDokumen}
                    onChangeText={setCustomJenisDokumen}
                    placeholder="Contoh: Sertifikat Juara 1 Tahfidz"
                    style={styles.modalInput}
                    placeholderTextColor={colors.neutral.textMuted}
                  />
                </View>
              )}

              {/* Pemilihan File */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Lampiran File (PDF / Foto) *</Text>
                <Pressable
                  onPress={handleSelectFile}
                  style={({ pressed }) => [
                    styles.filePickerBtn,
                    selectedFile && styles.filePickerBtnSelected,
                    pressed && styles.pressedState,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Pilih berkas dari HP"
                >
                  <Ionicons
                    name={selectedFile ? "document-text" : "cloud-upload-outline"}
                    size={24}
                    color={selectedFile ? colors.primary[700] : colors.neutral.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.filePickerTitle,
                        selectedFile && { color: colors.primary[800], fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedFile ? selectedFile.name : "Ketuk untuk memilih file"}
                    </Text>
                    <Text style={styles.filePickerSubtitle}>
                      {selectedFile && selectedFile.size
                        ? `${Math.round(selectedFile.size / 1024)} KB • Siap diunggah`
                        : "Mendukung format PDF, JPG, PNG"}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {/* Judul Dokumen */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nama / Keterangan Dokumen</Text>
                <TextInput
                  value={uploadNamaDokumen}
                  onChangeText={setUploadNamaDokumen}
                  placeholder="Contoh: Scan KK Asli Ahmad Rizky"
                  style={styles.modalInput}
                  placeholderTextColor={colors.neutral.textMuted}
                />
              </View>
            </ScrollView>

            {/* Tombol Aksi */}
            <View style={styles.modalActions}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                onPress={() => setModalUploadVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title={savingUpload ? "Menyimpan..." : "Simpan Berkas"}
                variant="primary"
                size="md"
                onPress={handleSaveUploadedDocument}
                loading={savingUpload}
                icon={<Ionicons name="cloud-upload-outline" size={16} color={colors.neutral.white} />}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
    color: colors.neutral.textMuted,
  },
  scroll: {
    flex: 1,
  },
  headerCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  backText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary[700],
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    marginBottom: spacing.md + 2,
  },
  avatarImg: {
    width: 68,
    height: 90,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: colors.primary[200],
  },
  avatarPlaceholder: {
    width: 68,
    height: 90,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.primary[100],
    borderWidth: 1.5,
    borderColor: colors.primary[300],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.primary[800],
  },
  profileName: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
  },
  profileClass: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary[700],
    marginTop: 2,
  },
  profileMeta: {
    fontSize: 11.5,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  headerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.borderSubtle,
    paddingTop: spacing.md,
  },
  mutasiBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    alignItems: "center",
    justifyContent: "center",
  },
  // Tab Bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.neutral.canvas,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  tabBtnActive: {
    backgroundColor: colors.neutral.surface,
    ...shadows.soft,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textMuted,
  },
  tabBtnTextActive: {
    color: colors.primary[700],
    fontWeight: "700",
  },
  tabContent: {
    gap: spacing.sm + 2,
    paddingBottom: spacing.xxl,
  },
  card: {
    padding: spacing.md + 2,
    marginBottom: 2,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
    marginBottom: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.borderSubtle,
    paddingBottom: 6,
  },
  infoTable: {
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoLabel: {
    width: "36%",
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textMuted,
  },
  infoVal: {
    width: "64%",
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  tabActionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  tabHeaderLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
  },
  tabHeaderSub: {
    fontSize: 11,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  itemCard: {
    padding: spacing.md,
    marginBottom: 2,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  tingkatBadge: {
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
  tingkatText: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.primary[800],
  },
  docIconBox: {
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
  itemName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  itemMeta: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  trashBtn: {
    padding: 6,
    borderRadius: radius.sm,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
  },
  pressedState: {
    opacity: 0.7,
  },
  emptyCard: {
    padding: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
    marginTop: spacing.sm + 2,
  },
  emptyDesc: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  // Modal Common
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    borderCurve: "continuous",
    padding: spacing.xl,
    ...shadows.medium,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.border,
    paddingBottom: spacing.sm + 2,
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
    padding: spacing.xs,
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
  modalInput: {
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: spacing.md,
    height: 42,
    fontSize: 13,
    color: colors.neutral.textPrimary,
  },
  statusChoiceRow: {
    flexDirection: "row",
    gap: 6,
  },
  statusChoiceBtn: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.canvas,
  },
  statusChoiceBtnActive: {
    backgroundColor: colors.primary[700],
    borderColor: colors.primary[700],
  },
  statusChoiceText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.neutral.textSecondary,
  },
  statusChoiceTextActive: {
    color: colors.neutral.white,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm + 2,
    marginTop: spacing.md + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
    paddingTop: spacing.md,
  },
  scrollContent: {
    padding: spacing.screen,
    paddingBottom: 40,
  },
  menuItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.button,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  docActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  downloadBtn: {
    padding: 6,
    borderRadius: radius.sm,
    borderCurve: "continuous",
    backgroundColor: colors.primary[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chipItem: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.canvas,
  },
  chipItemActive: {
    backgroundColor: colors.primary[700],
    borderColor: colors.primary[700],
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.neutral.textSecondary,
  },
  chipTextActive: {
    color: colors.neutral.white,
  },
  filePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.canvas,
  },
  filePickerBtnSelected: {
    borderColor: colors.primary[400],
    backgroundColor: colors.primary[50],
    borderStyle: "solid",
  },
  filePickerTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  filePickerSubtitle: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
});
