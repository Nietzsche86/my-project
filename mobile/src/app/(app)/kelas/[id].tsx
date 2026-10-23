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
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
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
  EmptyState,
  ConfirmDialog,
  useToast,
} from "../../../components/ui";
import { db } from "../../../db/client";
import {
  kelas,
  pegawai,
  siswa,
  anggotaKelas,
  pengampuKelas,
  mataPelajaran,
  guruMapel,
  tahunAjaran,
  type Kelas,
  type TahunAjaran,
  type Pegawai,
  type Siswa,
  type MataPelajaran,
} from "../../../db/schema";
import { isNull, eq, and, desc } from "drizzle-orm";
import { Ionicons } from "@expo/vector-icons";
import { generateUUID, getIsoUtcString } from "../../../db/crypto";
import { generateAndShareAbsensiKelasPdf } from "../../../utils/pdfGenerator";

interface AnggotaSiswaItem {
  id: string; // id anggota_kelas
  siswaId: string;
  namaLengkap: string;
  nis: string | null;
  nisn: string | null;
  jenisKelamin: string;
  status: string;
}

interface PengampuItem {
  id: string; // id pengampu_kelas
  pegawaiId: string;
  guruNama: string;
  guruNip: string | null;
  mapelId: string;
  mapelKode: string;
  mapelNama: string;
  mapelKelompok: string;
}

interface ClassOption {
  id: string;
  nama: string;
  tingkat: number;
  tahunAjaranId: string;
  tahunAjaranNama: string;
  tahunAjaranSemester?: string;
}

