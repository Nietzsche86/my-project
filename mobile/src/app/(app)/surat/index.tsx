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
import * as DocumentPicker from "expo-document-picker";
import { colors, radius, radii, shadows, spacing } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { useSync } from "../../../context/SyncContext";
import { useAlert } from "../../../context/AlertContext";
import { AppShell } from "../../../components/layout/AppShell";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { Badge } from "../../../components/ui/Badge";
import { FAB, useToast } from "../../../components/ui";
import { db } from "../../../db/client";
import {
  suratKeluar,
  suratMasuk,
  siswa,
  waliSiswa,
  anggotaKelas,
  kelas,
  tahunAjaran,
  pengaturan,
  type SuratKeluar,
  type SuratMasuk,
  type Siswa,
} from "../../../db/schema";
import { desc, isNull, and, eq, like, or } from "drizzle-orm";
import { Ionicons } from "@expo/vector-icons";
import { generateUUID, getIsoUtcString } from "../../../db/crypto";
import { generateAndShareSuratKeteranganPdf } from "../../../utils/pdfGenerator";

function toRomanMonth(monthIndex: number): string {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[monthIndex] || "I";
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function SuratScreen() {
  const { role, user } = useAuth();
  const { refreshPendingCountAsync } = useSync();
  const { showAlert } = useAlert();

  const [tab, setTab] = useState<"keluar" | "masuk">("keluar");
  const [listKeluar, setListKeluar] = useState<SuratKeluar[]>([]);
  const [listMasuk, setListMasuk] = useState<SuratMasuk[]>([]);
  const [search, setSearch] = useState("");
  const [filterSifat, setFilterSifat] = useState<string>("all"); // 'all' | 'biasa' | 'penting' | 'rahasia'
  const [filterStatusKeluar, setFilterStatusKeluar] = useState<string>("all"); // 'all' | 'aktif' | 'dibatalkan'
  const [refreshing, setRefreshing] = useState(false);

  // Active Tahun Ajaran
  const [activeTaId, setActiveTaId] = useState<string | null>(null);
  const [activeTaNama, setActiveTaNama] = useState<string>("");
  const [activeTaSemester, setActiveTaSemester] = useState<string>("");

  // Modal Input Surat Keluar
  const [modalKeluarVisible, setModalKeluarVisible] = useState(false);
  const [noUrutCalculated, setNoUrutCalculated] = useState<number>(1);
  const [formKeluarNomor, setFormKeluarNomor] = useState("");
  const [formKeluarTanggal, setFormKeluarTanggal] = useState(getTodayIsoDate());
  const [formKeluarTujuan, setFormKeluarTujuan] = useState("");
  const [formKeluarPerihal, setFormKeluarPerihal] = useState("");
  const [formKeluarKategori, setFormKeluarKategori] = useState("Pemberitahuan");
  const [formKeluarSifat, setFormKeluarSifat] = useState<"biasa" | "penting" | "rahasia">("biasa");
  const [formKeluarKeterangan, setFormKeluarKeterangan] = useState("");
  const [formKeluarLampiran, setFormKeluarLampiran] = useState<string | null>(null);
  const [savingKeluar, setSavingKeluar] = useState(false);

  // Modal Batalkan Surat Keluar (Metode 1 - Tanpa Hapus)
  const [modalBatalVisible, setModalBatalVisible] = useState(false);
  const [selectedBatalSurat, setSelectedBatalSurat] = useState<SuratKeluar | null>(null);
  const [alasanBatalInput, setAlasanBatalInput] = useState("");
  const [processingBatal, setProcessingBatal] = useState(false);

  // Modal Input Surat Masuk
  const [modalMasukVisible, setModalMasukVisible] = useState(false);
  const [editingMasukId, setEditingMasukId] = useState<string | null>(null);
  const [formMasukNomor, setFormMasukNomor] = useState("");
  const [formMasukTanggalSurat, setFormMasukTanggalSurat] = useState(getTodayIsoDate());
  const [formMasukTanggalDiterima, setFormMasukTanggalDiterima] = useState(getTodayIsoDate());
  const [formMasukPengirim, setFormMasukPengirim] = useState("");
  const [formMasukPerihal, setFormMasukPerihal] = useState("");
  const [formMasukKategori, setFormMasukKategori] = useState("Edaran");
  const [formMasukSifat, setFormMasukSifat] = useState<"biasa" | "penting" | "rahasia">("biasa");
  const [formMasukKeterangan, setFormMasukKeterangan] = useState("");
  const [formMasukLampiran, setFormMasukLampiran] = useState<string | null>(null);
  const [savingMasuk, setSavingMasuk] = useState(false);

  // Modal Generator Surat Keterangan Siswa Aktif (PDF)
  const [modalKeteranganVisible, setModalKeteranganVisible] = useState(false);
  const [activeStudents, setActiveStudents] = useState<Siswa[]>([]);
  const [searchStudentTerm, setSearchStudentTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Siswa | null>(null);
  const [selectedStudentRombel, setSelectedStudentRombel] = useState<{ nama: string; tingkat: number } | null>(null);
  const [selectedStudentWali, setSelectedStudentWali] = useState<string>("");
  const [keperluanText, setKeperluanText] = useState("Persyaratan Pengajuan Program Indonesia Pintar (PIP / KIP)");
  const [generatingKeterangan, setGeneratingKeterangan] = useState(false);

  // Modal Detail Rincian Surat
  const [modalDetailVisible, setModalDetailVisible] = useState(false);
  const [selectedDetailKeluar, setSelectedDetailKeluar] = useState<SuratKeluar | null>(null);
  const [selectedDetailMasuk, setSelectedDetailMasuk] = useState<SuratMasuk | null>(null);

  useEffect(() => {
    loadAllData();
  }, [tab, search]);

  const loadAllData = async () => {
    try {
      // 1. Ambil tahun ajaran aktif
      const taRes = await db
        .select()
        .from(tahunAjaran)
        .where(and(eq(tahunAjaran.is_active, 1), isNull(tahunAjaran.deleted_at)))
        .limit(1);

      if (taRes.length > 0 && taRes[0]) {
        setActiveTaId(taRes[0].id);
        setActiveTaNama(taRes[0].nama);
        setActiveTaSemester(taRes[0].nama_semester);
      } else {
        const latestTa = await db.select().from(tahunAjaran).limit(1);
        if (latestTa.length > 0 && latestTa[0]) {
          setActiveTaId(latestTa[0].id);
          setActiveTaNama(latestTa[0].nama);
          setActiveTaSemester(latestTa[0].nama_semester);
        }
      }

      // 2. Query Surat Keluar
      if (tab === "keluar") {
        const term = search.trim();
        let queryRes: SuratKeluar[] = [];
        if (term) {
          const pat = `%${term}%`;
          queryRes = await db
            .select()
            .from(suratKeluar)
            .where(
              and(
                isNull(suratKeluar.deleted_at),
                or(
                  like(suratKeluar.nomor_surat, pat),
                  like(suratKeluar.perihal, pat),
                  like(suratKeluar.tujuan, pat),
                  like(suratKeluar.kategori, pat)
                )
              )
            )
            .orderBy(desc(suratKeluar.tahun), desc(suratKeluar.nomor_urut));
        } else {
          queryRes = await db
            .select()
            .from(suratKeluar)
            .where(isNull(suratKeluar.deleted_at))
            .orderBy(desc(suratKeluar.tahun), desc(suratKeluar.nomor_urut));
        }
        setListKeluar(queryRes);
      } else {
        // 3. Query Surat Masuk
        const term = search.trim();
        let queryRes: SuratMasuk[] = [];
        if (term) {
          const pat = `%${term}%`;
          queryRes = await db
            .select()
            .from(suratMasuk)
            .where(
              and(
                isNull(suratMasuk.deleted_at),
                or(
                  like(suratMasuk.nomor_surat, pat),
                  like(suratMasuk.perihal, pat),
                  like(suratMasuk.pengirim, pat),
                  like(suratMasuk.kategori, pat)
                )
              )
            )
            .orderBy(desc(suratMasuk.tanggal_diterima), desc(suratMasuk.created_at));
        } else {
          queryRes = await db
            .select()
            .from(suratMasuk)
            .where(isNull(suratMasuk.deleted_at))
            .orderBy(desc(suratMasuk.tanggal_diterima), desc(suratMasuk.created_at));
        }
        setListMasuk(queryRes);
      }
    } catch (e) {
      console.warn("Gagal memuat data surat:", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  // --- STATS RINGKASAN ---
  const statsKeluar = useMemo(() => {
    let aktif = 0;
    let dibatalkan = 0;
    listKeluar.forEach((s) => {
      if (s.status === "aktif") aktif++;
      else dibatalkan++;
    });
    const lastNo = listKeluar[0]?.nomor_urut || 0;
    return { total: listKeluar.length, aktif, dibatalkan, lastNo };
  }, [listKeluar]);

  const statsMasuk = useMemo(() => {
    let penting = 0;
    let rahasia = 0;
    let biasa = 0;
    listMasuk.forEach((s) => {
      if (s.sifat === "penting") penting++;
      else if (s.sifat === "rahasia") rahasia++;
      else biasa++;
    });
    return { total: listMasuk.length, penting, rahasia, biasa };
  }, [listMasuk]);

  // --- FILTERED LISTS ---
  const filteredKeluar = useMemo(() => {
    return listKeluar.filter((s) => {
      if (filterSifat !== "all" && s.sifat !== filterSifat) return false;
      if (filterStatusKeluar !== "all" && s.status !== filterStatusKeluar) return false;
      return true;
    });
  }, [listKeluar, filterSifat, filterStatusKeluar]);

  const filteredMasuk = useMemo(() => {
    return listMasuk.filter((s) => {
      if (filterSifat !== "all" && s.sifat !== filterSifat) return false;
      return true;
    });
  }, [listMasuk, filterSifat]);

  // --- PICK LAMPIRAN FILE ---
  const pickDocument = async (setter: (uri: string | null) => void) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        setter(res.assets[0].uri);
      }
    } catch (e) {
      console.warn("Gagal memilih file:", e);
    }
  };

  // --- FORM SURAT KELUAR ---
  const openCreateKeluarModal = async () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    try {
      const existingInYear = await db
        .select({ nomor_urut: suratKeluar.nomor_urut })
        .from(suratKeluar)
        .where(eq(suratKeluar.tahun, currentYear))
        .orderBy(desc(suratKeluar.nomor_urut))
        .limit(1);

      const nextNo = (existingInYear[0]?.nomor_urut || 0) + 1;
      setNoUrutCalculated(nextNo);

      const paddedNo = String(nextNo).padStart(3, "0");
      const romanMonth = toRomanMonth(currentMonth);
      const defaultNoSurat = `${paddedNo}/MTs.11.08/PP.00.5/${romanMonth}/${currentYear}`;

      setFormKeluarNomor(defaultNoSurat);
      setFormKeluarTanggal(getTodayIsoDate());
      setFormKeluarTujuan("");
      setFormKeluarPerihal("");
      setFormKeluarKategori("Pemberitahuan");
      setFormKeluarSifat("biasa");
      setFormKeluarKeterangan("");
      setFormKeluarLampiran(null);
      setModalKeluarVisible(true);
    } catch (e) {
      console.warn("Gagal inisialisasi surat keluar:", e);
    }
  };

  const handleSaveKeluar = async () => {
    if (!formKeluarNomor.trim() || !formKeluarTujuan.trim() || !formKeluarPerihal.trim()) {
      showAlert({
        title: "Data Belum Lengkap",
        message: "Nomor surat, tujuan, dan perihal wajib diisi.",
        type: "warning",
      });
      return;
    }

    if (!activeTaId) {
      showAlert({
        title: "Tahun Ajaran Kosong",
        message: "Tidak ada tahun ajaran aktif di database.",
        type: "error",
      });
      return;
    }

    setSavingKeluar(true);
    const nowIso = getIsoUtcString();
    const currentYear = new Date(formKeluarTanggal).getFullYear() || new Date().getFullYear();

    try {
      await db.insert(suratKeluar).values({
        id: generateUUID(),
        created_at: nowIso,
        updated_at: nowIso,
        deleted_at: null,
        sync_status: "pending_push",
        last_synced_at: null,
        version: 1,
        tahun_ajaran_id: activeTaId,
        tahun: currentYear,
        nomor_urut: noUrutCalculated,
        nomor_surat: formKeluarNomor.trim(),
        tanggal_surat: formKeluarTanggal,
        tujuan: formKeluarTujuan.trim(),
        perihal: formKeluarPerihal.trim(),
        kategori: formKeluarKategori,
        sifat: formKeluarSifat,
        status: "aktif",
        alasan_batal: null,
        lampiran_local_path: formKeluarLampiran,
        lampiran_remote_url: null,
        keterangan: formKeluarKeterangan.trim() || null,
        created_by: user?.id || null,
      });

      await refreshPendingCountAsync();
      setModalKeluarVisible(false);
      await loadAllData();

      showAlert({
        title: "Surat Keluar Dicatat",
        message: `Surat Keluar Agenda #${noUrutCalculated} (${formKeluarNomor}) berhasil diregistrasikan.`,
        type: "success",
      });
    } catch (e: any) {
      showAlert({
        title: "Gagal Menyimpan Surat",
        message: e?.message || "Terjadi kesalahan database.",
        type: "error",
      });
    } finally {
      setSavingKeluar(false);
    }
  };

  // --- PEMBATALAN SURAT KELUAR (METODE 1 - TANPA HAPUS) ---
  const openBatalModal = (sk: SuratKeluar) => {
    setSelectedBatalSurat(sk);
    setAlasanBatalInput("");
    setModalBatalVisible(true);
  };

  const handleExecuteBatalSurat = async () => {
    if (!selectedBatalSurat) return;
    if (!alasanBatalInput.trim()) {
      showAlert({
        title: "Alasan Batal Wajib Diisi",
        message: "Untuk menjaga integritas buku agenda persuratan, Anda wajib mencatat alasan pembatalan surat.",
        type: "warning",
      });
      return;
    }

    setProcessingBatal(true);
    const nowIso = getIsoUtcString();

    try {
      await db
        .update(suratKeluar)
        .set({
          status: "dibatalkan",
          alasan_batal: alasanBatalInput.trim(),
          updated_at: nowIso,
          sync_status: "pending_push",
          version: (selectedBatalSurat.version || 1) + 1,
        })
        .where(eq(suratKeluar.id, selectedBatalSurat.id));

      await refreshPendingCountAsync();
      setModalBatalVisible(false);
      await loadAllData();

      showAlert({
        title: "Surat Berhasil Dibatalkan",
        message: `Surat Agenda #${selectedBatalSurat.nomor_urut} telah ditandai sebagai 'DIBATALKAN' dengan alasan '${alasanBatalInput.trim()}'. Nomor urut tetap terjaga utuh.`,
        type: "info",
      });
    } catch (e: any) {
      showAlert({
        title: "Gagal Membatalkan Surat",
        message: e?.message || "Terjadi kesalahan sistem.",
        type: "error",
      });
    } finally {
      setProcessingBatal(false);
    }
  };

  // --- FORM SURAT MASUK ---
  const openCreateMasukModal = () => {
    setEditingMasukId(null);
    setFormMasukNomor("");
    setFormMasukTanggalSurat(getTodayIsoDate());
    setFormMasukTanggalDiterima(getTodayIsoDate());
    setFormMasukPengirim("");
    setFormMasukPerihal("");
    setFormMasukKategori("Edaran");
    setFormMasukSifat("biasa");
    setFormMasukKeterangan("");
    setFormMasukLampiran(null);
    setModalMasukVisible(true);
  };

  const openEditMasukModal = (sm: SuratMasuk) => {
    setEditingMasukId(sm.id);
    setFormMasukNomor(sm.nomor_surat);
    setFormMasukTanggalSurat(sm.tanggal_surat);
    setFormMasukTanggalDiterima(sm.tanggal_diterima);
    setFormMasukPengirim(sm.pengirim);
    setFormMasukPerihal(sm.perihal);
    setFormMasukKategori(sm.kategori || "Edaran");
    setFormMasukSifat(sm.sifat as any);
    setFormMasukKeterangan(sm.keterangan || "");
    setFormMasukLampiran(sm.lampiran_local_path);
    setModalMasukVisible(true);
  };

  const handleSaveMasuk = async () => {
    if (!formMasukNomor.trim() || !formMasukPengirim.trim() || !formMasukPerihal.trim()) {
      showAlert({
        title: "Data Belum Lengkap",
        message: "Nomor surat, instansi pengirim, dan perihal wajib diisi.",
        type: "warning",
      });
      return;
    }

    if (!activeTaId) {
      showAlert({
        title: "Tahun Ajaran Kosong",
        message: "Tidak ada tahun ajaran aktif di database.",
        type: "error",
      });
      return;
    }

    setSavingMasuk(true);
    const nowIso = getIsoUtcString();

    try {
      if (editingMasukId) {
        await db
          .update(suratMasuk)
          .set({
            nomor_surat: formMasukNomor.trim(),
            tanggal_surat: formMasukTanggalSurat,
            tanggal_diterima: formMasukTanggalDiterima,
            pengirim: formMasukPengirim.trim(),
            perihal: formMasukPerihal.trim(),
            kategori: formMasukKategori,
            sifat: formMasukSifat,
            lampiran_local_path: formMasukLampiran,
            keterangan: formMasukKeterangan.trim() || null,
            updated_at: nowIso,
            sync_status: "pending_push",
          })
          .where(eq(suratMasuk.id, editingMasukId));

        showAlert({
          title: "Surat Masuk Diperbarui",
          message: "Data surat masuk berhasil disimpan.",
          type: "success",
        });
      } else {
        await db.insert(suratMasuk).values({
          id: generateUUID(),
          created_at: nowIso,
          updated_at: nowIso,
          deleted_at: null,
          sync_status: "pending_push",
          last_synced_at: null,
          version: 1,
          tahun_ajaran_id: activeTaId,
          nomor_surat: formMasukNomor.trim(),
          tanggal_surat: formMasukTanggalSurat,
          tanggal_diterima: formMasukTanggalDiterima,
          pengirim: formMasukPengirim.trim(),
          perihal: formMasukPerihal.trim(),
          kategori: formMasukKategori,
          sifat: formMasukSifat,
          lampiran_local_path: formMasukLampiran,
          lampiran_remote_url: null,
          keterangan: formMasukKeterangan.trim() || null,
          created_by: user?.id || null,
        });

        showAlert({
          title: "Surat Masuk Dicatat",
          message: "Surat masuk berhasil ditambahkan ke agenda buku surat masuk.",
          type: "success",
        });
      }

      await refreshPendingCountAsync();
      setModalMasukVisible(false);
      await loadAllData();
    } catch (e: any) {
      showAlert({
        title: "Gagal Menyimpan Surat",
        message: e?.message || "Terjadi kesalahan database.",
        type: "error",
      });
    } finally {
      setSavingMasuk(false);
    }
  };

  const handleDeleteMasuk = (sm: SuratMasuk) => {
    showAlert({
      title: "Hapus Surat Masuk",
      message: `Hapus catatan surat masuk dari "${sm.pengirim}" (Nomor: ${sm.nomor_surat})?`,
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
                .update(suratMasuk)
                .set({
                  deleted_at: nowIso,
                  updated_at: nowIso,
                  sync_status: "pending_push",
                })
                .where(eq(suratMasuk.id, sm.id));

              await refreshPendingCountAsync();
              await loadAllData();
              showAlert({
                title: "Dihapus",
                message: "Catatan surat masuk berhasil dihapus.",
                type: "info",
              });
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

  const handleDeleteKeluar = (sk: SuratKeluar) => {
    showAlert({
      title: "Hapus Surat Keluar (Super Admin)",
      message: `Hapus catatan surat keluar nomor "${sk.nomor_surat}" (Agenda #${sk.nomor_urut})?\n\nSebagai Super Admin, data arsip ini akan ditandai terhapus di database lokal.`,
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
                .update(suratKeluar)
                .set({
                  deleted_at: nowIso,
                  updated_at: nowIso,
                  sync_status: "pending_push",
                })
                .where(eq(suratKeluar.id, sk.id));

              await refreshPendingCountAsync();
              await loadAllData();
              showAlert({
                title: "Dihapus",
                message: "Catatan surat keluar berhasil dihapus.",
                type: "info",
              });
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

  // --- GENERATOR SURAT KETERANGAN SISWA AKTIF (PDF) ---
  const openSuratKeteranganModal = async () => {
    try {
      const activeSiswa = await db
        .select()
        .from(siswa)
        .where(and(eq(siswa.status, "aktif"), isNull(siswa.deleted_at)));
      activeSiswa.sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));

      setActiveStudents(activeSiswa);
      setSelectedStudent(null);
      setSelectedStudentRombel(null);
      setSelectedStudentWali("");
      setSearchStudentTerm("");
      setKeperluanText("Persyaratan Pengajuan Program Indonesia Pintar (PIP / KIP)");
      setModalKeteranganVisible(true);
    } catch (e) {
      console.warn("Gagal membuka generator surat:", e);
    }
  };

  const handleSelectStudentForKeterangan = async (s: Siswa) => {
    setSelectedStudent(s);
    try {
      if (activeTaId) {
        const rRes = await db
          .select({ nama: kelas.nama, tingkat: kelas.tingkat })
          .from(anggotaKelas)
          .innerJoin(kelas, eq(anggotaKelas.kelas_id, kelas.id))
          .where(
            and(
              eq(anggotaKelas.siswa_id, s.id),
              eq(anggotaKelas.tahun_ajaran_id, activeTaId),
              isNull(anggotaKelas.deleted_at)
            )
          )
          .limit(1);

        if (rRes.length > 0 && rRes[0]) {
          setSelectedStudentRombel(rRes[0]);
        } else {
          setSelectedStudentRombel({ nama: "Belum Ditentukan", tingkat: 7 });
        }
      }

      const wRes = await db
        .select({ nama: waliSiswa.nama_lengkap, hubungan: waliSiswa.hubungan })
        .from(waliSiswa)
        .where(and(eq(waliSiswa.siswa_id, s.id), isNull(waliSiswa.deleted_at)));

      const ayah = wRes.find((w) => w.hubungan === "ayah");
      const ibu = wRes.find((w) => w.hubungan === "ibu");
      const wali = wRes.find((w) => w.hubungan === "wali");
      setSelectedStudentWali(ayah?.nama || ibu?.nama || wali?.nama || "-");
    } catch (e) {
      console.warn("Gagal mengambil relasi siswa:", e);
    }
  };

  const handleGenerateAndSaveSuratKeterangan = async () => {
    if (!selectedStudent) {
      showAlert({
        title: "Pilih Siswa",
        message: "Pilih siswa terlebih dahulu untuk membuat surat keterangan.",
        type: "warning",
      });
      return;
    }

    if (!keperluanText.trim()) {
      showAlert({
        title: "Keperluan Kosong",
        message: "Tuliskan keperluan penerbitan surat keterangan siswa.",
        type: "warning",
      });
      return;
    }

    if (!activeTaId) {
      showAlert({
        title: "Tahun Ajaran Kosong",
        message: "Tidak ada tahun ajaran aktif yang terkonfigurasi.",
        type: "error",
      });
      return;
    }

    setGeneratingKeterangan(true);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const nowIso = getIsoUtcString();
    const todayStr = getTodayIsoDate();

    try {
      const existingInYear = await db
        .select({ nomor_urut: suratKeluar.nomor_urut })
        .from(suratKeluar)
        .where(eq(suratKeluar.tahun, currentYear))
        .orderBy(desc(suratKeluar.nomor_urut))
        .limit(1);

      const nextNo = (existingInYear[0]?.nomor_urut || 0) + 1;
      const paddedNo = String(nextNo).padStart(3, "0");
      const romanMonth = toRomanMonth(currentMonth);
      const generatedNoSurat = `${paddedNo}/MTs.11.08/PP.00.5/${romanMonth}/${currentYear}`;

      const settingRecords = await db.select().from(pengaturan);
      const setMap = new Map<string, string>();
      settingRecords.forEach((s) => setMap.set(s.key, s.value));
      const kepalaNama = setMap.get("nama_kepala_madrasah") || "H. Ahmad Fauzi, S.Pd.I., M.Pd.";
      const kepalaNip = setMap.get("nip_kepala_madrasah") || "197805122005011003";

      await db.insert(suratKeluar).values({
        id: generateUUID(),
        created_at: nowIso,
        updated_at: nowIso,
        deleted_at: null,
        sync_status: "pending_push",
        last_synced_at: null,
        version: 1,
        tahun_ajaran_id: activeTaId,
        tahun: currentYear,
        nomor_urut: nextNo,
        nomor_surat: generatedNoSurat,
        tanggal_surat: todayStr,
        tujuan: keperluanText.trim(),
        perihal: `Surat Keterangan Aktif Siswa - ${selectedStudent.nama_lengkap}`,
        kategori: "Surat Keterangan",
        sifat: "biasa",
        status: "aktif",
        alasan_batal: null,
        lampiran_local_path: null,
        lampiran_remote_url: null,
        keterangan: `Diterbitkan otomatis untuk keperluan: ${keperluanText.trim()}`,
        created_by: user?.id || null,
      });

      await refreshPendingCountAsync();

      const printRes = await generateAndShareSuratKeteranganPdf({
        nomorSurat: generatedNoSurat,
        tanggalSurat: todayStr,
        siswa: {
          namaLengkap: selectedStudent.nama_lengkap,
          nis: selectedStudent.nis,
          nisn: selectedStudent.nisn,
          tempatLahir: selectedStudent.tempat_lahir,
          tanggalLahir: selectedStudent.tanggal_lahir,
          jenisKelamin: selectedStudent.jenis_kelamin,
          kelasNama: selectedStudentRombel?.nama || "-",
          tingkat: selectedStudentRombel?.tingkat || 7,
          namaWali: selectedStudentWali,
          alamat: selectedStudent.alamat_jalan
            ? `${selectedStudent.alamat_jalan}${
                selectedStudent.desa ? `, Desa ${selectedStudent.desa}` : ""
              }${selectedStudent.kecamatan ? `, Kec. ${selectedStudent.kecamatan}` : ""}`
            : "-",
        },
        tahunAjaranNama: activeTaNama || "2026/2027",
        semesterNama: activeTaSemester || "Ganjil",
        keperluan: keperluanText.trim(),
        kepalaMadrasahName: kepalaNama,
        kepalaMadrasahNip: kepalaNip,
      });

      setModalKeteranganVisible(false);
      await loadAllData();

      if (printRes.success) {
        showAlert({
          title: "Surat Keterangan Selesai",
          message: `Surat Keterangan atas nama ${selectedStudent.nama_lengkap} berhasil dibuat dan otomatis diregistrasikan ke Agenda Surat Keluar #${nextNo}.`,
          type: "success",
        });
      } else {
        showAlert({
          title: "Surat Tercatat (Gagal Cetak)",
          message: printRes.message,
          type: "warning",
        });
      }
    } catch (e: any) {
      showAlert({
        title: "Gagal Menerbitkan Surat",
        message: e?.message || "Terjadi kesalahan sistem.",
        type: "error",
      });
    } finally {
      setGeneratingKeterangan(false);
    }
  };

  const filteredCandidateStudents = useMemo(() => {
    const q = searchStudentTerm.toLowerCase().trim();
    if (!q) return activeStudents;
    return activeStudents.filter(
      (s) =>
        s.nama_lengkap.toLowerCase().includes(q) ||
        (s.nis && s.nis.toLowerCase().includes(q)) ||
        (s.nisn && s.nisn.toLowerCase().includes(q))
    );
  }, [activeStudents, searchStudentTerm]);

  // Kunci Mutlak Akses: Guru & Guest ditolak
  if (role === "guru" || role === "guest") {
    return (
      <AppShell title="Akses Dibatasi">
        <View style={styles.forbiddenContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.status.conflict} />
          <Text style={styles.forbiddenTitle}>Akses Surat Dibatasi</Text>
          <Text style={styles.forbiddenSub}>
            Modul Administrasi Surat Menyurat (Surat Masuk & Surat Keluar) bersifat konfidensial
            dan hanya dapat diakses oleh Super Admin dan Staf Tata Usaha (Operator Madrasah).
          </Text>
        </View>
        {/* FAB Tambah Surat (Mobile only < 768px, Bagian 3 & 14) */}
      <FAB
        onPress={() => (tab === "keluar" ? openCreateKeluarModal() : openCreateMasukModal())}
        accessibilityLabel={tab === "keluar" ? "Catat Surat Keluar" : "Catat Surat Masuk"}
      />
    </AppShell>
    );
  }

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

  const renderKeluarItem = useCallback(
    ({ item: sk, index }: { item: SuratKeluar; index: number }) => {
      const isBatal = sk.status === "dibatalkan";
      const shape = getGroupedShape(index, filteredKeluar.length);

      return (
        <View style={[styles.card, isBatal && styles.cardBatal, shape]}>
          <View style={styles.cardHeader}>
            <View style={styles.noCol}>
              <View style={styles.agendaNumberBadge}>
                <Text style={styles.agendaNumberText}>#{sk.nomor_urut}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nomorSurat}>{sk.nomor_surat}</Text>
                <Text style={styles.tglSuratText}>Tanggal: {sk.tanggal_surat}</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Badge
                label={isBatal ? "DIBATALKAN" : "AKTIF"}
                variant={isBatal ? "cancelled" : "active"}
                size="sm"
              />
              <Badge label={sk.sifat.toUpperCase()} variant="neutral" size="sm" />
            </View>
          </View>

          <Text style={styles.perihalText}>{sk.perihal}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="navigate-outline" size={13} color={colors.neutral.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              Tujuan: <Text style={{ fontWeight: "600" }}>{sk.tujuan}</Text>
            </Text>
          </View>

          {sk.kategori && (
            <View style={styles.kategoriRow}>
              <Badge label={sk.kategori} variant="gold" size="sm" />
              {sk.lampiran_local_path && (
                <View style={styles.attachmentPill}>
                  <Ionicons name="attach" size={12} color={colors.primary[700]} />
                  <Text style={styles.attachmentPillText}>Lampiran Tersedia</Text>
                </View>
              )}
            </View>
          )}

          {isBatal && (
            <View style={styles.batalBox}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="alert-circle" size={14} color={colors.status.cancelled} />
                <Text style={styles.batalTitle}>Surat Keluar Dibatalkan</Text>
              </View>
              <Text style={styles.batalReason}>
                Alasan: {sk.alasan_batal || "Tidak ada catatan alasan"}
              </Text>
            </View>
          )}

          <View style={styles.cardActionRow}>
            <Pressable
              style={({ pressed }) => [styles.detailBtn, pressed && styles.pressedState]}
              onPress={() => {
                setSelectedDetailKeluar(sk);
                setSelectedDetailMasuk(null);
                setModalDetailVisible(true);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Lihat Detail Surat Keluar"
            >
              <Ionicons name="eye-outline" size={14} color={colors.primary[700]} />
              <Text style={styles.detailBtnText}>Lihat Detail</Text>
            </Pressable>

            {!isBatal && (
              <Pressable
                style={({ pressed }) => [styles.batalActionBtn, pressed && styles.pressedState]}
                onPress={() => openBatalModal(sk)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Batalkan Surat Keluar"
              >
                <Ionicons
                  name="close-circle-outline"
                  size={14}
                  color={colors.status.cancelled}
                />
                <Text style={styles.batalActionBtnText}>Batalkan Surat</Text>
              </Pressable>
            )}

            {role === "super_admin" && (
              <Pressable
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressedState]}
                onPress={() => handleDeleteKeluar(sk)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Hapus Surat Keluar"
              >
                <Ionicons name="trash-outline" size={14} color={colors.status.conflict} />
                <Text style={[styles.deleteBtnText, { color: colors.status.conflict }]}>Hapus</Text>
              </Pressable>
            )}
          </View>
        </View>
      );
    },
    [filteredKeluar.length, role]
  );

  const renderMasukItem = useCallback(
    ({ item: sm, index }: { item: SuratMasuk; index: number }) => {
      const shape = getGroupedShape(index, filteredMasuk.length);

      return (
        <View style={[styles.card, shape]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nomorSurat}>{sm.nomor_surat}</Text>
              <Text style={styles.tglSuratText}>
                Tgl Surat: {sm.tanggal_surat} • Diterima: {sm.tanggal_diterima}
              </Text>
            </View>
            <Badge label={sm.sifat.toUpperCase()} variant="primary" size="sm" />
          </View>

          <Text style={styles.perihalText}>{sm.perihal}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="business-outline" size={13} color={colors.neutral.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              Pengirim: <Text style={{ fontWeight: "600" }}>{sm.pengirim}</Text>
            </Text>
          </View>

          {sm.kategori && (
            <View style={styles.kategoriRow}>
              <Badge label={sm.kategori} variant="gold" size="sm" />
              {sm.lampiran_local_path && (
                <View style={styles.attachmentPill}>
                  <Ionicons name="attach" size={12} color={colors.primary[700]} />
                  <Text style={styles.attachmentPillText}>Lampiran Tersedia</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.cardActionRow}>
            <Pressable
              style={({ pressed }) => [styles.detailBtn, pressed && styles.pressedState]}
              onPress={() => {
                setSelectedDetailMasuk(sm);
                setSelectedDetailKeluar(null);
                setModalDetailVisible(true);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Lihat Detail Surat Masuk"
            >
              <Ionicons name="eye-outline" size={14} color={colors.primary[700]} />
              <Text style={styles.detailBtnText}>Lihat Detail</Text>
            </Pressable>

            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Pressable
                style={({ pressed }) => [styles.editBtn, pressed && styles.pressedState]}
                onPress={() => openEditMasukModal(sm)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Edit Surat Masuk"
              >
                <Ionicons name="create-outline" size={14} color={colors.neutral.textSecondary} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressedState]}
                onPress={() => handleDeleteMasuk(sm)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Hapus Surat Masuk"
              >
                <Ionicons name="trash-outline" size={14} color={colors.status.cancelled} />
                <Text style={styles.deleteBtnText}>Hapus</Text>
              </Pressable>
            </View>
          </View>
        </View>
      );
    },
    [filteredMasuk.length]
  );

  const renderHeader = useMemo(() => {
    return (
      <View style={styles.headerContainer}>
        {/* TOP TAB SWITCHER */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => setTab("keluar")}
            style={({ pressed }) => [
              styles.tabBtn,
              tab === "keluar" && styles.tabBtnActive,
              pressed && styles.pressedState,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === "keluar" }}
          >
            <Ionicons
              name="paper-plane-outline"
              size={16}
              color={tab === "keluar" ? colors.neutral.white : colors.neutral.textMuted}
            />
            <Text style={[styles.tabText, tab === "keluar" && styles.tabTextActive]}>
              Surat Keluar (Metode 1)
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTab("masuk")}
            style={({ pressed }) => [
              styles.tabBtn,
              tab === "masuk" && styles.tabBtnActive,
              pressed && styles.pressedState,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === "masuk" }}
          >
            <Ionicons
              name="file-tray-full-outline"
              size={16}
              color={tab === "masuk" ? colors.neutral.white : colors.neutral.textMuted}
            />
            <Text style={[styles.tabText, tab === "masuk" && styles.tabTextActive]}>
              Surat Masuk
            </Text>
          </Pressable>
        </View>

        {/* STATS OVERVIEW CARDS */}
        {tab === "keluar" ? (
          <ModernCard style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{statsKeluar.total}</Text>
                <Text style={styles.statLabel}>Total Agenda</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.status.active }]}>
                  {statsKeluar.aktif}
                </Text>
                <Text style={styles.statLabel}>Surat Aktif</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.status.cancelled }]}>
                  {statsKeluar.dibatalkan}
                </Text>
                <Text style={styles.statLabel}>Dibatalkan</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.accent.gold }]}>
                  #{statsKeluar.lastNo}
                </Text>
                <Text style={styles.statLabel}>No. Terakhir</Text>
              </View>
            </View>
          </ModernCard>
        ) : (
          <ModernCard style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{statsMasuk.total}</Text>
                <Text style={styles.statLabel}>Total Masuk</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.status.cancelled }]}>
                  {statsMasuk.penting}
                </Text>
                <Text style={styles.statLabel}>Penting</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.accent.gold }]}>
                  {statsMasuk.rahasia}
                </Text>
                <Text style={styles.statLabel}>Rahasia</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.primary[700] }]}>
                  {statsMasuk.biasa}
                </Text>
                <Text style={styles.statLabel}>Biasa</Text>
              </View>
            </View>
          </ModernCard>
        )}

        {/* RULE BANNER (METODE 1) */}
        {tab === "keluar" && (
          <View style={styles.ruleNotice}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary[700]} />
            <Text style={styles.ruleNoticeText}>
              <Text style={{ fontWeight: "700" }}>Metode 1 (Tanpa Hapus):</Text> Nomor urut surat
              keluar berurutan per tahun kalender. Surat tidak dapat dihapus; jika salah input ubah
              status menjadi "Dibatalkan" dengan menyertakan alasan.
            </Text>
          </View>
        )}

        {/* ACTION BUTTONS ROW */}
        <View style={styles.actionTopRow}>
          {tab === "keluar" ? (
            <>
              <ModernButton
                title="+ Surat Keluar"
                size="sm"
                onPress={openCreateKeluarModal}
                icon={<Ionicons name="add-circle" size={16} color={colors.neutral.white} />}
                style={{ flex: 1 }}
              />
              <Pressable
                style={({ pressed }) => [styles.magicPdfButton, pressed && styles.pressedState]}
                onPress={openSuratKeteranganModal}
                accessibilityRole="button"
                accessibilityLabel="Cetak Surat Keterangan Siswa"
              >
                <Ionicons name="sparkles" size={15} color={colors.accent.gold} />
                <Text style={styles.magicPdfButtonText}>Cetak Surat Ket. Siswa</Text>
              </Pressable>
            </>
          ) : (
            <ModernButton
              title="+ Catat Surat Masuk"
              size="sm"
              onPress={openCreateMasukModal}
              icon={<Ionicons name="add-circle" size={16} color={colors.neutral.white} />}
              style={{ flex: 1 }}
            />
          )}
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchRow}>
          <View style={styles.searchWrapper}>
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.neutral.textMuted}
              style={styles.searchIcon}
            />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={
                tab === "keluar"
                  ? "Cari nomor surat, tujuan, atau perihal..."
                  : "Cari nomor surat, pengirim, atau perihal..."
              }
              placeholderTextColor={colors.neutral.textSubtle}
              style={styles.searchInput}
            />
            {search.length > 0 && (
              <Pressable
                onPress={() => setSearch("")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Hapus pencarian surat"
              >
                <Ionicons name="close-circle" size={16} color={colors.neutral.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* FILTER CHIPS: SIFAT & STATUS */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {[
              { id: "all", label: "Semua Sifat" },
              { id: "biasa", label: "Biasa" },
              { id: "penting", label: "⚡ Penting" },
              { id: "rahasia", label: "🔒 Rahasia" },
            ].map((chip) => {
              const active = filterSifat === chip.id;
              return (
                <Pressable
                  key={`sifat-${chip.id}`}
                  style={({ pressed }) => [
                    styles.chip,
                    active && styles.chipActive,
                    pressed && styles.pressedState,
                  ]}
                  onPress={() => setFilterSifat(chip.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}

            {tab === "keluar" &&
              [
                { id: "all", label: "Semua Status" },
                { id: "aktif", label: "✓ Aktif" },
                { id: "dibatalkan", label: "✗ Dibatalkan" },
              ].map((chip) => {
                const active = filterStatusKeluar === chip.id;
                return (
                  <Pressable
                    key={`status-${chip.id}`}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.pressedState,
                    ]}
                    onPress={() => setFilterStatusKeluar(chip.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
          </ScrollView>
        </View>
      </View>
    );
  }, [
    tab,
    statsKeluar,
    statsMasuk,
    search,
    filterSifat,
    filterStatusKeluar,
  ]);

  const renderEmptyComponent = useMemo(() => {
    return (
      <ModernCard style={styles.emptyCard}>
        <Ionicons name="mail-unread-outline" size={48} color={colors.neutral.textMuted} />
        <Text style={styles.emptyTitle}>Belum Ada Arsip Surat</Text>
        <Text style={styles.emptyText}>
          {search.trim() || filterSifat !== "all"
            ? "Tidak ada arsip persuratan yang cocok dengan filter atau pencarian Anda."
            : tab === "keluar"
            ? "Belum ada surat keluar yang dicatat. Tekan '+ Surat Keluar' untuk mencatat nomor agenda baru."
            : "Belum ada surat masuk yang dicatat. Tekan '+ Catat Surat Masuk' untuk menambahkan surat masuk."}
        </Text>
      </ModernCard>
    );
  }, [search, filterSifat, tab]);

  return (
    <AppShell
      title="Administrasi Surat"
      subtitle={tab === "keluar" ? "Agenda Surat Keluar" : "Buku Agenda Surat Masuk"}
      onAdd={() => (tab === "keluar" ? openCreateKeluarModal() : openCreateMasukModal())}
      addLabel={tab === "keluar" ? "Catat Surat Keluar" : "Catat Surat Masuk"}
    >
      {tab === "keluar" ? (
        <FlatList
          data={filteredKeluar}
          keyExtractor={(item) => item.id}
          renderItem={renderKeluarItem}
          ItemSeparatorComponent={renderItemSeparator}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyComponent}
          style={styles.flatList}
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
        />
      ) : (
        <FlatList
          data={filteredMasuk}
          keyExtractor={(item) => item.id}
          renderItem={renderMasukItem}
          ItemSeparatorComponent={renderItemSeparator}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyComponent}
          style={styles.flatList}
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
        />
      )}

      {/* ================= MODAL 1: INPUT SURAT KELUAR ================= */}
      <Modal visible={modalKeluarVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "90%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Catat Surat Keluar Baru</Text>
                <Text style={styles.modalSubtitle}>
                  Buku Agenda Surat Keluar (Nomor Urut Otomatis)
                </Text>
              </View>
              <Pressable
                onPress={() => setModalKeluarVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog surat keluar"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Nomor Urut Banner */}
              <View style={styles.agendaBanner}>
                <Text style={styles.agendaBannerLabel}>NOMOR URUT AGENDA:</Text>
                <Text style={styles.agendaBannerNumber}>#{noUrutCalculated}</Text>
                <Text style={styles.agendaBannerSub}>
                  Tahun Kalender {new Date().getFullYear()}
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nomor Surat Lengkap *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formKeluarNomor}
                  onChangeText={setFormKeluarNomor}
                  placeholder="Contoh: 001/MTs.11.08/PP.00.5/X/2026"
                  placeholderTextColor={colors.neutral.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Tanggal Surat (YYYY-MM-DD) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formKeluarTanggal}
                  onChangeText={setFormKeluarTanggal}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.neutral.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Tujuan Surat *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formKeluarTujuan}
                  onChangeText={setFormKeluarTujuan}
                  placeholder="Contoh: Kepala Kantor Kemenag Kab. Magelang"
                  placeholderTextColor={colors.neutral.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Perihal Surat *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formKeluarPerihal}
                  onChangeText={setFormKeluarPerihal}
                  placeholder="Contoh: Permohonan Narasumber Workshop Guru"
                  placeholderTextColor={colors.neutral.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Kategori Surat</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {["Pemberitahuan", "Undangan", "Permohonan", "Tugas", "Surat Keterangan", "Rekomendasi", "Edaran"].map((k) => (
                    <Pressable
                      key={k}
                      style={({ pressed }) => [
                        styles.smallChip,
                        formKeluarKategori === k && styles.smallChipActive,
                        pressed && styles.pressedState,
                      ]}
                      onPress={() => setFormKeluarKategori(k)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: formKeluarKategori === k }}
                    >
                      <Text style={[styles.smallChipText, formKeluarKategori === k && styles.smallChipTextActive]}>
                        {k}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Sifat Surat</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["biasa", "penting", "rahasia"] as const).map((s) => (
                    <Pressable
                      key={s}
                      style={({ pressed }) => [
                        styles.sifatBtn,
                        formKeluarSifat === s && styles.sifatBtnActive,
                        pressed && styles.pressedState,
                      ]}
                      onPress={() => setFormKeluarSifat(s)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: formKeluarSifat === s }}
                    >
                      <Text style={[styles.sifatBtnText, formKeluarSifat === s && styles.sifatBtnTextActive]}>
                        {s.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Keterangan / Catatan Arsip</Text>
                <TextInput
                  style={[styles.textInput, { height: 60 }]}
                  value={formKeluarKeterangan}
                  onChangeText={setFormKeluarKeterangan}
                  placeholder="Catatan tambahan (opsional)..."
                  placeholderTextColor={colors.neutral.textMuted}
                  multiline
                />
              </View>

              {/* Unggah Berkas Lampiran */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Lampiran Dokumen (PDF / Gambar)</Text>
                <Pressable
                  style={({ pressed }) => [styles.uploadDocBtn, pressed && styles.pressedState]}
                  onPress={() => pickDocument(setFormKeluarLampiran)}
                  accessibilityRole="button"
                  accessibilityLabel="Pilih file lampiran"
                >
                  <Ionicons name="document-attach-outline" size={18} color={colors.primary[700]} />
                  <Text style={styles.uploadDocBtnText} numberOfLines={1}>
                    {formKeluarLampiran ? "Ganti File Lampiran" : "Pilih File Lampiran"}
                  </Text>
                </Pressable>
                {formKeluarLampiran && (
                  <Text style={styles.uploadedFileUri} numberOfLines={1}>
                    ✓ Terpilih: {formKeluarLampiran}
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                onPress={() => setModalKeluarVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title={savingKeluar ? "Menyimpan..." : "Simpan Agenda"}
                variant="primary"
                size="md"
                onPress={handleSaveKeluar}
                loading={savingKeluar}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 2: BATALKAN SURAT KELUAR ================= */}
      <Modal visible={modalBatalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.status.cancelled }]}>
                  Batalkan Surat Keluar
                </Text>
                <Text style={styles.modalSubtitle}>
                  Metode 1: Surat tidak dihapus agar nomor urut agenda tetap terjaga
                </Text>
              </View>
              <Pressable
                onPress={() => setModalBatalVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog pembatalan"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.batalAlertCard}>
              <Text style={styles.batalAlertTitle}>
                Surat Agenda #{selectedBatalSurat?.nomor_urut}
              </Text>
              <Text style={styles.batalAlertSub}>{selectedBatalSurat?.nomor_surat}</Text>
              <Text style={styles.batalAlertPerihal}>"{selectedBatalSurat?.perihal}"</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Alasan Pembatalan Surat * (Wajib Diisi)</Text>
              <TextInput
                style={[styles.textInput, { height: 80 }]}
                value={alasanBatalInput}
                onChangeText={setAlasanBatalInput}
                placeholder="Tuliskan alasan pembatalan (misal: salah input nama tujuan, kegiatan dibatalkan oleh dinas, dll)..."
                placeholderTextColor={colors.neutral.textMuted}
                multiline
              />
            </View>

            <View style={styles.modalActions}>
              <ModernButton
                title="Kembali"
                variant="outline"
                size="md"
                onPress={() => setModalBatalVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title={processingBatal ? "Memproses..." : "Ya, Batalkan Surat"}
                variant="primary"
                size="md"
                onPress={handleExecuteBatalSurat}
                loading={processingBatal}
                disabled={!alasanBatalInput.trim()}
                style={{ flex: 1.4, backgroundColor: colors.status.cancelled }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 3: INPUT / EDIT SURAT MASUK ================= */}
      <Modal visible={modalMasukVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "90%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingMasukId ? "Edit Surat Masuk" : "Catat Surat Masuk"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Buku Agenda Penerimaan Surat Masuk Madrasah
                </Text>
              </View>
              <Pressable
                onPress={() => setModalMasukVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog surat masuk"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nomor Surat Asal *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formMasukNomor}
                  onChangeText={setFormMasukNomor}
                  placeholder="Nomor surat yang tertera pada dokumen fisik"
                  placeholderTextColor={colors.neutral.textMuted}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Tgl Surat *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formMasukTanggalSurat}
                    onChangeText={setFormMasukTanggalSurat}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.neutral.textMuted}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Tgl Diterima *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formMasukTanggalDiterima}
                    onChangeText={setFormMasukTanggalDiterima}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.neutral.textMuted}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Instansi / Nama Pengirim *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formMasukPengirim}
                  onChangeText={setFormMasukPengirim}
                  placeholder="Contoh: Balai Diklat Keagamaan Semarang"
                  placeholderTextColor={colors.neutral.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Perihal Surat *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formMasukPerihal}
                  onChangeText={setFormMasukPerihal}
                  placeholder="Contoh: Undangan Pelatihan Kurikulum Merdeka"
                  placeholderTextColor={colors.neutral.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Kategori Surat</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {["Edaran", "Undangan", "Instruksi", "Pemberitahuan", "Pengumuman", "Kerjasama", "Laporan"].map((k) => (
                    <Pressable
                      key={k}
                      style={({ pressed }) => [
                        styles.smallChip,
                        formMasukKategori === k && styles.smallChipActive,
                        pressed && styles.pressedState,
                      ]}
                      onPress={() => setFormMasukKategori(k)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: formMasukKategori === k }}
                    >
                      <Text style={[styles.smallChipText, formMasukKategori === k && styles.smallChipTextActive]}>
                        {k}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Sifat Surat</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["biasa", "penting", "rahasia"] as const).map((s) => (
                    <Pressable
                      key={s}
                      style={({ pressed }) => [
                        styles.sifatBtn,
                        formMasukSifat === s && styles.sifatBtnActive,
                        pressed && styles.pressedState,
                      ]}
                      onPress={() => setFormMasukSifat(s)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: formMasukSifat === s }}
                    >
                      <Text style={[styles.sifatBtnText, formMasukSifat === s && styles.sifatBtnTextActive]}>
                        {s.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Keterangan / Disposisi Tindak Lanjut</Text>
                <TextInput
                  style={[styles.textInput, { height: 60 }]}
                  value={formMasukKeterangan}
                  onChangeText={setFormMasukKeterangan}
                  placeholder="Catatan disposisi Kepala MTs atau tindak lanjut..."
                  placeholderTextColor={colors.neutral.textMuted}
                  multiline
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Scan Berkas Lampiran (PDF / Gambar)</Text>
                <Pressable
                  style={({ pressed }) => [styles.uploadDocBtn, pressed && styles.pressedState]}
                  onPress={() => pickDocument(setFormMasukLampiran)}
                  accessibilityRole="button"
                  accessibilityLabel="Pilih file lampiran surat masuk"
                >
                  <Ionicons name="document-attach-outline" size={18} color={colors.primary[700]} />
                  <Text style={styles.uploadDocBtnText} numberOfLines={1}>
                    {formMasukLampiran ? "Ganti File Lampiran" : "Pilih File Lampiran"}
                  </Text>
                </Pressable>
                {formMasukLampiran && (
                  <Text style={styles.uploadedFileUri} numberOfLines={1}>
                    ✓ Terpilih: {formMasukLampiran}
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                onPress={() => setModalMasukVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title={savingMasuk ? "Menyimpan..." : "Simpan Surat Masuk"}
                variant="primary"
                size="md"
                onPress={handleSaveMasuk}
                loading={savingMasuk}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 4: GENERATOR SURAT KETERANGAN SISWA AKTIF ================= */}
      <Modal visible={modalKeteranganVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "90%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Cetak Surat Keterangan Siswa</Text>
                <Text style={styles.modalSubtitle}>
                  Otomatis teregistrasi ke Buku Agenda Surat Keluar & Cetak PDF Resmi
                </Text>
              </View>
              <Pressable
                onPress={() => setModalKeteranganVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog surat keterangan"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Step 1: Pilih Siswa */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>1. Pilih Siswa Aktif *</Text>
                <View style={styles.searchCandidateBox}>
                  <Ionicons name="search" size={16} color={colors.neutral.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchStudentTerm}
                    onChangeText={setSearchStudentTerm}
                    placeholder="Ketik nama siswa atau NIS..."
                    placeholderTextColor={colors.neutral.textMuted}
                  />
                </View>

                {selectedStudent ? (
                  <View style={styles.selectedStudentCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectedStudentName}>
                        {selectedStudent.nama_lengkap}
                      </Text>
                      <Text style={styles.selectedStudentMeta}>
                        NIS: {selectedStudent.nis || "-"} • NISN: {selectedStudent.nisn || "-"}
                      </Text>
                      <Text style={styles.selectedStudentRombel}>
                        {selectedStudentRombel ? `Kelas ${selectedStudentRombel.nama} (Tingkat ${selectedStudentRombel.tingkat})` : "Memuat rombel..."}
                        {selectedStudentWali ? ` • Wali: ${selectedStudentWali}` : ""}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setSelectedStudent(null)}
                      style={{ padding: 4 }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Batalkan pilihan siswa"
                    >
                      <Ionicons name="close-circle" size={20} color={colors.status.cancelled} />
                    </Pressable>
                  </View>
                ) : (
                  <ScrollView style={styles.studentPickScroll} nestedScrollEnabled>
                    {filteredCandidateStudents.slice(0, 15).map((st) => (
                      <Pressable
                        key={st.id}
                        style={({ pressed }) => [
                          styles.studentPickItem,
                          pressed && styles.pressedState,
                        ]}
                        onPress={() => handleSelectStudentForKeterangan(st)}
                        accessibilityRole="button"
                        accessibilityLabel={`Pilih siswa ${st.nama_lengkap}`}
                      >
                        <Ionicons name="person-circle-outline" size={20} color={colors.primary[700]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.studentPickName}>{st.nama_lengkap}</Text>
                          <Text style={styles.studentPickSub}>
                            NIS: {st.nis || "-"} • JK: {st.jenis_kelamin}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.neutral.textMuted} />
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Step 2: Keperluan Surat */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>2. Keperluan Pembuatan Surat *</Text>
                <TextInput
                  style={[styles.textInput, { height: 60 }]}
                  value={keperluanText}
                  onChangeText={setKeperluanText}
                  placeholder="Contoh: Persyaratan Pengajuan Program Indonesia Pintar (PIP / KIP)..."
                  placeholderTextColor={colors.neutral.textMuted}
                  multiline
                />

                <Text style={[styles.fieldLabel, { marginTop: 8, fontSize: 11 }]}>
                  Template Keperluan Cepat:
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {[
                    "Persyaratan Pengajuan PIP / KIP",
                    "Pendaftaran Beasiswa Pendidikan",
                    "Pembukaan Rekening Tabungan SimPel Bank",
                    "Persyaratan Mengikuti Kompetisi Sains",
                    "Kelengkapan Berkas Mutasi",
                  ].map((tpl) => (
                    <Pressable
                      key={tpl}
                      style={({ pressed }) => [
                        styles.smallChip,
                        keperluanText === tpl && styles.smallChipActive,
                        pressed && styles.pressedState,
                      ]}
                      onPress={() => setKeperluanText(tpl)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: keperluanText === tpl }}
                    >
                      <Text style={[styles.smallChipText, keperluanText === tpl && styles.smallChipTextActive]}>
                        {tpl}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Step 3: Info Kop & Tahun Ajaran */}
              <View style={styles.summaryNoticeBox}>
                <Ionicons name="information-circle" size={16} color={colors.primary[700]} />
                <Text style={styles.summaryNoticeText}>
                  Surat akan diterbitkan atas nama Kepala MTs Roudhotut Thowalib untuk Tahun Ajaran{" "}
                  <Text style={{ fontWeight: "700" }}>{activeTaNama || "2026/2027"}</Text> Semester{" "}
                  <Text style={{ fontWeight: "700" }}>{activeTaSemester || "Ganjil"}</Text> dan
                  mendapatkan nomor agenda surat keluar baru.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                onPress={() => setModalKeteranganVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title={generatingKeterangan ? "Memproses PDF..." : "Cetak & Registrasi"}
                variant="primary"
                size="md"
                onPress={handleGenerateAndSaveSuratKeterangan}
                loading={generatingKeterangan}
                disabled={!selectedStudent || !keperluanText.trim()}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 5: DETAIL RINCIAN SURAT ================= */}
      <Modal visible={modalDetailVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedDetailKeluar ? "Detail Surat Keluar" : "Detail Surat Masuk"}
                </Text>
                <Text style={styles.modalSubtitle}>Informasi lengkap arsip persuratan</Text>
              </View>
              <Pressable
                onPress={() => setModalDetailVisible(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedState]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup rincian surat"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedDetailKeluar && (
                <View style={styles.detailBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Nomor Agenda:</Text>
                    <Text style={[styles.detailVal, { color: colors.accent.gold, fontWeight: "900" }]}>
                      #{selectedDetailKeluar.nomor_urut} (Tahun {selectedDetailKeluar.tahun})
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Nomor Surat:</Text>
                    <Text style={[styles.detailVal, { fontWeight: "700" }]}>
                      {selectedDetailKeluar.nomor_surat}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status Surat:</Text>
                    <Badge
                      label={selectedDetailKeluar.status.toUpperCase()}
                      variant={selectedDetailKeluar.status === "aktif" ? "active" : "cancelled"}
                      size="sm"
                    />
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tanggal Surat:</Text>
                    <Text style={styles.detailVal}>{selectedDetailKeluar.tanggal_surat}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tujuan:</Text>
                    <Text style={styles.detailVal}>{selectedDetailKeluar.tujuan}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Perihal:</Text>
                    <Text style={[styles.detailVal, { fontWeight: "700" }]}>
                      {selectedDetailKeluar.perihal}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Kategori / Sifat:</Text>
                    <Text style={styles.detailVal}>
                      {selectedDetailKeluar.kategori || "-"} / {selectedDetailKeluar.sifat.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Keterangan:</Text>
                    <Text style={styles.detailVal}>
                      {selectedDetailKeluar.keterangan || "Tidak ada catatan"}
                    </Text>
                  </View>

                  {selectedDetailKeluar.status === "dibatalkan" && (
                    <View style={styles.batalBox}>
                      <Text style={styles.batalTitle}>Surat Telah Dibatalkan</Text>
                      <Text style={styles.batalReason}>
                        Alasan: {selectedDetailKeluar.alasan_batal}
                      </Text>
                    </View>
                  )}

                  {selectedDetailKeluar.lampiran_local_path && (
                    <View style={styles.attachmentBox}>
                      <Ionicons name="document-text" size={18} color={colors.primary[700]} />
                      <Text style={styles.attachmentUriText} numberOfLines={1}>
                        {selectedDetailKeluar.lampiran_local_path}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {selectedDetailMasuk && (
                <View style={styles.detailBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Nomor Surat Asal:</Text>
                    <Text style={[styles.detailVal, { fontWeight: "700" }]}>
                      {selectedDetailMasuk.nomor_surat}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Instansi Pengirim:</Text>
                    <Text style={[styles.detailVal, { fontWeight: "700" }]}>
                      {selectedDetailMasuk.pengirim}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tgl Surat / Diterima:</Text>
                    <Text style={styles.detailVal}>
                      {selectedDetailMasuk.tanggal_surat} (Diterima: {selectedDetailMasuk.tanggal_diterima})
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Perihal:</Text>
                    <Text style={[styles.detailVal, { fontWeight: "700" }]}>
                      {selectedDetailMasuk.perihal}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Kategori / Sifat:</Text>
                    <Text style={styles.detailVal}>
                      {selectedDetailMasuk.kategori || "-"} / {selectedDetailMasuk.sifat.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Keterangan / Disposisi:</Text>
                    <Text style={styles.detailVal}>
                      {selectedDetailMasuk.keterangan || "Tidak ada catatan"}
                    </Text>
                  </View>

                  {selectedDetailMasuk.lampiran_local_path && (
                    <View style={styles.attachmentBox}>
                      <Ionicons name="document-text" size={18} color={colors.primary[700]} />
                      <Text style={styles.attachmentUriText} numberOfLines={1}>
                        {selectedDetailMasuk.lampiran_local_path}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={{ marginTop: 14 }}>
              <ModernButton
                title="Tutup"
                variant="outline"
                size="md"
                onPress={() => setModalDetailVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
      {/* FAB Tambah Surat (Mobile only < 768px, Bagian 3 & 14) */}
      <FAB
        onPress={() => (tab === "keluar" ? openCreateKeluarModal() : openCreateMasukModal())}
        accessibilityLabel={tab === "keluar" ? "Catat Surat Keluar" : "Catat Surat Masuk"}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  flatList: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  headerContainer: {
    marginBottom: spacing.xs,
  },
  forbiddenContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    marginTop: 60,
  },
  forbiddenTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.status.conflict,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
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
    paddingVertical: spacing.sm + 1,
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
  statsCard: {
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: colors.neutral.border,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.neutral.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.neutral.textMuted,
    fontWeight: "600",
    marginTop: 2,
    textTransform: "uppercase",
  },
  ruleNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    borderCurve: "continuous",
    marginBottom: spacing.md,
  },
  ruleNoticeText: {
    fontSize: 11,
    color: colors.primary[900],
    flex: 1,
    lineHeight: 16,
  },
  actionTopRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm + 2,
  },
  magicPdfButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.accent.goldLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent.goldBorder,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  magicPdfButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent.gold,
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
    borderRadius: radius.full,
    borderCurve: "continuous",
    paddingHorizontal: spacing.md,
    height: 42,
    ...shadows.soft,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.neutral.textPrimary,
  },
  filterSection: {
    marginBottom: spacing.sm + 2,
  },
  chipsScroll: {
    flexDirection: "row",
    gap: 6,
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: spacing.sm + 3,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderCurve: "continuous",
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
  itemSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.neutral.borderSubtle,
    marginHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    padding: spacing.md,
    overflow: "hidden",
  },
  cardBatal: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  noCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  agendaNumberBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderCurve: "continuous",
    backgroundColor: colors.accent.goldLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent.goldBorder,
  },
  agendaNumberText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accent.gold,
  },
  nomorSurat: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
  },
  tglSuratText: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 1,
  },
  perihalText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 11,
    color: colors.neutral.textSecondary,
    flex: 1,
  },
  kategoriRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  attachmentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary[50],
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderCurve: "continuous",
  },
  attachmentPillText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.primary[700],
  },
  batalBox: {
    backgroundColor: "#FEE2E2",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FCA5A5",
    padding: spacing.sm,
    borderRadius: radius.md,
    borderCurve: "continuous",
    marginTop: 4,
    marginBottom: 6,
  },
  batalTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.status.cancelled,
  },
  batalReason: {
    fontSize: 11,
    color: colors.status.cancelled,
    fontStyle: "italic",
    marginTop: 2,
  },
  cardActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.borderSubtle,
    paddingTop: spacing.sm,
    marginTop: 4,
  },
  detailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary[700],
  },
  batalActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.status.cancelledBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderCurve: "continuous",
  },
  batalActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.status.cancelled,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.status.cancelled,
  },
  pressedState: {
    opacity: 0.7,
  },
  emptyCard: {
    alignItems: "center",
    padding: spacing.xxl,
    gap: 6,
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
  agendaBanner: {
    backgroundColor: colors.accent.goldLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent.goldBorder,
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.sm + 2,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  agendaBannerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.accent.gold,
    letterSpacing: 0.5,
  },
  agendaBannerNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.accent.gold,
    marginVertical: 1,
  },
  agendaBannerSub: {
    fontSize: 11,
    color: colors.neutral.textSecondary,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    color: colors.neutral.textPrimary,
    backgroundColor: colors.neutral.canvas,
  },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderCurve: "continuous",
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  smallChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  smallChipText: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    fontWeight: "600",
  },
  smallChipTextActive: {
    color: colors.primary[700],
    fontWeight: "700",
  },
  sifatBtn: {
    flex: 1,
    paddingVertical: 7,
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
    paddingVertical: spacing.sm,
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
  uploadedFileUri: {
    fontSize: 10,
    color: colors.primary[700],
    marginTop: 4,
    fontStyle: "italic",
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm + 2,
    marginTop: spacing.md + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
    paddingTop: spacing.md,
  },
  // Batal Modal Specific
  batalAlertCard: {
    backgroundColor: "#FEE2E2",
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FECACA",
  },
  batalAlertTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.status.cancelled,
  },
  batalAlertSub: {
    fontSize: 11,
    color: colors.neutral.textPrimary,
    fontWeight: "600",
  },
  batalAlertPerihal: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    fontStyle: "italic",
    marginTop: 2,
  },
  // Surat Keterangan Modal Specific
  searchCandidateBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.canvas,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    gap: 6,
    marginBottom: 6,
  },
  selectedStudentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[300],
    padding: spacing.sm + 2,
  },
  selectedStudentName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary[900],
  },
  selectedStudentMeta: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 1,
  },
  selectedStudentRombel: {
    fontSize: 11,
    color: colors.primary[700],
    fontWeight: "600",
    marginTop: 2,
  },
  studentPickScroll: {
    maxHeight: 140,
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
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.borderSubtle,
  },
  studentPickName: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  studentPickSub: {
    fontSize: 10,
    color: colors.neutral.textMuted,
  },
  summaryNoticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.sm,
    marginTop: 6,
    marginBottom: spacing.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
  },
  summaryNoticeText: {
    flex: 1,
    fontSize: 11,
    color: colors.primary[900],
    lineHeight: 15,
  },
  // Detail Modal
  detailBody: {
    gap: spacing.sm,
  },
  detailRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.borderSubtle,
    paddingBottom: 6,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.neutral.textMuted,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  detailVal: {
    fontSize: 13,
    color: colors.neutral.textPrimary,
  },
  attachmentBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
    marginTop: 6,
  },
  attachmentUriText: {
    fontSize: 11,
    color: colors.primary[800],
    flex: 1,
  },
});
