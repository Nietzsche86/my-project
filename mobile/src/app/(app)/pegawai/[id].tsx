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
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { Badge } from "../../../components/ui/Badge";
import {
  SegmentedTabs,
  TabOption,
  ConfirmDialog,
  useToast,
} from "../../../components/ui";
import { db } from "../../../db/client";
import {
  pegawai,
  guruMapel,
  mataPelajaran,
  riwayatPendidikan,
  dokumenPendukung,
  pengampuKelas,
  kelas,
  type Pegawai,
  type MataPelajaran,
  type RiwayatPendidikan,
  type DokumenPendukung,
} from "../../../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  decryptSensitive,
  generateUUID,
  getIsoUtcString,
} from "../../../db/crypto";
import { generateAndSharePegawaiBiodataPdf } from "../../../utils/pdfGenerator";
import { Ionicons } from "@expo/vector-icons";

type ActiveTab = "biodata" | "mapel" | "pendidikan" | "dokumen";

export default function PegawaiDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, user, pegawaiData } = useAuth();
  const { refreshPendingCountAsync } = useSync();
  const { showAlert } = useAlert();
  const { showToast } = useToast();

  const isOperator = role === "super_admin" || role === "staf_tu";
  const isSuperAdmin = role === "super_admin";
  const isOwner = pegawaiData?.id === id;
  const canEdit = isOperator || isOwner;

  const [activeTab, setActiveTab] = useState<ActiveTab>("biodata");
  const [data, setData] = useState<Pegawai | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Menu Titik Tiga & Hapus Pegawai (Super Admin)
  const [menuActionVisible, setMenuActionVisible] = useState(false);
  const [confirmDeletePegawaiVisible, setConfirmDeletePegawaiVisible] = useState(false);
  const [isDeletingPegawai, setIsDeletingPegawai] = useState(false);

  // Decrypted sensitive fields
  const [nikDecrypted, setNikDecrypted] = useState("-");
  const [npwpDecrypted, setNpwpDecrypted] = useState("-");
  const [rekeningDecrypted, setRekeningDecrypted] = useState("-");

  // Relations
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [riwayatList, setRiwayatList] = useState<RiwayatPendidikan[]>([]);
  const [dokumenList, setDokumenList] = useState<DokumenPendukung[]>([]);

  // Modal Tambah Mapel Keahlian
  const [modalMapelVisible, setModalMapelVisible] = useState(false);
  const [availableMapel, setAvailableMapel] = useState<MataPelajaran[]>([]);
  const [selectedMapelId, setSelectedMapelId] = useState<string | null>(null);

  // Modal Tambah Riwayat Pendidikan
  const [modalPendidikanVisible, setModalPendidikanVisible] = useState(false);
  const [formJenjang, setFormJenjang] = useState("S1");
  const [formInstitusi, setFormInstitusi] = useState("");
  const [formJurusan, setFormJurusan] = useState("");
  const [formTahunLulus, setFormTahunLulus] = useState("");

  useEffect(() => {
    if (id) {
      loadAll();
    }
  }, [id]);

  const loadAll = async () => {
    if (!id) return;
    try {
      // 1. Pegawai Detail
      const res = await db.select().from(pegawai).where(eq(pegawai.id, id)).limit(1);
      if (res.length === 0 || !res[0]) {
        showAlert({
          title: "Pegawai Tidak Ditemukan",
          message: "Data pegawai tidak ditemukan dalam database.",
          type: "error",
        });
        router.back();
        return;
      }
      const p = res[0];
      setData(p);

      // Dekripsi NIK, NPWP, Rekening
      if (isOperator || isOwner) {
        if (p.nik) {
          const decNik = await decryptSensitive(p.nik);
          setNikDecrypted(decNik || "-");
        }
        if (p.npwp) {
          const decNpwp = await decryptSensitive(p.npwp);
          setNpwpDecrypted(decNpwp || "-");
        }
        if (p.no_rekening) {
          const decRek = await decryptSensitive(p.no_rekening);
          setRekeningDecrypted(decRek || "-");
        }
      } else {
        setNikDecrypted("••••••••••••••••");
        setNpwpDecrypted("•••••••••••••••");
        setRekeningDecrypted("••••••••••••");
      }

      // 2. Mapel Keahlian (hanya jika guru)
      if (p.jenis === "guru") {
        const mRes = await db
          .select({
            id: mataPelajaran.id,
            kode_mapel: mataPelajaran.kode_mapel,
            nama_mapel: mataPelajaran.nama_mapel,
            kelompok: mataPelajaran.kelompok,
            is_active: mataPelajaran.is_active,
            created_at: mataPelajaran.created_at,
            updated_at: mataPelajaran.updated_at,
            deleted_at: mataPelajaran.deleted_at,
            sync_status: mataPelajaran.sync_status,
            last_synced_at: mataPelajaran.last_synced_at,
            version: mataPelajaran.version,
          })
          .from(guruMapel)
          .innerJoin(mataPelajaran, eq(guruMapel.mata_pelajaran_id, mataPelajaran.id))
          .where(and(eq(guruMapel.pegawai_id, id), isNull(guruMapel.deleted_at)));
        setMapelList(mRes);
      }

      // 3. Riwayat Pendidikan
      const rRes = await db
        .select()
        .from(riwayatPendidikan)
        .where(
          and(
            eq(riwayatPendidikan.pegawai_id, id),
            isNull(riwayatPendidikan.deleted_at)
          )
        );
      setRiwayatList(rRes);

      // 4. Dokumen Pendukung
      const dRes = await db
        .select()
        .from(dokumenPendukung)
        .where(
          and(
            eq(dokumenPendukung.documentable_type, "pegawai"),
            eq(dokumenPendukung.documentable_id, id),
            isNull(dokumenPendukung.deleted_at)
          )
        );
      setDokumenList(dRes);
    } catch (e) {
      console.warn("Gagal membaca detail pegawai:", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // Cetak Biodata PDF
  const handlePrintPdf = async () => {
    if (!data) return;
    setGeneratingPdf(true);
    try {
      const res = await generateAndSharePegawaiBiodataPdf({
        pegawai: data,
        nikDecrypted,
        npwpDecrypted,
        rekeningDecrypted,
        mataPelajaranList: mapelList,
        riwayatPendidikan: riwayatList,
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
        message: e?.message || "Terjadi kesalahan sistem.",
        type: "error",
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // --- TAB MAPEL: TAMBAH KOMPETENSI ---
  const openAddMapelModal = async () => {
    try {
      const allActive = await db
        .select()
        .from(mataPelajaran)
        .where(and(eq(mataPelajaran.is_active, 1), isNull(mataPelajaran.deleted_at)));

      const alreadyAssigned = new Set(mapelList.map((m) => m.id));
      const unassigned = allActive.filter((m) => !alreadyAssigned.has(m.id));

      setAvailableMapel(unassigned);
      setSelectedMapelId(unassigned[0]?.id || null);
      setModalMapelVisible(true);
    } catch (e) {
      console.warn("Gagal memuat mapel:", e);
    }
  };

  const handleSaveMapel = async () => {
    if (!selectedMapelId || !id) return;
    try {
      const now = getIsoUtcString();
      await db.insert(guruMapel).values({
        id: generateUUID(),
        created_at: now,
        updated_at: now,
        deleted_at: null,
        sync_status: "pending_push",
        last_synced_at: null,
        version: 1,
        pegawai_id: id,
        mata_pelajaran_id: selectedMapelId,
      });

      await refreshPendingCountAsync();
      setModalMapelVisible(false);
      await loadAll();
    } catch (e: any) {
      showAlert({
        title: "Gagal Menambahkan",
        message: e?.message || "Terjadi kesalahan database.",
        type: "error",
      });
    }
  };

  const handleRemoveMapel = (m: MataPelajaran) => {
    showAlert({
      title: "Hapus Mata Pelajaran",
      message: `Hapus kompetensi '${m.nama_mapel}' dari guru ini?`,
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
                .update(guruMapel)
                .set({
                  deleted_at: now,
                  updated_at: now,
                  sync_status: "pending_push",
                })
                .where(
                  and(
                    eq(guruMapel.pegawai_id, id!),
                    eq(guruMapel.mata_pelajaran_id, m.id)
                  )
                );

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

  // --- TAB PENDIDIKAN: TAMBAH RIWAYAT ---
  const handleSavePendidikan = async () => {
    if (!formInstitusi.trim() || !id) {
      showAlert({
        title: "Institusi Wajib Diisi",
        message: "Masukkan nama sekolah atau perguruan tinggi.",
        type: "warning",
      });
      return;
    }

    try {
      const now = getIsoUtcString();
      await db.insert(riwayatPendidikan).values({
        id: generateUUID(),
        created_at: now,
        updated_at: now,
        deleted_at: null,
        sync_status: "pending_push",
        last_synced_at: null,
        version: 1,
        pegawai_id: id,
        jenjang: formJenjang,
        institusi: formInstitusi.trim(),
        jurusan: formJurusan.trim() || null,
        tahun_lulus: formTahunLulus.trim() || null,
      });

      await refreshPendingCountAsync();
      setModalPendidikanVisible(false);
      setFormInstitusi("");
      setFormJurusan("");
      setFormTahunLulus("");
      await loadAll();
    } catch (e: any) {
      showAlert({
        title: "Gagal Menyimpan",
        message: e?.message || "Terjadi kesalahan database.",
        type: "error",
      });
    }
  };

  const handleRemovePendidikan = (r: RiwayatPendidikan) => {
    showAlert({
      title: "Hapus Riwayat Pendidikan",
      message: `Hapus data pendidikan ${r.jenjang} di ${r.institusi}?`,
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
                .update(riwayatPendidikan)
                .set({
                  deleted_at: now,
                  updated_at: now,
                  sync_status: "pending_push",
                })
                .where(eq(riwayatPendidikan.id, r.id));

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

  // --- TAB DOKUMEN: UNGGAH DOKUMEN DIGITAL ---
  const handlePickDocument = async () => {
    if (!id) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        const now = getIsoUtcString();
        const docId = generateUUID();

        let savedLocalPath = file.uri;
        // Salin berkas ke direktori dokumen permanen internal aplikasi agar aman dan terisolasi
        try {
          const docDir = `${FileSystem.documentDirectory}dokumen/`;
          const dirInfo = await FileSystem.getInfoAsync(docDir);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(docDir, { intermediates: true });
          }
          const ext = file.name.includes(".")
            ? file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
            : "";
          const targetPath = `${docDir}${docId}${ext}`;
          await FileSystem.copyAsync({
            from: file.uri,
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
          documentable_type: "pegawai",
          documentable_id: id,
          jenis_dokumen: "SK",
          nama_dokumen: file.name,
          local_file_path: savedLocalPath,
          remote_file_url: null,
          ukuran_file: file.size || null,
          uploaded_by: user?.id || null,
        });

        await refreshPendingCountAsync();
        await loadAll();
        showAlert({
          title: "Dokumen Berhasil Ditambahkan",
          message: `Berkas '${file.name}' tersimpan di penyimpanan lokal perangkat.`,
          type: "success",
        });
      }
    } catch (e: any) {
      showAlert({
        title: "Gagal Membaca Berkas",
        message: e?.message || "Terjadi kesalahan saat memilih dokumen",
        type: "error",
      });
    }
  };

  const handleRemoveDokumen = (doc: DokumenPendukung) => {
    showAlert({
      title: "Hapus Dokumen",
      message: `Hapus dokumen '${doc.nama_dokumen}' dari profil pegawai ini?`,
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

  // Hapus Pegawai (Khusus Super Admin)
  const handleDeletePegawai = async () => {
    if (!data || !id) return;
    setIsDeletingPegawai(true);
    try {
      const now = getIsoUtcString();

      // 1. Soft-delete data pegawai
      await db
        .update(pegawai)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
          version: (data.version || 1) + 1,
        })
        .where(eq(pegawai.id, id));

      // 2. Cascade soft-delete penugasan mapel
      await db
        .update(guruMapel)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
        })
        .where(eq(guruMapel.pegawai_id, id));

      // 3. Cascade soft-delete riwayat pendidikan
      await db
        .update(riwayatPendidikan)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
        })
        .where(eq(riwayatPendidikan.pegawai_id, id));

      // 4. Cascade soft-delete dokumen pendukung
      await db
        .update(dokumenPendukung)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
        })
        .where(eq(dokumenPendukung.documentable_id, id));

      // 5. Cascade soft-delete pengampu kelas
      await db
        .update(pengampuKelas)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
        })
        .where(eq(pengampuKelas.pegawai_id, id));

      // 6. Lepas jabatan wali kelas pada rombel jika ada
      await db
        .update(kelas)
        .set({
          wali_kelas_id: null,
          updated_at: now,
          sync_status: "pending_push",
        })
        .where(eq(kelas.wali_kelas_id, id));

      await refreshPendingCountAsync();
      setConfirmDeletePegawaiVisible(false);
      showToast("Data pegawai berhasil dihapus.");
      router.back();
    } catch (e: any) {
      showAlert({
        title: "Gagal Menghapus Pegawai",
        message: e?.message || "Terjadi kesalahan saat menghapus data pegawai.",
        type: "error",
      });
    } finally {
      setIsDeletingPegawai(false);
    }
  };

  const detailTabs: TabOption[] = useMemo(() => {
    const tabs: TabOption[] = [{ key: "biodata", label: "Biodata" }];
    if (data?.jenis === "guru") {
      tabs.push({ key: "mapel", label: "Mapel", badge: mapelList.length });
    }
    tabs.push({ key: "pendidikan", label: "Pendidikan", badge: riwayatList.length });
    tabs.push({ key: "dokumen", label: "Berkas", badge: dokumenList.length });
    return tabs;
  }, [data?.jenis, mapelList.length, riwayatList.length, dokumenList.length]);

  if (!data) {
    return (
      <AppShell title="Detail Pegawai" showBack onBack={() => router.back()}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Memuat profil pegawai...</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={data.nama_lengkap}
      subtitle={data.jenis === "guru" ? "Tenaga Pendidik" : "Tenaga Kependidikan"}
      showBack
      onBack={() => router.back()}
      rightAction={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Opsi Tindakan Pegawai"
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
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[600]} />}
      >
        {/* Top Header Card */}
        <ModernCard style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.headerCategoryLabel}>
              {data.jenis === "guru" ? "TENAGA PENDIDIK" : "TENAGA KEPENDIDIKAN"}
            </Text>
            <Badge
              label={data.status_aktif.toUpperCase()}
              variant={data.status_aktif === "aktif" ? "active" : "neutral"}
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
              <Text style={styles.profileName}>{data.nama_lengkap}</Text>
              <Text style={styles.profileJabatan}>
                {data.jabatan || (data.jenis === "guru" ? "Guru Mapel" : "Staf Kependidikan")}
              </Text>
              {data.tugas_tambahan && (
                <Text style={styles.profileTugas}>Tugas: {data.tugas_tambahan}</Text>
              )}
              <View style={styles.metaBadgeRow}>
                <Badge
                  label={data.jenis === "guru" ? "TENAGA PENDIDIK" : "TENDIK"}
                  variant={data.jenis === "guru" ? "primary" : "neutral"}
                  size="sm"
                />
                <Badge label={data.status_kepegawaian} variant="gold" size="sm" />
              </View>
            </View>
          </View>

          {/* Action Button Row */}
          <View style={styles.headerActionRow}>
            <ModernButton
              title={generatingPdf ? "Mencetak..." : "Cetak PDF Biodata"}
              variant="secondary"
              size="sm"
              onPress={handlePrintPdf}
              loading={generatingPdf}
              icon={<Ionicons name="print-outline" size={17} color={colors.primary[700]} />}
              style={{ flex: 1 }}
            />

            {isOperator && (
              <ModernButton
                title="Edit Data"
                variant="primary"
                size="sm"
                onPress={() =>
                  router.push({
                    pathname: "/(app)/pegawai/form",
                    params: { id: data.id },
                  })
                }
                icon={<Ionicons name="create-outline" size={17} color={colors.neutral.white} />}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </ModernCard>

        {/* Segmented Tabs */}
        <SegmentedTabs
          tabs={detailTabs}
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as ActiveTab)}
          style={{ marginBottom: spacing.md }}
        />
        {/* ================= TAB 1: BIODATA ================= */}
        {activeTab === "biodata" && (
          <View style={styles.tabContent}>
            {/* Kepegawaian & EMIS */}
            <ModernCard style={styles.card}>
              <Text style={styles.cardSectionTitle}>Data Kepegawaian & EMIS</Text>
              <View style={styles.infoTable}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NIP</Text>
                  <Text style={styles.infoVal}>{data.nip || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NUPTK</Text>
                  <Text style={styles.infoVal}>{data.nuptk || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NPK Kemenag</Text>
                  <Text style={styles.infoVal}>{data.npk || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>PegID Simpatika</Text>
                  <Text style={styles.infoVal}>{data.pegid || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>TMT Pengangkatan</Text>
                  <Text style={styles.infoVal}>{data.tmt || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nomor SK</Text>
                  <Text style={styles.infoVal}>{data.sk_pengangkatan_nomor || "-"}</Text>
                </View>
              </View>
            </ModernCard>

            {/* Identitas Diri */}
            <ModernCard style={styles.card}>
              <Text style={styles.cardSectionTitle}>Identitas Pribadi & Alamat</Text>
              <View style={styles.infoTable}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NIK (Kependudukan)</Text>
                  <Text style={styles.infoVal}>{nikDecrypted}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Jenis Kelamin</Text>
                  <Text style={styles.infoVal}>
                    {data.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tempat, Tanggal Lahir</Text>
                  <Text style={styles.infoVal}>
                    {data.tempat_lahir || "-"}, {data.tanggal_lahir || "-"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Kontak WhatsApp</Text>
                  <Text style={styles.infoVal}>{data.no_hp || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Alamat Email</Text>
                  <Text style={styles.infoVal}>{data.email || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Alamat Domisili</Text>
                  <Text style={styles.infoVal}>
                    {data.alamat_jalan || "-"} RT {data.rt || "-"} RW {data.rw || "-"}, Desa{" "}
                    {data.desa || "-"}, Kec. {data.kecamatan || "-"}, {data.kabupaten || "-"},{" "}
                    {data.provinsi || "-"}
                  </Text>
                </View>
              </View>
            </ModernCard>

            {/* Keuangan & Rekening */}
            <ModernCard style={styles.card}>
              <Text style={styles.cardSectionTitle}>Data Rekening & Keuangan (AES-256)</Text>
              <View style={styles.infoTable}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NPWP</Text>
                  <Text style={styles.infoVal}>{npwpDecrypted}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nama Bank</Text>
                  <Text style={styles.infoVal}>{data.nama_bank || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nomor Rekening</Text>
                  <Text style={styles.infoVal}>{rekeningDecrypted}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Atas Nama</Text>
                  <Text style={styles.infoVal}>{data.atas_nama_rekening || "-"}</Text>
                </View>
              </View>
            </ModernCard>
          </View>
        )}

        {/* ================= TAB 2: MAPEL KEAHLIAN (guru_mapel) ================= */}
        {activeTab === "mapel" && (
          <View style={styles.tabContent}>
            <View style={styles.tabActionHeader}>
              <Text style={styles.tabHeaderLabel}>Mata Pelajaran yang Diampu</Text>
              {isOperator && (
                <ModernButton
                  title="+ Mapel"
                  size="sm"
                  onPress={openAddMapelModal}
                  icon={<Ionicons name="add" size={16} color={colors.neutral.white} />}
                />
              )}
            </View>

            {mapelList.length === 0 ? (
              <ModernCard style={styles.emptyCard}>
                <Ionicons name="book-outline" size={42} color={colors.neutral.textMuted} />
                <Text style={styles.emptyTitle}>Belum Ada Mapel Keahlian</Text>
                <Text style={styles.emptyDesc}>
                  Tekan tombol '+ Mapel' untuk menetapkan mata pelajaran yang dikuasai guru ini.
                </Text>
              </ModernCard>
            ) : (
              mapelList.map((m) => (
                <ModernCard key={m.id} style={styles.itemCard}>
                  <View style={styles.itemRow}>
                    <View style={styles.mapelCodeBadge}>
                      <Text style={styles.mapelCodeText}>{m.kode_mapel}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{m.nama_mapel}</Text>
                      <Text style={styles.itemMeta}>Kelompok: {m.kelompok}</Text>
                    </View>
                    {isOperator && (
                      <Pressable
                        onPress={() => handleRemoveMapel(m)}
                        hitSlop={8}
                        style={({ pressed }) => [styles.trashBtn, pressed && styles.pressedState]}
                        accessibilityRole="button"
                        accessibilityLabel={`Hapus mapel ${m.nama_mapel}`}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={colors.status.cancelled}
                        />
                      </Pressable>
                    )}
                  </View>
                </ModernCard>
              ))
            )}
          </View>
        )}

        {/* ================= TAB 3: RIWAYAT PENDIDIKAN ================= */}
        {activeTab === "pendidikan" && (
          <View style={styles.tabContent}>
            <View style={styles.tabActionHeader}>
              <Text style={styles.tabHeaderLabel}>Riwayat Pendidikan Formal</Text>
              {canEdit && (
                <ModernButton
                  title="+ Pendidikan"
                  size="sm"
                  onPress={() => setModalPendidikanVisible(true)}
                  icon={<Ionicons name="add" size={16} color={colors.neutral.white} />}
                />
              )}
            </View>

            {riwayatList.length === 0 ? (
              <ModernCard style={styles.emptyCard}>
                <Ionicons name="school-outline" size={42} color={colors.neutral.textMuted} />
                <Text style={styles.emptyTitle}>Belum Ada Riwayat Pendidikan</Text>
                <Text style={styles.emptyDesc}>
                  Catat jenjang pendidikan SD/MI hingga Perguruan Tinggi untuk arsip data EMIS.
                </Text>
              </ModernCard>
            ) : (
              riwayatList.map((r) => (
                <ModernCard key={r.id} style={styles.itemCard}>
                  <View style={styles.itemRow}>
                    <View style={styles.jenjangBadge}>
                      <Text style={styles.jenjangText}>{r.jenjang}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{r.institusi}</Text>
                      <Text style={styles.itemMeta}>
                        {r.jurusan ? `${r.jurusan} • ` : ""}Lulus Tahun: {r.tahun_lulus || "-"}
                      </Text>
                    </View>
                    {canEdit && (
                      <Pressable
                        onPress={() => handleRemovePendidikan(r)}
                        hitSlop={8}
                        style={({ pressed }) => [styles.trashBtn, pressed && styles.pressedState]}
                        accessibilityRole="button"
                        accessibilityLabel={`Hapus riwayat pendidikan ${r.institusi}`}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={colors.status.cancelled}
                        />
                      </Pressable>
                    )}
                  </View>
                </ModernCard>
              ))
            )}
          </View>
        )}

        {/* ================= TAB 4: DOKUMEN DIGITAL ================= */}
        {activeTab === "dokumen" && (
          <View style={styles.tabContent}>
            <View style={styles.tabActionHeader}>
              <Text style={styles.tabHeaderLabel}>Berkas SK & Dokumen Digital</Text>
              {canEdit && (
                <ModernButton
                  title="+ Berkas"
                  size="sm"
                  onPress={handlePickDocument}
                  icon={<Ionicons name="cloud-upload-outline" size={16} color={colors.neutral.white} />}
                />
              )}
            </View>

            {dokumenList.length === 0 ? (
              <ModernCard style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={42} color={colors.neutral.textMuted} />
                <Text style={styles.emptyTitle}>Belum Ada Berkas Digital</Text>
                <Text style={styles.emptyDesc}>
                  Simpan arsip SK Pengangkatan, KTP, atau Sertifikat Pendidik dalam bentuk PDF/Foto.
                </Text>
              </ModernCard>
            ) : (
              dokumenList.map((d) => (
                <ModernCard key={d.id} style={styles.itemCard}>
                  <View style={styles.itemRow}>
                    <View style={styles.docIconBox}>
                      <Ionicons name="document-attach" size={20} color={colors.primary[700]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{d.nama_dokumen}</Text>
                      <Text style={styles.itemMeta}>
                        Jenis: {d.jenis_dokumen} • Ukuran:{" "}
                        {d.ukuran_file ? `${Math.round(d.ukuran_file / 1024)} KB` : "-"}
                      </Text>
                    </View>
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
                      {canEdit && (
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

      {/* Modal Tambah Mapel Keahlian */}
      <Modal visible={modalMapelVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Tambah Kompetensi Mapel</Text>
                <Text style={styles.modalSubtitle}>Pilih mata pelajaran dari Master Kurikulum</Text>
              </View>
              <Pressable
                onPress={() => setModalMapelVisible(false)}
                hitSlop={8}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog mapel"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={true}>
              {availableMapel.length === 0 ? (
                <Text style={styles.emptyChoiceText}>
                  Semua mata pelajaran aktif sudah terhubung dengan guru ini.
                </Text>
              ) : (
                availableMapel.map((m) => {
                  const isSel = selectedMapelId === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setSelectedMapelId(m.id)}
                      style={({ pressed }) => [
                        styles.choiceItem,
                        isSel && styles.choiceItemActive,
                        pressed && styles.pressedState,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSel }}
                    >
                      <View style={styles.mapelCodeMini}>
                        <Text style={styles.mapelCodeMiniText}>{m.kode_mapel}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.choiceTitle, isSel && styles.choiceTitleActive]}>
                          {m.nama_mapel}
                        </Text>
                        <Text style={styles.choiceSub}>Kelompok: {m.kelompok}</Text>
                      </View>
                      {isSel && (
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary[700]} />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                onPress={() => setModalMapelVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title="Tambahkan"
                variant="primary"
                size="md"
                onPress={handleSaveMapel}
                disabled={!selectedMapelId}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Tambah Riwayat Pendidikan */}
      <Modal visible={modalPendidikanVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Tambah Riwayat Pendidikan</Text>
                <Text style={styles.modalSubtitle}>Arsip jenjang pendidikan formal pegawai</Text>
              </View>
              <Pressable
                onPress={() => setModalPendidikanVisible(false)}
                hitSlop={8}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog riwayat pendidikan"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Jenjang Pendidikan</Text>
              <View style={styles.jenjangRow}>
                {["SD/MI", "SMP/MTs", "SMA/MA", "D3", "S1", "S2", "S3"].map((j) => {
                  const isSel = formJenjang === j;
                  return (
                    <Pressable
                      key={j}
                      onPress={() => setFormJenjang(j)}
                      style={({ pressed }) => [
                        styles.jenjangChip,
                        isSel && styles.jenjangChipActive,
                        pressed && styles.pressedState,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSel }}
                    >
                      <Text style={[styles.jenjangChipText, isSel && styles.jenjangChipTextActive]}>
                        {j}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nama Institusi / Universitas *</Text>
              <TextInput
                value={formInstitusi}
                onChangeText={setFormInstitusi}
                placeholder="Contoh: UIN Maulana Malik Ibrahim Malang"
                style={styles.modalInput}
                placeholderTextColor={colors.neutral.textMuted}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Program Studi / Jurusan</Text>
              <TextInput
                value={formJurusan}
                onChangeText={setFormJurusan}
                placeholder="Pendidikan Agama Islam"
                style={styles.modalInput}
                placeholderTextColor={colors.neutral.textMuted}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tahun Kelulusan</Text>
              <TextInput
                value={formTahunLulus}
                onChangeText={setFormTahunLulus}
                placeholder="2016"
                keyboardType="numeric"
                maxLength={4}
                style={styles.modalInput}
                placeholderTextColor={colors.neutral.textMuted}
              />
            </View>

            <View style={styles.modalActions}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                onPress={() => setModalPendidikanVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title="Simpan Pendidikan"
                variant="primary"
                size="md"
                onPress={handleSavePendidikan}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>

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
                <Text style={styles.modalTitle}>Tindakan Pegawai</Text>
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
                accessibilityLabel="Cetak PDF Biodata"
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
                <Text style={styles.menuItemText}>Cetak PDF Biodata</Text>
              </Pressable>

              {isOperator && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit Biodata Pegawai"
                  onPress={() => {
                    setMenuActionVisible(false);
                    router.push({
                      pathname: "/(app)/pegawai/form",
                      params: { id: data.id },
                    });
                  }}
                  style={({ pressed }) => [
                    styles.menuItemRow,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary[700]} />
                  <Text style={styles.menuItemText}>Edit Data Pegawai</Text>
                </Pressable>
              )}

              {isSuperAdmin && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hapus Data Pegawai"
                  onPress={() => {
                    setMenuActionVisible(false);
                    setConfirmDeletePegawaiVisible(true);
                  }}
                  style={({ pressed }) => [
                    styles.menuItemRow,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.status.conflict} />
                  <Text style={[styles.menuItemText, { color: colors.status.conflict }]}>
                    Hapus Pegawai Ini
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ConfirmDialog Hapus Pegawai (Khusus Super Admin) */}
      <ConfirmDialog
        visible={confirmDeletePegawaiVisible}
        title="Hapus Data Pegawai?"
        message={`Apakah Anda yakin ingin menghapus data pegawai '${data.nama_lengkap}'?\n\nSebagai Super Admin, seluruh data penugasan mapel, pengampu kelas, riwayat pendidikan, dan berkas lampirannya akan ditandai terhapus.`}
        variant="danger"
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        loading={isDeletingPegawai}
        onConfirm={handleDeletePegawai}
        onCancel={() => setConfirmDeletePegawaiVisible(false)}
      />
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
  headerCategoryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary[700],
    letterSpacing: 0.5,
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
    height: 68,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.primary[200],
  },
  avatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    borderWidth: 2,
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
  profileJabatan: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  profileTugas: {
    fontSize: 12,
    color: colors.primary[700],
    fontWeight: "600",
    marginTop: 1,
  },
  metaBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  headerActionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.borderSubtle,
    paddingTop: spacing.md,
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
  itemCard: {
    padding: spacing.md,
    marginBottom: 2,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  mapelCodeBadge: {
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
  mapelCodeText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary[700],
  },
  jenjangBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.accent.indigoLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#C7D2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  jenjangText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accent.indigo,
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
  emptyChoiceText: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  choiceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.canvas,
    marginBottom: 6,
  },
  choiceItemActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  mapelCodeMini: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: colors.primary[100],
    borderRadius: radius.sm,
    borderCurve: "continuous",
  },
  mapelCodeMiniText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary[800],
  },
  choiceTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  choiceTitleActive: {
    color: colors.primary[800],
  },
  choiceSub: {
    fontSize: 11,
    color: colors.neutral.textMuted,
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
  modalInput: {
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: spacing.md,
    height: 40,
    fontSize: 13,
    color: colors.neutral.textPrimary,
  },
  jenjangRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  jenjangChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.canvas,
  },
  jenjangChipActive: {
    backgroundColor: colors.primary[700],
    borderColor: colors.primary[700],
  },
  jenjangChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.neutral.textSecondary,
  },
  jenjangChipTextActive: {
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
  menuItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
});