export default function DetailKelasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useAuth();
  const { refreshPendingCountAsync } = useSync();
  const { showAlert } = useAlert();
  const { showToast } = useToast();
  const isOperator = role === "super_admin" || role === "staf_tu";
  const isSuperAdmin = role === "super_admin";

  const [confirmDeleteKelasVisible, setConfirmDeleteKelasVisible] = useState(false);
  const [isDeletingKelas, setIsDeletingKelas] = useState(false);

  const [activeTab, setActiveTab] = useState<"siswa" | "pengampu">("siswa");
  const [classData, setClassData] = useState<Kelas | null>(null);
  const [periodData, setPeriodData] = useState<TahunAjaran | null>(null);
  const [waliNama, setWaliNama] = useState("Belum Ditentukan");
  const [waliNip, setWaliNip] = useState<string | null>(null);

  const [students, setStudents] = useState<AnggotaSiswaItem[]>([]);
  const [pengampuList, setPengampuList] = useState<PengampuItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [printingPresensi, setPrintingPresensi] = useState(false);

  // Search in tabs
  const [searchSiswa, setSearchSiswa] = useState("");
  const [searchPengampu, setSearchPengampu] = useState("");

  // Modal Tambah Siswa ke Kelas
  const [modalSiswaVisible, setModalSiswaVisible] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<Siswa[]>([]);
  const [searchCandidate, setSearchCandidate] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [savingSiswa, setSavingSiswa] = useState(false);

  // Modal Tugaskan Guru Mapel
  const [modalPengampuVisible, setModalPengampuVisible] = useState(false);
  const [allTeachers, setAllTeachers] = useState<Pegawai[]>([]);
  const [allSubjects, setAllSubjects] = useState<MataPelajaran[]>([]);
  const [guruMapelMap, setGuruMapelMap] = useState<Record<string, string[]>>({});
  const [selectedGuruId, setSelectedGuruId] = useState<string | null>(null);
  const [selectedMapelId, setSelectedMapelId] = useState<string | null>(null);
  const [savingPengampu, setSavingPengampu] = useState(false);

  // Modal Aksi Rombel Massal
  const [modalMassalVisible, setModalMassalVisible] = useState(false);
  const [massActionType, setMassActionType] = useState<"naik" | "pindah" | "lulus">("naik");
  const [selectedMassStudentIds, setSelectedMassStudentIds] = useState<string[]>([]);
  const [allClassOptions, setAllClassOptions] = useState<ClassOption[]>([]);
  const [targetClassId, setTargetClassId] = useState<string | null>(null);
  const [tahunLulusMassal, setTahunLulusMassal] = useState<string>(new Date().getFullYear().toString());
  const [processingMassal, setProcessingMassal] = useState(false);

  // Tahun Ajaran untuk Kenaikan Kelas Massal
  const [allTahunAjaranList, setAllTahunAjaranList] = useState<TahunAjaran[]>([]);
  const [targetTahunAjaranId, setTargetTahunAjaranId] = useState<string | null>(null);

  // Quick Buat Kelas Baru di TA Terpilih
  const [quickCreateClassVisible, setQuickCreateClassVisible] = useState(false);
  const [quickClassName, setQuickClassName] = useState("");
  const [creatingQuickClass, setCreatingQuickClass] = useState(false);

  // Quick Buat Tahun Ajaran Baru
  const [quickCreateTaVisible, setQuickCreateTaVisible] = useState(false);
  const [quickTaName, setQuickTaName] = useState("");
  const [creatingQuickTa, setCreatingQuickTa] = useState(false);

  useEffect(() => {
    if (id) {
      loadAll();
    }
  }, [id]);

  const loadAll = async () => {
    if (!id) return;
    try {
      // 1. Ambil Data Kelas
      const kRes = await db
        .select()
        .from(kelas)
        .where(eq(kelas.id, id))
        .limit(1);

      if (kRes.length === 0 || !kRes[0]) {
        showAlert({
          title: "Data Tidak Ditemukan",
          message: "Rombel kelas tidak ditemukan atau sudah dihapus.",
          type: "error",
        });
        router.back();
        return;
      }
      const k = kRes[0];
      setClassData(k);

      // 2. Ambil Data Tahun Ajaran
      const taRes = await db
        .select()
        .from(tahunAjaran)
        .where(eq(tahunAjaran.id, k.tahun_ajaran_id))
        .limit(1);
      if (taRes.length > 0 && taRes[0]) {
        setPeriodData(taRes[0]);
      }

      // 3. Ambil Data Wali Kelas
      if (k.wali_kelas_id) {
        const wRes = await db
          .select()
          .from(pegawai)
          .where(eq(pegawai.id, k.wali_kelas_id))
          .limit(1);
        if (wRes.length > 0 && wRes[0]) {
          setWaliNama(wRes[0].nama_lengkap);
          setWaliNip(wRes[0].nip);
        } else {
          setWaliNama("Belum Ditentukan");
          setWaliNip(null);
        }
      } else {
        setWaliNama("Belum Ditentukan");
        setWaliNip(null);
      }

      // 4. Ambil Anggota Siswa Kelas
      const aList = await db
        .select({
          id: anggotaKelas.id,
          siswaId: siswa.id,
          namaLengkap: siswa.nama_lengkap,
          nis: siswa.nis,
          nisn: siswa.nisn,
          jenisKelamin: siswa.jenis_kelamin,
          status: siswa.status,
        })
        .from(anggotaKelas)
        .innerJoin(siswa, eq(anggotaKelas.siswa_id, siswa.id))
        .where(
          and(
            eq(anggotaKelas.kelas_id, id),
            isNull(anggotaKelas.deleted_at),
            isNull(siswa.deleted_at)
          )
        );

      aList.sort((a, b) => a.namaLengkap.localeCompare(b.namaLengkap));
      setStudents(aList);

      // 5. Ambil Pengampu Kelas & Mapel
      const pList = await db
        .select({
          id: pengampuKelas.id,
          pegawaiId: pegawai.id,
          guruNama: pegawai.nama_lengkap,
          guruNip: pegawai.nip,
          mapelId: mataPelajaran.id,
          mapelKode: mataPelajaran.kode_mapel,
          mapelNama: mataPelajaran.nama_mapel,
          mapelKelompok: mataPelajaran.kelompok,
        })
        .from(pengampuKelas)
        .innerJoin(pegawai, eq(pengampuKelas.pegawai_id, pegawai.id))
        .innerJoin(mataPelajaran, eq(pengampuKelas.mata_pelajaran_id, mataPelajaran.id))
        .where(
          and(
            eq(pengampuKelas.kelas_id, id),
            isNull(pengampuKelas.deleted_at),
            isNull(pegawai.deleted_at),
            isNull(mataPelajaran.deleted_at)
          )
        );

      pList.sort((a, b) => a.mapelNama.localeCompare(b.mapelNama));
      setPengampuList(pList);
    } catch (e) {
      console.warn("Gagal memuat detail rombel:", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // --- PRINT FORM PRESENSI KELAS (PDF) ---
  const handlePrintPresensi = async () => {
    if (!classData) return;
    setPrintingPresensi(true);

    try {
      const siswaList = students.map((s, idx) => ({
        nomor: idx + 1,
        nis: s.nis,
        namaLengkap: s.namaLengkap,
        jenisKelamin: s.jenisKelamin,
      }));

      const res = await generateAndShareAbsensiKelasPdf({
        kelasNama: classData.nama,
        tingkat: classData.tingkat,
        tahunAjaranNama: periodData?.nama || "-",
        semesterNama: periodData?.nama_semester || "-",
        waliKelasName: waliNama,
        waliKelasNip: waliNip || undefined,
        siswaList,
      });

      if (res.success) {
        showAlert({
          title: "Form Presensi Dicetak",
          message: res.message,
          type: "success",
        });
      } else {
        showAlert({
          title: "Gagal Mencetak",
          message: res.message,
          type: "error",
        });
      }
    } catch (e: any) {
      showAlert({
        title: "Gagal Cetak Presensi",
        message: e?.message || "Terjadi kesalahan sistem saat membuat file PDF.",
        type: "error",
      });
    } finally {
      setPrintingPresensi(false);
    }
  };

  // --- TAB SISWA: TAMBAH SISWA ---
  const openAddSiswaModal = async () => {
    if (!classData) return;
    try {
      const allActiveSiswa = await db
        .select()
        .from(siswa)
        .where(and(eq(siswa.status, "aktif"), isNull(siswa.deleted_at)));

      const registeredInPeriod = await db
        .select({ siswa_id: anggotaKelas.siswa_id })
        .from(anggotaKelas)
        .where(
          and(
            eq(anggotaKelas.tahun_ajaran_id, classData.tahun_ajaran_id),
            isNull(anggotaKelas.deleted_at)
          )
        );

      const registeredSet = new Set(registeredInPeriod.map((r) => r.siswa_id));
      const unassigned = allActiveSiswa.filter((s) => !registeredSet.has(s.id));
      unassigned.sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));

      setAvailableStudents(unassigned);
      setSelectedStudentIds([]);
      setSearchCandidate("");
      setModalSiswaVisible(true);
    } catch (e) {
      console.warn("Gagal mencari calon siswa:", e);
    }
  };

  const toggleSelectStudent = (siswaId: string) => {
    if (selectedStudentIds.includes(siswaId)) {
      setSelectedStudentIds(selectedStudentIds.filter((s) => s !== siswaId));
    } else {
      setSelectedStudentIds([...selectedStudentIds, siswaId]);
    }
  };

  const handleSaveSiswa = async () => {
    if (selectedStudentIds.length === 0) {
      showAlert({
        title: "Pilih Siswa",
        message: "Pilih minimal satu siswa untuk dimasukkan ke rombel.",
        type: "warning",
      });
      return;
    }
    if (!classData) return;

    setSavingSiswa(true);
    const now = getIsoUtcString();

    try {
      for (const sId of selectedStudentIds) {
        const existing = await db
          .select()
          .from(anggotaKelas)
          .where(
            and(
              eq(anggotaKelas.siswa_id, sId),
              eq(anggotaKelas.tahun_ajaran_id, classData.tahun_ajaran_id)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(anggotaKelas)
            .set({
              kelas_id: classData.id,
              deleted_at: null,
              updated_at: now,
              sync_status: "pending_push",
              version: (existing[0].version || 1) + 1,
            })
            .where(eq(anggotaKelas.id, existing[0].id));
        } else {
          await db.insert(anggotaKelas).values({
            id: generateUUID(),
            created_at: now,
            updated_at: now,
            deleted_at: null,
            sync_status: "pending_push",
            last_synced_at: null,
            version: 1,
            siswa_id: sId,
            kelas_id: classData.id,
            tahun_ajaran_id: classData.tahun_ajaran_id,
          });
        }
      }

      await refreshPendingCountAsync();

      setModalSiswaVisible(false);
      await loadAll();
      showAlert({
        title: "Siswa Ditambahkan",
        message: `${selectedStudentIds.length} siswa berhasil dimasukkan ke Kelas ${classData.nama}.`,
        type: "success",
      });
    } catch (e: any) {
      showAlert({
        title: "Gagal Menambahkan Siswa",
        message: e?.message || "Terjadi kesalahan database.",
        type: "error",
      });
    } finally {
      setSavingSiswa(false);
    }
  };

  const handleRemoveSiswa = (item: AnggotaSiswaItem) => {
    showAlert({
      title: "Keluarkan Siswa",
      message: `Apakah Anda yakin ingin mengeluarkan ${item.namaLengkap} dari Kelas ${classData?.nama}?`,
      type: "confirm",
      buttons: [
        { text: "Batal", style: "cancel" },
        {
          text: "Keluarkan",
          style: "destructive",
          onPress: async () => {
            try {
              const now = getIsoUtcString();
              await db
                .update(anggotaKelas)
                .set({
                  deleted_at: now,
                  updated_at: now,
                  sync_status: "pending_push",
                })
                .where(eq(anggotaKelas.id, item.id));

              await refreshPendingCountAsync();
              await loadAll();
              showAlert({
                title: "Berhasil",
                message: `${item.namaLengkap} telah dikeluarkan dari kelas.`,
                type: "info",
              });
            } catch (e: any) {
              showAlert({
                title: "Gagal Mengeluarkan Siswa",
                message: e?.message || "Terjadi kesalahan sistem.",
                type: "error",
              });
            }
          },
        },
      ],
    });
  };

  // --- AKSI ROMBEL MASSAL (NAIK KELAS, PINDAH ROMBEL, KELULUSAN) ---
  const openMassActionModal = async () => {
    try {
      const allPeriods = await db
        .select()
        .from(tahunAjaran)
        .where(isNull(tahunAjaran.deleted_at))
        .orderBy(desc(tahunAjaran.nama), desc(tahunAjaran.semester));

      setAllTahunAjaranList(allPeriods);

      const rawClasses = await db
        .select({
          id: kelas.id,
          nama: kelas.nama,
          tingkat: kelas.tingkat,
          tahunAjaranId: kelas.tahun_ajaran_id,
          tahunAjaranNama: tahunAjaran.nama,
          tahunAjaranSemester: tahunAjaran.nama_semester,
        })
        .from(kelas)
        .innerJoin(tahunAjaran, eq(kelas.tahun_ajaran_id, tahunAjaran.id))
        .where(isNull(kelas.deleted_at));

      setAllClassOptions(rawClasses);
      setSelectedMassStudentIds(students.map((s) => s.siswaId));
      const isLulus = classData?.tingkat === 9;
      setMassActionType(isLulus ? "lulus" : "naik");

      // Tentukan default target Tahun Ajaran untuk naik kelas:
      if (classData && periodData) {
        let candidateTa = allPeriods.find(
          (p) => p.id !== classData.tahun_ajaran_id && p.nama > periodData.nama
        );
        if (!candidateTa) {
          candidateTa = allPeriods.find((p) => p.id !== classData.tahun_ajaran_id);
        }
        setTargetTahunAjaranId(candidateTa?.id || classData.tahun_ajaran_id);
      } else {
        setTargetTahunAjaranId(allPeriods[0]?.id || null);
      }

      setTargetClassId(null);
      setQuickCreateClassVisible(false);
      setQuickCreateTaVisible(false);
      setModalMassalVisible(true);
    } catch (e) {
      console.warn("Gagal membuka aksi massal:", e);
    }
  };

  const toggleMassStudentSelection = (sId: string) => {
    if (selectedMassStudentIds.includes(sId)) {
      setSelectedMassStudentIds(selectedMassStudentIds.filter((id) => id !== sId));
    } else {
      setSelectedMassStudentIds([...selectedMassStudentIds, sId]);
    }
  };

  const toggleSelectAllMass = () => {
    if (selectedMassStudentIds.length === students.length) {
      setSelectedMassStudentIds([]);
    } else {
      setSelectedMassStudentIds(students.map((s) => s.siswaId));
    }
  };

  const availableTargetClasses = useMemo(() => {
    if (!classData) return [];
    if (massActionType === "naik") {
      const nextTingkat = classData.tingkat + 1;
      if (!targetTahunAjaranId) return [];
      return allClassOptions.filter(
        (c) => c.tingkat === nextTingkat && c.tahunAjaranId === targetTahunAjaranId
      );
    } else if (massActionType === "pindah") {
      return allClassOptions.filter(
        (c) =>
          c.id !== classData.id &&
          c.tahunAjaranId === classData.tahun_ajaran_id &&
          c.tingkat === classData.tingkat
      );
    }
    return [];
  }, [allClassOptions, classData, massActionType, targetTahunAjaranId]);

  const handleQuickCreateClass = async () => {
    if (!quickClassName.trim() || !targetTahunAjaranId || !classData) return;
    try {
      setCreatingQuickClass(true);
      const now = getIsoUtcString();
      const newClassId = generateUUID();
      const cleanName = quickClassName.trim().toUpperCase();
      const nextTingkat = classData.tingkat + 1;

      await db.insert(kelas).values({
        id: newClassId,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        sync_status: "pending_push",
        last_synced_at: null,
        version: 1,
        tahun_ajaran_id: targetTahunAjaranId,
        nama: cleanName,
        tingkat: nextTingkat,
        wali_kelas_id: null,
      });

      const targetTa = allTahunAjaranList.find((t) => t.id === targetTahunAjaranId);
      const newOption: ClassOption = {
        id: newClassId,
        nama: cleanName,
        tingkat: nextTingkat,
        tahunAjaranId: targetTahunAjaranId,
        tahunAjaranNama: targetTa?.nama || "",
        tahunAjaranSemester: targetTa?.nama_semester || "",
      };

      setAllClassOptions((prev) => [...prev, newOption]);
      setTargetClassId(newClassId);
      setQuickCreateClassVisible(false);
      setQuickClassName("");
      await refreshPendingCountAsync();
      showToast(`Kelas ${cleanName} berhasil dibuat di TA ${targetTa?.nama || ""}!`);
    } catch (e: any) {
      showAlert({
        title: "Gagal Membuat Kelas",
        message: e?.message || "Terjadi kesalahan saat membuat kelas baru.",
        type: "error",
      });
    } finally {
      setCreatingQuickClass(false);
    }
  };

  const handleQuickCreateTa = async () => {
    const cleanTa = quickTaName.trim();
    if (!cleanTa) {
      showAlert({
        title: "Nama TA Kosong",
        message: "Masukkan nama tahun ajaran (contoh: 2027/2028).",
        type: "warning",
      });
      return;
    }

    try {
      setCreatingQuickTa(true);
      const now = getIsoUtcString();

      // Hitung tahun untuk rentang tanggal default
      const parts = cleanTa.split("/");
      let y1 = new Date().getFullYear() + 1;
      let y2 = y1 + 1;
      if (parts.length === 2) {
        const parsedY1 = parseInt(parts[0], 10);
        const parsedY2 = parseInt(parts[1], 10);
        if (!isNaN(parsedY1) && !isNaN(parsedY2)) {
          y1 = parsedY1;
          y2 = parsedY2;
        }
      }

      const idSem1 = generateUUID();
      const idSem2 = generateUUID();

      const sem1Data: TahunAjaran = {
        id: idSem1,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        sync_status: "pending_push",
        last_synced_at: null,
        version: 1,
        nama: cleanTa,
        semester: 1,
        nama_semester: "Ganjil",
        tanggal_mulai: `${y1}-07-15`,
        tanggal_selesai: `${y1}-12-20`,
        is_active: 0,
      };

      const sem2Data: TahunAjaran = {
        id: idSem2,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        sync_status: "pending_push",
        last_synced_at: null,
        version: 1,
        nama: cleanTa,
        semester: 2,
        nama_semester: "Genap",
        tanggal_mulai: `${y2}-01-05`,
        tanggal_selesai: `${y2}-06-25`,
        is_active: 0,
      };

      await db.insert(tahunAjaran).values([sem1Data, sem2Data]);
      await refreshPendingCountAsync();

      setAllTahunAjaranList((prev) => [sem1Data, sem2Data, ...prev]);
      setTargetTahunAjaranId(idSem1);
      setTargetClassId(null);
      setQuickCreateTaVisible(false);
      setQuickTaName("");
      showToast(`Tahun Ajaran ${cleanTa} (2 Semester) berhasil dibuat!`);
    } catch (e: any) {
      showAlert({
        title: "Gagal Membuat Tahun Ajaran",
        message: e?.message || "Terjadi kesalahan saat menambahkan Tahun Ajaran.",
        type: "error",
      });
    } finally {
      setCreatingQuickTa(false);
    }
  };

  const handleExecuteMassAction = async () => {
    if (selectedMassStudentIds.length === 0) {
      showAlert({
        title: "Pilih Siswa",
        message: "Pilih minimal 1 siswa untuk diproses aksi massal.",
        type: "warning",
      });
      return;
    }

    if (massActionType !== "lulus" && !targetClassId) {
      showAlert({
        title: "Pilih Kelas Tujuan",
        message: "Pilih kelas tujuan untuk rombel baru siswa.",
        type: "warning",
      });
      return;
    }

    const targetClass = allClassOptions.find((c) => c.id === targetClassId);
    const targetTa = allTahunAjaranList.find(
      (t) => t.id === (targetTahunAjaranId || targetClass?.tahunAjaranId)
    );

    const nextTingkat = (classData?.tingkat || 7) + 1;
    const actionDesc =
      massActionType === "naik"
        ? `Naikkan ${selectedMassStudentIds.length} siswa terpilih ke Kelas ${targetClass?.nama} (Tingkat ${nextTingkat}) pada Tahun Ajaran ${targetTa?.nama} - ${targetTa?.nama_semester}? Riwayat kelas sebelumnya tetap tersimpan utuh di detail siswa.`
        : massActionType === "pindah"
        ? `Pindahkan ${selectedMassStudentIds.length} siswa terpilih ke Kelas ${targetClass?.nama}?`
        : `Nyatakan LULUS untuk ${selectedMassStudentIds.length} siswa terpilih dan catat tahun kelulusan ${tahunLulusMassal}?`;

    showAlert({
      title: "Konfirmasi Aksi Massal",
      message: actionDesc,
      type: "confirm",
      buttons: [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Proses",
          style: massActionType === "lulus" ? "destructive" : "default",
          onPress: async () => {
            setProcessingMassal(true);
            const now = getIsoUtcString();

            try {
              if (massActionType === "naik" && targetClass) {
                const effectiveTaId = targetTahunAjaranId || targetClass.tahunAjaranId;
                for (const sId of selectedMassStudentIds) {
                  // Periksa apakah siswa sudah memiliki data di TA tujuan (termasuk soft-deleted)
                  const existingInTargetTa = await db
                    .select()
                    .from(anggotaKelas)
                    .where(
                      and(
                        eq(anggotaKelas.siswa_id, sId),
                        eq(anggotaKelas.tahun_ajaran_id, effectiveTaId)
                      )
                    )
                    .limit(1);

                  if (existingInTargetTa.length > 0) {
                    await db
                      .update(anggotaKelas)
                      .set({
                        kelas_id: targetClass.id,
                        deleted_at: null,
                        updated_at: now,
                        sync_status: "pending_push",
                        version: (existingInTargetTa[0].version || 1) + 1,
                      })
                      .where(eq(anggotaKelas.id, existingInTargetTa[0].id));
                  } else {
                    await db.insert(anggotaKelas).values({
                      id: generateUUID(),
                      created_at: now,
                      updated_at: now,
                      deleted_at: null,
                      sync_status: "pending_push",
                      last_synced_at: null,
                      version: 1,
                      siswa_id: sId,
                      kelas_id: targetClass.id,
                      tahun_ajaran_id: effectiveTaId,
                    });
                  }
                }

                showAlert({
                  title: "Naik Kelas Berhasil",
                  message: `${selectedMassStudentIds.length} siswa berhasil dinaikkan ke Kelas ${targetClass.nama} pada TA ${targetTa?.nama || ""} (${targetTa?.nama_semester || ""}). Riwayat tersimpan utuh di profil siswa.`,
                  type: "success",
                });
              } else if (massActionType === "pindah" && targetClass && classData) {
                for (const sId of selectedMassStudentIds) {
                  const existing = await db
                    .select()
                    .from(anggotaKelas)
                    .where(
                      and(
                        eq(anggotaKelas.siswa_id, sId),
                        eq(anggotaKelas.tahun_ajaran_id, classData.tahun_ajaran_id)
                      )
                    )
                    .limit(1);

                  if (existing.length > 0) {
                    await db
                      .update(anggotaKelas)
                      .set({
                        kelas_id: targetClass.id,
                        deleted_at: null,
                        updated_at: now,
                        sync_status: "pending_push",
                        version: (existing[0].version || 1) + 1,
                      })
                      .where(eq(anggotaKelas.id, existing[0].id));
                  } else {
                    await db.insert(anggotaKelas).values({
                      id: generateUUID(),
                      created_at: now,
                      updated_at: now,
                      deleted_at: null,
                      sync_status: "pending_push",
                      last_synced_at: null,
                      version: 1,
                      siswa_id: sId,
                      kelas_id: targetClass.id,
                      tahun_ajaran_id: classData.tahun_ajaran_id,
                    });
                  }
                }

                showAlert({
                  title: "Pindah Rombel Berhasil",
                  message: `${selectedMassStudentIds.length} siswa berhasil dipindahkan ke Kelas ${targetClass.nama}.`,
                  type: "success",
                });
              } else if (massActionType === "lulus") {
                for (const sId of selectedMassStudentIds) {
                  await db
                    .update(siswa)
                    .set({
                      status: "lulus",
                      tahun_lulus: tahunLulusMassal.trim() || new Date().getFullYear().toString(),
                      catatan_mutasi: `Lulus dari Kelas ${classData?.nama || "9"} pada Tahun Ajaran ${periodData?.nama || ""}`,
                      updated_at: now,
                      sync_status: "pending_push",
                    })
                    .where(eq(siswa.id, sId));
                }

                showAlert({
                  title: "Kelulusan Massal Berhasil",
                  message: `${selectedMassStudentIds.length} siswa telah resmi dinyatakan LULUS. Data dapat diakses di Direktori Alumni.`,
                  type: "success",
                });
              }

              await refreshPendingCountAsync();
              setModalMassalVisible(false);
              await loadAll();
            } catch (err: any) {
              showAlert({
                title: "Gagal Memproses",
                message: err?.message || "Terjadi kesalahan saat memproses data.",
                type: "error",
              });
            } finally {
              setProcessingMassal(false);
            }
          },
        },
      ],
    });
  };

  // --- TAB PENGAMPU: TUGASKAN GURU ---
  const openAddPengampuModal = async () => {
    try {
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
      teachers.sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));
      setAllTeachers(teachers);

      const subjects = await db
        .select()
        .from(mataPelajaran)
        .where(and(eq(mataPelajaran.is_active, 1), isNull(mataPelajaran.deleted_at)));
      subjects.sort((a, b) => a.nama_mapel.localeCompare(b.nama_mapel));
      setAllSubjects(subjects);

      const gmRecords = await db
        .select()
        .from(guruMapel)
        .where(isNull(guruMapel.deleted_at));

      const gmMap: Record<string, string[]> = {};
      gmRecords.forEach((gm) => {
        if (!gmMap[gm.pegawai_id]) gmMap[gm.pegawai_id] = [];
        gmMap[gm.pegawai_id]!.push(gm.mata_pelajaran_id);
      });
      setGuruMapelMap(gmMap);

      const firstGuruId = teachers[0]?.id || null;
      setSelectedGuruId(firstGuruId);

      const guruAllowed =
        firstGuruId && gmMap[firstGuruId] && gmMap[firstGuruId]!.length > 0
          ? subjects.filter((s) => gmMap[firstGuruId]!.includes(s.id))
          : [];
      setSelectedMapelId(guruAllowed[0]?.id || null);

      setModalPengampuVisible(true);
    } catch (e) {
      console.warn("Gagal memuat opsi penugasan:", e);
    }
  };

  const dynamicSubjectsForGuru = useMemo(() => {
    if (!selectedGuruId) return [];
    const allowed = guruMapelMap[selectedGuruId];
    if (allowed && allowed.length > 0) {
      return allSubjects.filter((m) => allowed.includes(m.id));
    }
    // Jika guru tidak memiliki mapel keahlian di guruMapel (0 mapel), tidak bisa memilih mapel
    return [];
  }, [selectedGuruId, allSubjects, guruMapelMap]);

  const handleSelectGuruInModal = (guruId: string) => {
    setSelectedGuruId(guruId);
    const allowed = guruMapelMap[guruId];
    const candidateSubjects =
      allowed && allowed.length > 0
        ? allSubjects.filter((m) => allowed.includes(m.id))
        : [];

    if (!candidateSubjects.some((m) => m.id === selectedMapelId)) {
      setSelectedMapelId(candidateSubjects[0]?.id || null);
    }
  };

  const handleSavePengampu = async () => {
    if (!selectedGuruId || !selectedMapelId || !classData) {
      const allowed = selectedGuruId ? guruMapelMap[selectedGuruId] : [];
      if (!allowed || allowed.length === 0) {
        showAlert({
          title: "Keahlian Guru Belum Diatur",
          message:
            "Guru ini belum memiliki mata pelajaran keahlian yang ditugaskan (0 mapel). Silakan atur mapel keahlian guru pada menu Data Pegawai terlebih dahulu sebelum menugaskannya ke rombel ini.",
          type: "warning",
        });
        return;
      }
      showAlert({
        title: "Pilihan Belum Lengkap",
        message: "Pilih guru dan mata pelajaran.",
        type: "warning",
      });
      return;
    }

    setSavingPengampu(true);
    const now = getIsoUtcString();

    try {
      const existing = await db
        .select()
        .from(pengampuKelas)
        .where(
          and(
            eq(pengampuKelas.kelas_id, classData.id),
            eq(pengampuKelas.pegawai_id, selectedGuruId),
            eq(pengampuKelas.mata_pelajaran_id, selectedMapelId),
            isNull(pengampuKelas.deleted_at)
          )
        );

      if (existing.length > 0) {
        showAlert({
          title: "Penugasan Sudah Ada",
          message: "Guru bersangkutan sudah ditugaskan mengampu mata pelajaran ini di rombel tersebut.",
          type: "warning",
        });
        setSavingPengampu(false);
        return;
      }

      await db.insert(pengampuKelas).values({
        id: generateUUID(),
        created_at: now,
        updated_at: now,
        deleted_at: null,
        sync_status: "pending_push",
        last_synced_at: null,
        version: 1,
        kelas_id: classData.id,
        pegawai_id: selectedGuruId,
        mata_pelajaran_id: selectedMapelId,
      });

      await refreshPendingCountAsync();
      setModalPengampuVisible(false);
      await loadAll();
      showAlert({
        title: "Penugasan Berhasil",
        message: "Guru pengampu berhasil ditugaskan ke kelas ini.",
        type: "success",
      });
    } catch (e: any) {
      showAlert({
        title: "Gagal Menugaskan",
        message: e?.message || "Terjadi kesalahan database.",
        type: "error",
      });
    } finally {
      setSavingPengampu(false);
    }
  };

  const handleRemovePengampu = (item: PengampuItem) => {
    showAlert({
      title: "Hapus Penugasan",
      message: `Hapus penugasan ${item.guruNama} untuk mapel ${item.mapelNama} di kelas ini?`,
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
                .update(pengampuKelas)
                .set({
                  deleted_at: now,
                  updated_at: now,
                  sync_status: "pending_push",
                })
                .where(eq(pengampuKelas.id, item.id));

              await refreshPendingCountAsync();
              await loadAll();
              showAlert({
                title: "Dihapus",
                message: "Penugasan mapel berhasil dicabut.",
                type: "info",
              });
            } catch (e: any) {
              showAlert({
                title: "Gagal Menghapus Penugasan",
                message: e?.message || "Terjadi kesalahan database.",
                type: "error",
              });
            }
          },
        },
      ],
    });
  };

  // Hapus Rombel Kelas (Khusus Super Admin)
  const handleDeleteClass = async () => {
    if (!classData || !id) return;
    setIsDeletingKelas(true);
    try {
      const now = getIsoUtcString();
      // 1. Soft-delete kelas
      await db
        .update(kelas)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
          version: (classData.version || 1) + 1,
        })
        .where(eq(kelas.id, id));

      // 2. Cascade soft-delete anggotaKelas
      await db
        .update(anggotaKelas)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
        })
        .where(eq(anggotaKelas.kelas_id, id));

      // 3. Cascade soft-delete pengampuKelas
      await db
        .update(pengampuKelas)
        .set({
          deleted_at: now,
          updated_at: now,
          sync_status: "pending_push",
        })
        .where(eq(pengampuKelas.kelas_id, id));

      await refreshPendingCountAsync();
      setConfirmDeleteKelasVisible(false);
      showToast(`Kelas ${classData.nama} berhasil dihapus`);
      router.back();
    } catch (e: any) {
      showAlert({
        title: "Gagal Menghapus Kelas",
        message: e?.message || "Terjadi kesalahan database.",
        type: "error",
      });
    } finally {
      setIsDeletingKelas(false);
    }
  };

  // Filtered views
  const filteredStudents = useMemo(() => {
    const q = searchSiswa.toLowerCase().trim();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.namaLengkap.toLowerCase().includes(q) ||
        (s.nis && s.nis.toLowerCase().includes(q)) ||
        (s.nisn && s.nisn.toLowerCase().includes(q))
    );
  }, [students, searchSiswa]);

  const filteredPengampu = useMemo(() => {
    const q = searchPengampu.toLowerCase().trim();
    if (!q) return pengampuList;
    return pengampuList.filter(
      (p) =>
        p.guruNama.toLowerCase().includes(q) ||
        p.mapelNama.toLowerCase().includes(q) ||
        p.mapelKode.toLowerCase().includes(q)
    );
  }, [pengampuList, searchPengampu]);

  const filteredCandidates = useMemo(() => {
    const q = searchCandidate.toLowerCase().trim();
    if (!q) return availableStudents;
    return availableStudents.filter(
      (s) =>
        s.nama_lengkap.toLowerCase().includes(q) ||
        (s.nis && s.nis.toLowerCase().includes(q)) ||
        (s.nisn && s.nisn.toLowerCase().includes(q))
    );
  }, [availableStudents, searchCandidate]);

  const getGroupedShape = (index: number, total: number) => {
    if (total <= 1) {
      return {
        borderRadius: radius.lg,
        borderCurve: "continuous" as const,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.neutral.border,
        marginBottom: spacing.sm,
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
        marginBottom: spacing.sm,
      };
    }
    return {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: colors.neutral.border,
    };
  };

  const renderItemSeparator = () => <View style={styles.itemSeparator} />;

  const renderStudentItem = useCallback(
    ({ item: s, index }: { item: AnggotaSiswaItem; index: number }) => {
      const shape = getGroupedShape(index, filteredStudents.length);

      return (
        <View style={[styles.studentCard, shape]}>
          <Pressable
            style={({ pressed }) => [
              styles.studentRow,
              pressed && styles.rowPressed,
            ]}
            onPress={() =>
              router.push({
                pathname: "/siswa/[id]",
                params: { id: s.siswaId },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`Detail siswa ${s.namaLengkap}`}
          >
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{index + 1}</Text>
            </View>

            <View style={styles.studentInfoCol}>
              <Text style={styles.studentName}>{s.namaLengkap}</Text>
              <View style={styles.studentMetaRow}>
                <Text style={styles.studentNisText}>
                  NIS: {s.nis || "-"} • NISN: {s.nisn || "-"}
                </Text>
                <Badge
                  label={s.jenisKelamin === "L" ? "L" : "P"}
                  variant={s.jenisKelamin === "L" ? "primary" : "gold"}
                  size="sm"
                />
              </View>
            </View>

            {isOperator && (
              <Pressable
                style={({ pressed }) => [
                  styles.removeBtn,
                  pressed && styles.removeBtnPressed,
                ]}
                onPress={() => handleRemoveSiswa(s)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Keluarkan ${s.namaLengkap} dari kelas`}
              >
                <Ionicons
                  name="person-remove-outline"
                  size={18}
                  color={colors.status.cancelled}
                />
              </Pressable>
            )}
          </Pressable>
        </View>
      );
    },
    [filteredStudents.length, isOperator]
  );

  const renderPengampuItem = useCallback(
    ({ item: p, index }: { item: PengampuItem; index: number }) => {
      const shape = getGroupedShape(index, filteredPengampu.length);

      return (
        <View style={[styles.pengampuCard, shape]}>
          <View style={styles.pengampuRow}>
            <View style={styles.mapelBadge}>
              <Text style={styles.mapelBadgeText}>{p.mapelKode}</Text>
            </View>

            <View style={styles.pengampuInfoCol}>
              <View style={styles.mapelTitleRow}>
                <Text style={styles.mapelName}>{p.mapelNama}</Text>
                <Badge label={p.mapelKelompok} variant="neutral" size="sm" />
              </View>
              <View style={styles.guruLine}>
                <Ionicons name="person-outline" size={13} color={colors.neutral.textMuted} />
                <Text style={styles.guruNameText}>{p.guruNama}</Text>
                {p.guruNip && (
                  <Text style={styles.guruNipText}>(NIP: {p.guruNip})</Text>
                )}
              </View>
            </View>

            {isOperator && (
              <Pressable
                style={({ pressed }) => [
                  styles.removeBtn,
                  pressed && styles.removeBtnPressed,
                ]}
                onPress={() => handleRemovePengampu(p)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Hapus penugasan ${p.guruNama}`}
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
      );
    },
    [filteredPengampu.length, isOperator]
  );

  const renderHeader = useMemo(() => {
    if (!classData) return null;

    return (
      <View style={styles.headerContainer}>
        {/* Top Header Card */}
        <ModernCard style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.periodHeaderLabel}>DETAIL ROMBEL KELAS</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Badge
                label={periodData?.is_active === 1 ? "PERIODE AKTIF" : "ARSIP"}
                variant={periodData?.is_active === 1 ? "active" : "neutral"}
                size="sm"
              />
            </View>
          </View>

          <View style={styles.classIdentityRow}>
            <View style={styles.tingkatBox}>
              <Text style={styles.tingkatBoxText}>{classData.tingkat}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mainClassName}>Kelas {classData.nama}</Text>
              <Text style={styles.periodSubtitle}>
                Tahun Ajaran {periodData?.nama} • Semester {periodData?.nama_semester}
              </Text>
            </View>
          </View>

          {/* Wali Kelas & Metrics Info */}
          <View style={styles.metaBox}>
            <View style={styles.waliRow}>
              <Ionicons name="person-circle" size={22} color={colors.primary[700]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.waliLabel}>Wali Kelas:</Text>
                <Text style={styles.waliValue}>{waliNama}</Text>
                {waliNip && <Text style={styles.waliNipText}>NIP: {waliNip}</Text>}
              </View>
            </View>

            <View style={styles.metricPillsRow}>
              <View style={styles.metricPill}>
                <Ionicons name="people" size={14} color={colors.primary[700]} />
                <Text style={styles.metricPillText}>{students.length} Siswa</Text>
              </View>
              <View style={styles.metricPill}>
                <Ionicons name="book" size={14} color={colors.primary[700]} />
                <Text style={styles.metricPillText}>{pengampuList.length} Pengampu</Text>
              </View>

              {/* Tombol Cetak Form Presensi PDF */}
              <Pressable
                style={({ pressed }) => [
                  styles.printPillBtn,
                  pressed && styles.pressedState,
                  printingPresensi && { opacity: 0.6 },
                ]}
                onPress={handlePrintPresensi}
                disabled={printingPresensi}
                accessibilityRole="button"
                accessibilityLabel="Cetak form presensi PDF"
              >
                <Ionicons name="print-outline" size={14} color={colors.primary[700]} />
                <Text style={styles.printPillText}>
                  {printingPresensi ? "Mencetak..." : "Cetak Presensi (PDF)"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ModernCard>

        {/* Segmented Tab Navigation */}
        <SegmentedTabs
          tabs={[
            { key: "siswa", label: "Anggota Siswa", badge: students.length },
            { key: "pengampu", label: "Guru & Mapel", badge: pengampuList.length },
          ]}
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as "siswa" | "pengampu")}
          style={{ marginBottom: spacing.sm + 2 }}
        />

        {/* Action & Search Row for active tab */}
        <View style={styles.actionRow}>
          <View style={{ flex: 1 }}>
            <SearchBar
              value={activeTab === "siswa" ? searchSiswa : searchPengampu}
              onChangeText={activeTab === "siswa" ? setSearchSiswa : setSearchPengampu}
              placeholder={activeTab === "siswa" ? "Cari nama, NIS, atau NISN siswa..." : "Cari mapel atau nama guru..."}
            />
          </View>

          {isOperator && (
            <View style={{ flexDirection: "row", gap: spacing.xs + 2, alignItems: "center" }}>
              {activeTab === "siswa" ? (
                <>
                  <ModernButton
                    title="+ Siswa"
                    size="sm"
                    onPress={openAddSiswaModal}
                    icon={<Ionicons name="person-add" size={15} color={colors.neutral.white} />}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.massActionButton,
                      pressed && styles.pressedState,
                    ]}
                    onPress={openMassActionModal}
                    accessibilityRole="button"
                    accessibilityLabel="Buka menu aksi rombel massal"
                  >
                    <Ionicons name="layers-outline" size={16} color={colors.primary[700]} />
                    <Text style={styles.massActionButtonText}>Aksi Massal</Text>
                  </Pressable>
                </>
              ) : (
                <ModernButton
                  title="+ Tugaskan"
                  size="sm"
                  onPress={openAddPengampuModal}
                  icon={<Ionicons name="add-circle" size={16} color={colors.neutral.white} />}
                />
              )}
            </View>
          )}
        </View>
      </View>
    );
  }, [
    classData,
    periodData,
    waliNama,
    waliNip,
    students.length,
    pengampuList.length,
    printingPresensi,
    activeTab,
    searchSiswa,
    searchPengampu,
    isOperator,
  ]);

  const renderEmptyStudents = useMemo(() => {
    return (
      <EmptyState
        icon="people-outline"
        title="Belum Ada Siswa di Kelas Ini"
        message={
          searchSiswa
            ? `Tidak ada siswa yang cocok dengan kata kunci "${searchSiswa}".`
            : "Tekan tombol '+ Siswa' untuk memasukkan siswa ke rombel ini."
        }
        actionLabel={isOperator && !searchSiswa ? "+ Tambah Siswa" : undefined}
        onAction={isOperator && !searchSiswa ? openAddSiswaModal : undefined}
      />
    );
  }, [searchSiswa, isOperator]);

  const renderEmptyPengampu = useMemo(() => {
    return (
      <EmptyState
        icon="book-outline"
        title="Belum Ada Guru Pengampu"
        message={
          searchPengampu
            ? `Tidak ada penugasan yang cocok dengan kata kunci "${searchPengampu}".`
            : "Tekan tombol '+ Tugaskan' untuk menetapkan guru mata pelajaran di rombel ini."
        }
        actionLabel={isOperator && !searchPengampu ? "+ Tugaskan Guru" : undefined}
        onAction={isOperator && !searchPengampu ? openAddPengampuModal : undefined}
      />
    );
  }, [searchPengampu, isOperator]);

  if (!classData) {
    return (
      <AppShell title="Detail Rombel" showBack onBack={() => router.back()}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Memuat data rombel...</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Kelas ${classData.nama}`}
      subtitle={`Tingkat ${classData.tingkat}`}
      showBack
      onBack={() => router.back()}
      rightAction={
        isSuperAdmin ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hapus Rombel Kelas"
            onPress={() => setConfirmDeleteKelasVisible(true)}
            style={({ pressed }) => [
              { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={20} color={colors.status.conflict} />
          </Pressable>
        ) : undefined
      }
    >
      {activeTab === "siswa" ? (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentItem}
          ItemSeparatorComponent={renderItemSeparator}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyStudents}
          style={styles.flatList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary[600]}
            />
          }
        />
      ) : (
        <FlatList
          data={filteredPengampu}
          keyExtractor={(item) => item.id}
          renderItem={renderPengampuItem}
          ItemSeparatorComponent={renderItemSeparator}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyPengampu}
          style={styles.flatList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary[600]}
            />
          }
        />
      )}

      {/* Modal Tambah Siswa ke Kelas */}
      <Modal visible={modalSiswaVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Tambah Siswa ke Rombel</Text>
                <Text style={styles.modalSubtitle}>
                  Menampilkan siswa aktif yang belum memiliki kelas di semester ini
                </Text>
              </View>
              <Pressable
                onPress={() => setModalSiswaVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog tambah siswa"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.candidateSearchBox}>
              <Ionicons name="search" size={16} color={colors.neutral.textMuted} />
              <TextInput
                placeholder="Cari siswa yang belum masuk rombel..."
                value={searchCandidate}
                onChangeText={setSearchCandidate}
                style={styles.searchInput}
                placeholderTextColor={colors.neutral.textMuted}
              />
            </View>

            <ScrollView
              style={styles.candidateList}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >
              {filteredCandidates.length === 0 ? (
                <View style={styles.emptyCandidatesBox}>
                  <Text style={styles.emptyCandidatesText}>
                    {searchCandidate
                      ? "Tidak ada siswa yang cocok."
                      : "Semua siswa aktif sudah terdaftar di rombel semester ini."}
                  </Text>
                </View>
              ) : (
                filteredCandidates.map((c) => {
                  const isSelected = selectedStudentIds.includes(c.id);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => toggleSelectStudent(c.id)}
                      style={({ pressed }) => [
                        styles.candidateItem,
                        isSelected && styles.candidateItemSelected,
                        pressed && styles.pressedState,
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                    >
                      <Ionicons
                        name={isSelected ? "checkbox" : "square-outline"}
                        size={20}
                        color={isSelected ? colors.primary[700] : colors.neutral.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.candidateName,
                            isSelected && styles.candidateNameSelected,
                          ]}
                        >
                          {c.nama_lengkap}
                        </Text>
                        <Text style={styles.candidateSub}>
                          NIS: {c.nis || "-"} • {c.jenis_kelamin === "L" ? "L" : "P"}
                        </Text>
                      </View>
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
                onPress={() => setModalSiswaVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title={
                  savingSiswa
                    ? "Menyimpan..."
                    : `Tambahkan (${selectedStudentIds.length})`
                }
                variant="primary"
                size="md"
                onPress={handleSaveSiswa}
                loading={savingSiswa}
                disabled={selectedStudentIds.length === 0}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Aksi Rombel Massal (Naik Kelas / Pindah Rombel / Kelulusan) */}
      <Modal visible={modalMassalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "88%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Aksi Rombel Massal</Text>
                <Text style={styles.modalSubtitle}>
                  Proses kenaikan kelas, mutasi antar-rombel, atau kelulusan angkatan
                </Text>
              </View>
              <Pressable
                onPress={() => setModalMassalVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog aksi massal"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Pilihan Jenis Aksi */}
              <View style={styles.massActionTypeRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.massTypeBtn,
                    massActionType === "naik" && styles.massTypeBtnActive,
                    pressed && styles.pressedState,
                  ]}
                  onPress={() => {
                    setMassActionType("naik");
                    setTargetClassId(null);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: massActionType === "naik" }}
                >
                  <Ionicons
                    name="trending-up"
                    size={16}
                    color={massActionType === "naik" ? colors.primary[700] : colors.neutral.textMuted}
                  />
                  <Text
                    style={[
                      styles.massTypeBtnText,
                      massActionType === "naik" && styles.massTypeBtnTextActive,
                    ]}
                  >
                    Naik Kelas
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.massTypeBtn,
                    massActionType === "pindah" && styles.massTypeBtnActive,
                    pressed && styles.pressedState,
                  ]}
                  onPress={() => {
                    setMassActionType("pindah");
                    setTargetClassId(null);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: massActionType === "pindah" }}
                >
                  <Ionicons
                    name="swap-horizontal"
                    size={16}
                    color={massActionType === "pindah" ? colors.primary[700] : colors.neutral.textMuted}
                  />
                  <Text
                    style={[
                      styles.massTypeBtnText,
                      massActionType === "pindah" && styles.massTypeBtnTextActive,
                    ]}
                  >
                    Pindah Rombel
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.massTypeBtn,
                    massActionType === "lulus" && styles.massTypeBtnActive,
                    pressed && styles.pressedState,
                  ]}
                  onPress={() => {
                    setMassActionType("lulus");
                    setTargetClassId(null);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: massActionType === "lulus" }}
                >
                  <Ionicons
                    name="school"
                    size={16}
                    color={massActionType === "lulus" ? colors.primary[700] : colors.neutral.textMuted}
                  />
                  <Text
                    style={[
                      styles.massTypeBtnText,
                      massActionType === "lulus" && styles.massTypeBtnTextActive,
                    ]}
                  >
                    Kelulusan
                  </Text>
                </Pressable>
              </View>

              {/* Keterangan Aksi */}
              <View style={styles.actionNoteBox}>
                <Ionicons name="information-circle-outline" size={16} color={colors.neutral.textSecondary} />
                <Text style={styles.actionNoteText}>
                  {massActionType === "naik" &&
                    "Naik kelas massal akan menambahkan siswa ke rombel tingkat selanjutnya tanpa menghapus riwayat akademik lama."}
                  {massActionType === "pindah" &&
                    "Pindah rombel akan memindahkan siswa dari kelas saat ini ke rombel paralel lain di semester yang sama."}
                  {massActionType === "lulus" &&
                    "Kelulusan massal akan mengubah status siswa menjadi 'LULUS' dan memindahkannya ke Direktori Alumni."}
                </Text>
              </View>

              {/* Target Tahun Ajaran Selection (Khusus Naik Kelas) */}
              {massActionType === "naik" && (
                <View style={styles.fieldGroup}>
                  <View style={styles.selectionHeaderRow}>
                    <Text style={styles.fieldLabel}>Tahun Ajaran Tujuan Kenaikan:</Text>
                    <Pressable
                      onPress={() => {
                        // Prefill tahun berikutnya
                        if (periodData?.nama) {
                          const parts = periodData.nama.split("/");
                          if (parts.length === 2) {
                            const y1 = parseInt(parts[0], 10);
                            const y2 = parseInt(parts[1], 10);
                            if (!isNaN(y1) && !isNaN(y2)) {
                              setQuickTaName(`${y1 + 1}/${y2 + 1}`);
                            }
                          }
                        }
                        setQuickCreateTaVisible(true);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                    >
                      <Text style={styles.toggleAllText}>+ Buat TA Baru</Text>
                    </Pressable>
                  </View>

                  {/* Form Inline Buat TA Baru jika belum ada */}
                  {quickCreateTaVisible && (
                    <View style={styles.quickCreateBox}>
                      <View style={styles.quickCreateHeader}>
                        <Text style={styles.quickCreateTitle}>Tambah Tahun Ajaran Baru</Text>
                        <Pressable
                          onPress={() => setQuickCreateTaVisible(false)}
                          hitSlop={8}
                        >
                          <Ionicons name="close" size={18} color={colors.neutral.textSecondary} />
                        </Pressable>
                      </View>
                      <Text style={styles.quickCreateSub}>
                        Akan membuat otomatis Semester 1 (Ganjil) & Semester 2 (Genap)
                      </Text>
                      <TextInput
                        style={[styles.textInput, { marginVertical: 8 }]}
                        value={quickTaName}
                        onChangeText={setQuickTaName}
                        placeholder="Contoh: 2027/2028"
                        placeholderTextColor={colors.neutral.textMuted}
                      />
                      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                        <ModernButton
                          title="Batal"
                          variant="outline"
                          size="sm"
                          onPress={() => setQuickCreateTaVisible(false)}
                        />
                        <ModernButton
                          title={creatingQuickTa ? "Menyimpan..." : "Simpan & Pilih"}
                          variant="primary"
                          size="sm"
                          loading={creatingQuickTa}
                          onPress={handleQuickCreateTa}
                        />
                      </View>
                    </View>
                  )}

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                  >
                    {allTahunAjaranList.map((ta) => {
                      const isSelected = targetTahunAjaranId === ta.id;
                      const isCurrentTa = ta.id === classData?.tahun_ajaran_id;
                      return (
                        <Pressable
                          key={ta.id}
                          style={({ pressed }) => [
                            styles.taOptionChip,
                            isSelected && styles.taOptionChipSelected,
                            pressed && styles.pressedState,
                          ]}
                          onPress={() => {
                            setTargetTahunAjaranId(ta.id);
                            setTargetClassId(null);
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <Ionicons
                              name={isSelected ? "radio-button-on" : "radio-button-off"}
                              size={15}
                              color={isSelected ? colors.primary[700] : colors.neutral.textMuted}
                            />
                            <Text
                              style={[
                                styles.taOptionChipText,
                                isSelected && styles.taOptionChipTextSelected,
                              ]}
                            >
                              {ta.nama} ({ta.nama_semester})
                            </Text>
                          </View>
                          <View style={{ flexDirection: "row", gap: 4, marginTop: 3 }}>
                            {ta.is_active === 1 && (
                              <Badge label="Aktif" variant="active" size="sm" />
                            )}
                            {isCurrentTa && (
                              <Badge label="Saat Ini" variant="neutral" size="sm" />
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Target Class Selection (Untuk Naik & Pindah) */}
              {massActionType !== "lulus" ? (
                <View style={styles.fieldGroup}>
                  <View style={styles.selectionHeaderRow}>
                    <Text style={styles.fieldLabel}>
                      Pilih Kelas Tujuan{" "}
                      {massActionType === "naik"
                        ? `(Tingkat ${classData.tingkat + 1})`
                        : "(Paralel)"}
                      :
                    </Text>
                    {massActionType === "naik" && !quickCreateClassVisible && (
                      <Pressable
                        onPress={() => {
                          const nextT = classData.tingkat + 1;
                          const suffix = classData.nama.replace(/^[0-9]+/, "") || "A";
                          setQuickClassName(`${nextT}${suffix}`);
                          setQuickCreateClassVisible(true);
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                      >
                        <Text style={styles.toggleAllText}>+ Buat Kelas Baru</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Inline Form Quick Create Kelas */}
                  {quickCreateClassVisible && massActionType === "naik" && (
                    <View style={styles.quickCreateBox}>
                      <View style={styles.quickCreateHeader}>
                        <Text style={styles.quickCreateTitle}>
                          Buat Kelas Tingkat {classData.tingkat + 1} di TA Terpilih
                        </Text>
                        <Pressable
                          onPress={() => setQuickCreateClassVisible(false)}
                          hitSlop={8}
                        >
                          <Ionicons name="close" size={18} color={colors.neutral.textSecondary} />
                        </Pressable>
                      </View>
                      <TextInput
                        style={[styles.textInput, { marginVertical: 8 }]}
                        value={quickClassName}
                        onChangeText={setQuickClassName}
                        placeholder={`Contoh: ${classData.tingkat + 1}A`}
                        placeholderTextColor={colors.neutral.textMuted}
                        autoCapitalize="characters"
                      />
                      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                        <ModernButton
                          title="Batal"
                          variant="outline"
                          size="sm"
                          onPress={() => setQuickCreateClassVisible(false)}
                        />
                        <ModernButton
                          title={creatingQuickClass ? "Membuat..." : "+ Buat & Pilih"}
                          variant="primary"
                          size="sm"
                          loading={creatingQuickClass}
                          onPress={handleQuickCreateClass}
                        />
                      </View>
                    </View>
                  )}

                  {availableTargetClasses.length === 0 ? (
                    <View style={styles.emptyTargetBox}>
                      <Ionicons
                        name="folder-open-outline"
                        size={28}
                        color={colors.neutral.textMuted}
                      />
                      <Text style={[styles.emptyTargetText, { marginTop: 4 }]}>
                        {massActionType === "naik"
                          ? `Belum ada rombel untuk Tingkat ${classData.tingkat + 1} di Tahun Ajaran terpilih.`
                          : "Tidak ada rombel paralel lain di semester ini."}
                      </Text>
                      {massActionType === "naik" && !quickCreateClassVisible && (
                        <ModernButton
                          title={`+ Buat Kelas ${classData.tingkat + 1}${classData.nama.replace(/^[0-9]+/, "") || "A"} Sekarang`}
                          variant="outline"
                          size="sm"
                          style={{ marginTop: 8 }}
                          onPress={() => {
                            const nextT = classData.tingkat + 1;
                            const suffix = classData.nama.replace(/^[0-9]+/, "") || "A";
                            setQuickClassName(`${nextT}${suffix}`);
                            setQuickCreateClassVisible(true);
                          }}
                        />
                      )}
                    </View>
                  ) : (
                    <ScrollView style={styles.targetClassScroll} nestedScrollEnabled>
                      {availableTargetClasses.map((tc) => {
                        const isSelected = targetClassId === tc.id;
                        return (
                          <Pressable
                            key={tc.id}
                            style={({ pressed }) => [
                              styles.targetClassItem,
                              isSelected && styles.targetClassItemSelected,
                              pressed && styles.pressedState,
                            ]}
                            onPress={() => setTargetClassId(tc.id)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isSelected }}
                          >
                            <Ionicons
                              name={isSelected ? "radio-button-on" : "radio-button-off"}
                              size={18}
                              color={isSelected ? colors.primary[700] : colors.neutral.textMuted}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.targetClassName,
                                  isSelected && styles.targetClassNameSelected,
                                ]}
                              >
                                Kelas {tc.nama} (Tingkat {tc.tingkat})
                              </Text>
                              <Text style={styles.targetClassSub}>
                                TA: {tc.tahunAjaranNama} {tc.tahunAjaranSemester ? `(${tc.tahunAjaranSemester})` : ""}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              ) : (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tahun Kelulusan Siswa:</Text>
                  <TextInput
                    style={styles.textInput}
                    value={tahunLulusMassal}
                    onChangeText={setTahunLulusMassal}
                    placeholder="Contoh: 2026/2027"
                    keyboardType="numeric"
                    placeholderTextColor={colors.neutral.textMuted}
                  />
                </View>
              )}

              {/* Pilih Siswa yang akan diproses */}
              <View style={styles.fieldGroup}>
                <View style={styles.selectionHeaderRow}>
                  <Text style={styles.fieldLabel}>
                    Pilih Siswa ({selectedMassStudentIds.length}/{students.length}):
                  </Text>
                  <Pressable
                    onPress={toggleSelectAllMass}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Pilih atau batalkan semua siswa"
                  >
                    <Text style={styles.toggleAllText}>
                      {selectedMassStudentIds.length === students.length
                        ? "Batal Pilih Semua"
                        : "Pilih Semua"}
                    </Text>
                  </Pressable>
                </View>

                <ScrollView style={styles.studentPickScroll} nestedScrollEnabled>
                  {students.map((st) => {
                    const isSelected = selectedMassStudentIds.includes(st.siswaId);
                    return (
                      <Pressable
                        key={st.siswaId}
                        style={({ pressed }) => [
                          styles.studentPickItem,
                          isSelected && styles.studentPickItemSelected,
                          pressed && styles.pressedState,
                        ]}
                        onPress={() => toggleMassStudentSelection(st.siswaId)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                      >
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={18}
                          color={isSelected ? colors.primary[700] : colors.neutral.textMuted}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.studentPickName,
                              isSelected && styles.studentPickNameSelected,
                            ]}
                          >
                            {st.namaLengkap}
                          </Text>
                          <Text style={styles.studentPickSub}>
                            NIS: {st.nis || "-"} • {st.jenisKelamin}
                          </Text>
                        </View>
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
                onPress={() => setModalMassalVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title={
                  processingMassal
                    ? "Memproses..."
                    : `Jalankan Aksi (${selectedMassStudentIds.length})`
                }
                variant="primary"
                size="md"
                onPress={handleExecuteMassAction}
                loading={processingMassal}
                disabled={
                  selectedMassStudentIds.length === 0 ||
                  (massActionType !== "lulus" && !targetClassId)
                }
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Tugaskan Guru Mapel */}
      <Modal visible={modalPengampuVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Tugaskan Guru Mata Pelajaran</Text>
                <Text style={styles.modalSubtitle}>
                  Tentukan guru pengampu untuk Kelas {classData.nama}
                </Text>
              </View>
              <Pressable
                onPress={() => setModalPengampuVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog penugasan guru"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Pilih Guru */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Pilih Guru Pengajar</Text>
                <ScrollView
                  style={styles.selectScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={true}
                >
                  {allTeachers.map((t) => {
                    const isSelected = selectedGuruId === t.id;
                    const mapelCount = (guruMapelMap[t.id] || []).length;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => handleSelectGuruInModal(t.id)}
                        style={({ pressed }) => [
                          styles.selectOption,
                          isSelected && styles.selectOptionSelected,
                          pressed && styles.pressedState,
                        ]}
                        accessibilityRole="radio"
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
                              styles.selectOptionTitle,
                              isSelected && styles.selectOptionTitleSelected,
                            ]}
                          >
                            {t.nama_lengkap}
                          </Text>
                          <Text
                            style={[
                              styles.selectOptionSub,
                              mapelCount === 0 && { color: colors.status.conflict, fontWeight: "600" },
                            ]}
                          >
                            {t.nip ? `NIP: ${t.nip} • ` : ""}
                            {mapelCount === 0 ? "0 Mapel Keahlian (Belum Diatur)" : `${mapelCount} Mapel Keahlian`}
                          </Text>
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

              {/* Pilih Mata Pelajaran (Difilter Dinamis Berdasarkan Guru Terpilih) */}
              <View style={styles.fieldGroup}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={styles.fieldLabel}>Pilih Mata Pelajaran</Text>
                  {selectedGuruId && (guruMapelMap[selectedGuruId] || []).length > 0 ? (
                    <Text style={styles.dynamicFilterHint}>
                      ✨ {(guruMapelMap[selectedGuruId] || []).length} Mapel Sesuai Keahlian
                    </Text>
                  ) : (
                    <Text style={[styles.dynamicFilterHint, { color: colors.status.conflict }]}>
                      ⚠️ 0 Keahlian (Terkunci)
                    </Text>
                  )}
                </View>

                <ScrollView
                  style={[
                    styles.selectScroll,
                    dynamicSubjectsForGuru.length === 0 && styles.selectScrollEmpty,
                  ]}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={true}
                >
                  {dynamicSubjectsForGuru.length === 0 ? (
                    <View style={styles.emptyMapelBox}>
                      <Ionicons name="alert-circle-outline" size={26} color={colors.status.conflict} />
                      <Text style={styles.emptyMapelTitle}>
                        Tidak Dapat Memilih Mata Pelajaran
                      </Text>
                      <Text style={styles.emptyMapelSub}>
                        Guru ini memiliki 0 mata pelajaran keahlian yang ditugaskan. Atur mapel keahlian guru pada menu Data Pegawai terlebih dahulu untuk dapat menugaskannya di rombel ini.
                      </Text>
                    </View>
                  ) : (
                    dynamicSubjectsForGuru.map((m) => {
                      const isSelected = selectedMapelId === m.id;
                      return (
                        <Pressable
                          key={m.id}
                          onPress={() => setSelectedMapelId(m.id)}
                          style={({ pressed }) => [
                            styles.selectOption,
                            isSelected && styles.selectOptionSelected,
                            pressed && styles.pressedState,
                          ]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isSelected }}
                        >
                          <View style={styles.miniMapelBadge}>
                            <Text style={styles.miniMapelText}>{m.kode_mapel}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.selectOptionTitle,
                                isSelected && styles.selectOptionTitleSelected,
                              ]}
                            >
                              {m.nama_mapel}
                            </Text>
                            <Text style={styles.selectOptionSub}>Kelompok: {m.kelompok}</Text>
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
                    })
                  )}
                </ScrollView>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                onPress={() => setModalPengampuVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title={savingPengampu ? "Menyimpan..." : "Simpan Penugasan"}
                variant="primary"
                size="md"
                onPress={handleSavePengampu}
                loading={savingPengampu}
                disabled={!selectedGuruId || !selectedMapelId || dynamicSubjectsForGuru.length === 0}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ConfirmDialog Hapus Rombel Kelas (Super Admin) */}
      <ConfirmDialog
        visible={confirmDeleteKelasVisible}
        title="Hapus Rombel Kelas?"
        message={`Apakah Anda yakin ingin menghapus Kelas ${classData?.nama}?\n\nSebagai Super Admin, seluruh data keanggotaan siswa dan penugasan guru pengampu di kelas ini akan ditandai terhapus.`}
        variant="danger"
        confirmLabel="Ya, Hapus Kelas"
        cancelLabel="Batal"
        loading={isDeletingKelas}
        onConfirm={handleDeleteClass}
        onCancel={() => setConfirmDeleteKelasVisible(false)}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
    color: colors.neutral.textMuted,
  },
  flatList: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  headerContainer: {
    marginBottom: spacing.xs,
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
  periodHeaderLabel: {
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
  classIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  tingkatBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.primary[100],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[300],
    alignItems: "center",
    justifyContent: "center",
  },
  tingkatBoxText: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.primary[800],
  },
  mainClassName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
  },
  periodSubtitle: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  metaBox: {
    backgroundColor: colors.neutral.canvas,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    padding: spacing.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    gap: spacing.sm,
  },
  waliRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  waliLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.neutral.textMuted,
    textTransform: "uppercase",
  },
  waliValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  waliNipText: {
    fontSize: 11,
    color: colors.neutral.textMuted,
  },
  metricPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.borderSubtle,
    paddingTop: spacing.sm,
    flexWrap: "wrap",
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.neutral.surface,
    paddingHorizontal: spacing.sm + 1,
    paddingVertical: 5,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  metricPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.neutral.textSecondary,
  },
  printPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
  },
  printPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary[800],
  },
  // Tab Navigation
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  tabBtnActive: {
    backgroundColor: colors.neutral.surface,
    ...shadows.soft,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral.textMuted,
  },
  tabBtnTextActive: {
    color: colors.primary[700],
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm + 2,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.full,
    borderCurve: "continuous",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.neutral.textPrimary,
    padding: 0,
  },
  massActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 3,
    minHeight: 38,
  },
  massActionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
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
  itemSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.neutral.borderSubtle,
    marginHorizontal: spacing.md,
  },
  // Student Card
  studentCard: {
    backgroundColor: colors.neutral.surface,
    overflow: "hidden",
  },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    padding: spacing.md,
  },
  rowPressed: {
    backgroundColor: colors.neutral.canvas,
  },
  pressedState: {
    opacity: 0.7,
  },
  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.neutral.textSecondary,
  },
  studentInfoCol: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  studentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2,
  },
  studentNisText: {
    fontSize: 11,
    color: colors.neutral.textMuted,
  },
  removeBtn: {
    padding: spacing.xs + 2,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
  },
  removeBtnPressed: {
    opacity: 0.5,
  },
  // Pengampu Card
  pengampuCard: {
    backgroundColor: colors.neutral.surface,
    overflow: "hidden",
  },
  pengampuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    padding: spacing.md,
  },
  mapelBadge: {
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
  mapelBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary[700],
  },
  pengampuInfoCol: {
    flex: 1,
  },
  mapelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapelName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  guruLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  guruNameText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
  },
  guruNipText: {
    fontSize: 11,
    color: colors.neutral.textMuted,
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
    maxWidth: 480,
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
  candidateSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.canvas,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    gap: spacing.sm,
    marginBottom: spacing.sm + 2,
  },
  candidateList: {
    maxHeight: 280,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
  },
  candidateItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.borderSubtle,
  },
  candidateItemSelected: {
    backgroundColor: colors.primary[50],
  },
  candidateName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  candidateNameSelected: {
    color: colors.primary[800],
  },
  candidateSub: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 1,
  },
  emptyCandidatesBox: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyCandidatesText: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    textAlign: "center",
  },
  fieldGroup: {
    marginBottom: spacing.md + 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
    marginBottom: 6,
  },
  selectScroll: {
    maxHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
  },
  selectOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.borderSubtle,
  },
  selectOptionSelected: {
    backgroundColor: colors.primary[50],
  },
  selectOptionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  selectOptionTitleSelected: {
    color: colors.primary[800],
    fontWeight: "700",
  },
  selectOptionSub: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 1,
  },
  miniMapelBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderCurve: "continuous",
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  miniMapelText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary[700],
  },
  dynamicFilterHint: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary[700],
  },
  selectScrollEmpty: {
    backgroundColor: colors.neutral.surfaceHover,
    borderColor: colors.status.conflictBorder,
  },
  emptyMapelBox: {
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyMapelTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.status.conflict,
    textAlign: "center",
  },
  emptyMapelSub: {
    fontSize: 11,
    color: colors.neutral.textSecondary,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: spacing.sm,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm + 2,
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
    paddingTop: spacing.md,
  },
  // Mass Action Specific Styles
  massActionTypeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.sm + 2,
  },
  massTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  massTypeBtnActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  massTypeBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral.textMuted,
  },
  massTypeBtnTextActive: {
    color: colors.primary[700],
    fontWeight: "700",
  },
  actionNoteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: colors.neutral.canvas,
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.borderSubtle,
  },
  actionNoteText: {
    flex: 1,
    fontSize: 11,
    color: colors.neutral.textSecondary,
    lineHeight: 15,
  },
  emptyTargetBox: {
    padding: spacing.md,
    backgroundColor: colors.neutral.canvas,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    alignItems: "center",
  },
  emptyTargetText: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    textAlign: "center",
  },
  targetClassScroll: {
    maxHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
  },
  targetClassItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.borderSubtle,
  },
  targetClassItemSelected: {
    backgroundColor: colors.primary[50],
  },
  targetClassName: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  targetClassNameSelected: {
    color: colors.primary[800],
  },
  targetClassSub: {
    fontSize: 10,
    color: colors.neutral.textMuted,
  },
  textInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    color: colors.neutral.textPrimary,
    backgroundColor: colors.neutral.canvas,
  },
  selectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  toggleAllText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary[700],
  },
  studentPickScroll: {
    maxHeight: 150,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
  },
  studentPickItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.borderSubtle,
  },
  studentPickItemSelected: {
    backgroundColor: colors.primary[50],
  },
  studentPickName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  studentPickNameSelected: {
    color: colors.primary[800],
    fontWeight: "700",
  },
  studentPickSub: {
    fontSize: 10,
    color: colors.neutral.textMuted,
  },
  taOptionChip: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    minWidth: 130,
  },
  taOptionChipSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  taOptionChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  taOptionChipTextSelected: {
    color: colors.primary[800],
    fontWeight: "700",
  },
  quickCreateBox: {
    padding: spacing.sm + 2,
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.primary[200],
    marginBottom: spacing.sm + 2,
  },
  quickCreateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quickCreateTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary[800],
  },
  quickCreateSub: {
    fontSize: 10,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
});
