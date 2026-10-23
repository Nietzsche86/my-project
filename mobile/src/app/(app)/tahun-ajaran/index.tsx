import React, { useEffect, useState, useCallback } from "react";
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
  Keyboard,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from "react-native";
import { colors, radius, shadows, spacing } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { useSync } from "../../../context/SyncContext";
import { AppShell } from "../../../components/layout/AppShell";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { Badge } from "../../../components/ui/Badge";
import { FAB, useToast } from "../../../components/ui";
import { db } from "../../../db/client";
import {
  tahunAjaran,
  kelas,
  pengampuKelas,
  anggotaKelas,
  suratMasuk,
  suratKeluar,
  type TahunAjaran,
} from "../../../db/schema";
import { desc, isNull, eq, and } from "drizzle-orm";
import { Ionicons } from "@expo/vector-icons";
import { generateUUID, getIsoUtcString } from "../../../db/crypto";

// Struktur kelompok tahun ajaran dengan 2 semester langsung
interface TahunAjaranGroup {
  nama: string; // misal '2026/2027'
  semester1: TahunAjaran | null; // Ganjil
  semester2: TahunAjaran | null; // Genap
  activeSemesterNum: 1 | 2 | null;
  isActive: boolean;
}

export default function TahunAjaranScreen() {
  const { role } = useAuth();
  const { refreshPendingCountAsync } = useSync();
  const { showToast } = useToast();

  const [rawList, setRawList] = useState<TahunAjaran[]>([]);
  const [groupedList, setGroupedList] = useState<TahunAjaranGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Pilihan semester aktif per tahun ajaran di layar utama (Active Hover / Selected state)
  const [selectedSemPerYear, setSelectedSemPerYear] = useState<Record<string, 1 | 2>>({});
  // Hover state di web untuk interaktivitas hover
  const [hoveredSemKey, setHoveredSemKey] = useState<string | null>(null);

  // State Modal Tambah / Edit Tahun Ajaran (2 Semester langsung)
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);

  // Form Fields
  const [formNamaTa, setFormNamaTa] = useState("2027/2028");
  const [formSem1Mulai, setFormSem1Mulai] = useState("2027-07-15");
  const [formSem1Selesai, setFormSem1Selesai] = useState("2027-12-20");
  const [formSem2Mulai, setFormSem2Mulai] = useState("2028-01-05");
  const [formSem2Selesai, setFormSem2Selesai] = useState("2028-06-25");
  const [formSelectedInitialSem, setFormSelectedInitialSem] = useState<1 | 2>(1);
  const [formIsActivePeriod, setFormIsActivePeriod] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const onShow = (e: any) => {
      setKeyboardHeight(e.endCoordinates.height);
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      onShow
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      onHide
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const isOperator = role === "super_admin" || role === "staf_tu";

  useEffect(() => {
    loadData();
  }, []);

  // Helper parsing tahun untuk rekomendasi tanggal otomatis
  const parseYearsFromName = (nameStr: string) => {
    const match = nameStr.match(/(\d{4})\s*[\/\-]\s*(\d{4})/);
    if (match) {
      return { y1: parseInt(match[1], 10), y2: parseInt(match[2], 10) };
    }
    const single = nameStr.match(/(\d{4})/);
    if (single) {
      const y1 = parseInt(single[1], 10);
      return { y1, y2: y1 + 1 };
    }
    const curr = new Date().getFullYear();
    return { y1: curr, y2: curr + 1 };
  };

  // Muat dan otomatis pastikan setiap tahun ajaran memiliki 2 semester langsung
  const loadData = async () => {
    try {
      const records = await db
        .select()
        .from(tahunAjaran)
        .where(isNull(tahunAjaran.deleted_at))
        .orderBy(desc(tahunAjaran.nama), tahunAjaran.semester);

      setRawList(records);

      // Kelompokkan berdasarkan nama tahun ajaran
      const groupsMap = new Map<string, { sem1: TahunAjaran | null; sem2: TahunAjaran | null }>();

      for (const item of records) {
        const entry = groupsMap.get(item.nama) || { sem1: null, sem2: null };
        if (item.semester === 1) {
          entry.sem1 = item;
        } else if (item.semester === 2) {
          entry.sem2 = item;
        }
        groupsMap.set(item.nama, entry);
      }

      // Pastikan otomatis tiap tahun ajaran menjadi 2 semester langsung
      let missingInserted = false;
      const now = getIsoUtcString();

      for (const [taNama, entry] of groupsMap.entries()) {
        const { y1, y2 } = parseYearsFromName(taNama);

        // Jika Semester 1 belum ada, buat otomatis
        if (!entry.sem1) {
          const newId1 = generateUUID();
          await db.insert(tahunAjaran).values({
            id: newId1,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            sync_status: "pending_push",
            last_synced_at: null,
            version: 1,
            nama: taNama,
            semester: 1,
            nama_semester: "Ganjil",
            tanggal_mulai: `${y1}-07-15`,
            tanggal_selesai: `${y1}-12-20`,
            is_active: 0,
          });
          missingInserted = true;
        }

        // Jika Semester 2 belum ada, buat otomatis
        if (!entry.sem2) {
          const newId2 = generateUUID();
          await db.insert(tahunAjaran).values({
            id: newId2,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            sync_status: "pending_push",
            last_synced_at: null,
            version: 1,
            nama: taNama,
            semester: 2,
            nama_semester: "Genap",
            tanggal_mulai: `${y2}-01-05`,
            tanggal_selesai: `${y2}-06-25`,
            is_active: 0,
          });
          missingInserted = true;
        }
      }

      // Jika ada data semester pelengkap yang dibuat otomatis, muat ulang
      let finalRecords = records;
      if (missingInserted) {
        finalRecords = await db
          .select()
          .from(tahunAjaran)
          .where(isNull(tahunAjaran.deleted_at))
          .orderBy(desc(tahunAjaran.nama), tahunAjaran.semester);
        setRawList(finalRecords);
      }

      // Susun list kelompok tahun ajaran dengan 2 semester langsung
      const newGroupsMap = new Map<string, { sem1: TahunAjaran | null; sem2: TahunAjaran | null }>();
      for (const item of finalRecords) {
        const entry = newGroupsMap.get(item.nama) || { sem1: null, sem2: null };
        if (item.semester === 1) entry.sem1 = item;
        if (item.semester === 2) entry.sem2 = item;
        newGroupsMap.set(item.nama, entry);
      }

      const groups: TahunAjaranGroup[] = [];
      const initSelected: Record<string, 1 | 2> = {};

      for (const [nama, entry] of newGroupsMap.entries()) {
        const isSem1Active = entry.sem1?.is_active === 1;
        const isSem2Active = entry.sem2?.is_active === 1;
        const activeSemesterNum = isSem1Active ? 1 : isSem2Active ? 2 : null;

        groups.push({
          nama,
          semester1: entry.sem1,
          semester2: entry.sem2,
          activeSemesterNum,
          isActive: isSem1Active || isSem2Active,
        });

        // Default pemilihan tiap semester: jika aktif di DB pilih yang aktif, jika tidak default ke 1
        initSelected[nama] = activeSemesterNum || 1;
      }

      setGroupedList(groups);
      setSelectedSemPerYear((prev) => ({ ...initSelected, ...prev }));
    } catch (e) {
      console.warn("Gagal membaca tahun ajaran:", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Buka Modal Tambah Tahun Ajaran Baru (Otomatis 2 Semester Langsung)
  const openAddModal = () => {
    setIsEditing(false);
    setEditingGroupName(null);

    // Cari usulan tahun ajaran berikutnya
    let nextY1 = 2027;
    let nextY2 = 2028;
    if (groupedList.length > 0) {
      const topName = groupedList[0].nama;
      const parsed = parseYearsFromName(topName);
      nextY1 = parsed.y2;
      nextY2 = nextY1 + 1;
    }

    const proposedName = `${nextY1}/${nextY2}`;
    setFormNamaTa(proposedName);
    setFormSem1Mulai(`${nextY1}-07-15`);
    setFormSem1Selesai(`${nextY1}-12-20`);
    setFormSem2Mulai(`${nextY2}-01-05`);
    setFormSem2Selesai(`${nextY2}-06-25`);
    setFormSelectedInitialSem(1);
    setFormIsActivePeriod(false);
    setModalVisible(true);
  };

  // Buka Modal Edit Tahun Ajaran (Keduanya diedit serentak)
  const openEditModal = (group: TahunAjaranGroup) => {
    setIsEditing(true);
    setEditingGroupName(group.nama);

    setFormNamaTa(group.nama);
    setFormSem1Mulai(group.semester1?.tanggal_mulai || "2026-07-15");
    setFormSem1Selesai(group.semester1?.tanggal_selesai || "2026-12-20");
    setFormSem2Mulai(group.semester2?.tanggal_mulai || "2027-01-05");
    setFormSem2Selesai(group.semester2?.tanggal_selesai || "2027-06-25");
    setFormSelectedInitialSem(group.activeSemesterNum || 1);
    setFormIsActivePeriod(group.isActive);
    setModalVisible(true);
  };

  // Saat nama tahun ajaran diketik, sesuaikan usulan tanggal semester secara cerdas
  const handleNamaTaChange = (text: string) => {
    setFormNamaTa(text);
    if (!isEditing) {
      const { y1, y2 } = parseYearsFromName(text);
      if (y1 >= 2000 && y2 >= 2000) {
        setFormSem1Mulai(`${y1}-07-15`);
        setFormSem1Selesai(`${y1}-12-20`);
        setFormSem2Mulai(`${y2}-01-05`);
        setFormSem2Selesai(`${y2}-06-25`);
      }
    }
  };

  // Simpan Tambah / Edit Tahun Ajaran (2 Semester Langsung)
  const handleSaveForm = async () => {
    const cleanNama = formNamaTa.trim();
    if (!cleanNama) {
      Alert.alert("Form Belum Lengkap", "Silakan masukkan nama Tahun Ajaran (misal 2026/2027).");
      return;
    }
    if (!formSem1Mulai.trim() || !formSem1Selesai.trim() || !formSem2Mulai.trim() || !formSem2Selesai.trim()) {
      Alert.alert("Form Belum Lengkap", "Mohon isi tanggal mulai dan tanggal selesai untuk kedua semester.");
      return;
    }

    setSaving(true);
    const now = getIsoUtcString();

    try {
      if (isEditing && editingGroupName) {
        // Mode Edit: Perbarui data nama dan rentang tanggal kedua semester
        const targetGroup = groupedList.find((g) => g.nama === editingGroupName);
        if (!targetGroup) throw new Error("Data tahun ajaran tidak ditemukan.");

        // Jika diaktifkan, nonaktifkan periode lain
        if (formIsActivePeriod) {
          await db
            .update(tahunAjaran)
            .set({ is_active: 0, updated_at: now, sync_status: "pending_push" });
        }

        // 1. Update Semester 1
        if (targetGroup.semester1) {
          await db
            .update(tahunAjaran)
            .set({
              nama: cleanNama,
              tanggal_mulai: formSem1Mulai.trim(),
              tanggal_selesai: formSem1Selesai.trim(),
              is_active: formIsActivePeriod && formSelectedInitialSem === 1 ? 1 : 0,
              updated_at: now,
              sync_status: "pending_push",
              version: targetGroup.semester1.version + 1,
            })
            .where(eq(tahunAjaran.id, targetGroup.semester1.id));
        }

        // 2. Update Semester 2
        if (targetGroup.semester2) {
          await db
            .update(tahunAjaran)
            .set({
              nama: cleanNama,
              tanggal_mulai: formSem2Mulai.trim(),
              tanggal_selesai: formSem2Selesai.trim(),
              is_active: formIsActivePeriod && formSelectedInitialSem === 2 ? 1 : 0,
              updated_at: now,
              sync_status: "pending_push",
              version: targetGroup.semester2.version + 1,
            })
            .where(eq(tahunAjaran.id, targetGroup.semester2.id));
        }

        showToast("Perubahan Tahun Ajaran (2 Semester) berhasil disimpan!");
      } else {
        // Mode Tambah Baru: Buat OTOMATIS 2 Semester Langsung
        // Validasi keunikan nama
        const existing = await db
          .select()
          .from(tahunAjaran)
          .where(and(eq(tahunAjaran.nama, cleanNama), isNull(tahunAjaran.deleted_at)));

        if (existing.length > 0) {
          Alert.alert("Tahun Ajaran Sudah Ada", `Tahun ajaran ${cleanNama} sudah terdaftar.`);
          setSaving(false);
          return;
        }

        // Jika dijadikan periode aktif, nonaktifkan yang lain
        if (formIsActivePeriod) {
          await db
            .update(tahunAjaran)
            .set({ is_active: 0, updated_at: now, sync_status: "pending_push" });
        }

        const idSem1 = generateUUID();
        const idSem2 = generateUUID();

        // 1. Insert Semester 1 (Ganjil)
        await db.insert(tahunAjaran).values({
          id: idSem1,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "pending_push",
          last_synced_at: null,
          version: 1,
          nama: cleanNama,
          semester: 1,
          nama_semester: "Ganjil",
          tanggal_mulai: formSem1Mulai.trim(),
          tanggal_selesai: formSem1Selesai.trim(),
          is_active: formIsActivePeriod && formSelectedInitialSem === 1 ? 1 : 0,
        });

        // 2. Insert Semester 2 (Genap)
        await db.insert(tahunAjaran).values({
          id: idSem2,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "pending_push",
          last_synced_at: null,
          version: 1,
          nama: cleanNama,
          semester: 2,
          nama_semester: "Genap",
          tanggal_mulai: formSem2Mulai.trim(),
          tanggal_selesai: formSem2Selesai.trim(),
          is_active: formIsActivePeriod && formSelectedInitialSem === 2 ? 1 : 0,
        });

        showToast(`Tahun Ajaran ${cleanNama} dengan 2 Semester langsung berhasil dibuat!`);
      }

      await refreshPendingCountAsync();
      setModalVisible(false);
      await loadData();
    } catch (e: any) {
      Alert.alert("Gagal Menyimpan", e?.message || "Terjadi kendala saat menyimpan database");
    } finally {
      setSaving(false);
    }
  };

  // Simpan Pemilihan Semester Aktif (Metode Active Hover lalu Klik Simpan)
  const handleSaveActiveSemester = async (group: TahunAjaranGroup, chosenSemNum: 1 | 2) => {
    const targetTa = chosenSemNum === 1 ? group.semester1 : group.semester2;
    if (!targetTa) {
      Alert.alert("Data Tidak Lengkap", "Semester terpilih tidak ditemukan.");
      return;
    }

    setActivatingId(targetTa.id);
    const now = getIsoUtcString();

    try {
      // 1. Nonaktifkan semua periode tahun ajaran yang ada
      await db
        .update(tahunAjaran)
        .set({ is_active: 0, updated_at: now, sync_status: "pending_push" });

      // 2. Aktifkan semester terpilih
      await db
        .update(tahunAjaran)
        .set({
          is_active: 1,
          updated_at: now,
          sync_status: "pending_push",
          version: targetTa.version + 1,
        })
        .where(eq(tahunAjaran.id, targetTa.id));

      await refreshPendingCountAsync();
      showToast(
        `Berhasil menyimpan: ${group.nama} Semester ${chosenSemNum} (${chosenSemNum === 1 ? "Ganjil" : "Genap"}) kini AKTIF!`
      );
      await loadData();
    } catch (err: any) {
      Alert.alert("Gagal Mengaktifkan Semester", err?.message);
    } finally {
      setActivatingId(null);
    }
  };

  // Salin Rombel Antar Semester (Semester 1 Ganjil -> Semester 2 Genap)
  const handleCopyClassesFromSemester1 = async (group: TahunAjaranGroup) => {
    const sourceGanjil = group.semester1;
    const targetGenap = group.semester2;

    if (!sourceGanjil || !targetGenap) {
      Alert.alert("Peringatan", "Data Semester 1 atau Semester 2 tidak lengkap.");
      return;
    }

    Alert.alert(
      "Salin Rombel Antar Semester",
      `Apakah Anda ingin menyalin seluruh data rombel kelas, wali kelas, guru pengampu, dan penempatan siswa dari Semester 1 (Ganjil) ke Semester 2 (Genap) ${group.nama}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Salin Sekarang",
          onPress: async () => {
            try {
              const now = getIsoUtcString();

              // Ambil seluruh kelas di Semester 1
              const sourceClasses = await db
                .select()
                .from(kelas)
                .where(and(eq(kelas.tahun_ajaran_id, sourceGanjil.id), isNull(kelas.deleted_at)));

              if (sourceClasses.length === 0) {
                Alert.alert("Perhatian", "Belum ada rombel kelas di Semester 1 untuk disalin.");
                return;
              }

              let copiedClassCount = 0;
              let copiedStudentCount = 0;

              for (const sc of sourceClasses) {
                // Periksa apakah kelas sudah ada di Semester 2
                const existInTarget = await db
                  .select()
                  .from(kelas)
                  .where(
                    and(
                      eq(kelas.tahun_ajaran_id, targetGenap.id),
                      eq(kelas.nama, sc.nama),
                      isNull(kelas.deleted_at)
                    )
                  );

                let targetClassId = existInTarget[0]?.id;

                if (!targetClassId) {
                  targetClassId = generateUUID();
                  await db.insert(kelas).values({
                    id: targetClassId,
                    created_at: now,
                    updated_at: now,
                    deleted_at: null,
                    sync_status: "pending_push",
                    last_synced_at: null,
                    version: 1,
                    tahun_ajaran_id: targetGenap.id,
                    nama: sc.nama,
                    tingkat: sc.tingkat,
                    wali_kelas_id: sc.wali_kelas_id,
                  });
                  copiedClassCount++;
                }

                // Salin Pengampu Kelas
                const pengampuList = await db
                  .select()
                  .from(pengampuKelas)
                  .where(eq(pengampuKelas.kelas_id, sc.id));

                for (const pk of pengampuList) {
                  const existPk = await db
                    .select()
                    .from(pengampuKelas)
                    .where(
                      and(
                        eq(pengampuKelas.kelas_id, targetClassId),
                        eq(pengampuKelas.pegawai_id, pk.pegawai_id),
                        eq(pengampuKelas.mata_pelajaran_id, pk.mata_pelajaran_id)
                      )
                    );
                  if (existPk.length === 0) {
                    await db.insert(pengampuKelas).values({
                      id: generateUUID(),
                      created_at: now,
                      updated_at: now,
                      deleted_at: null,
                      sync_status: "pending_push",
                      last_synced_at: null,
                      version: 1,
                      kelas_id: targetClassId,
                      pegawai_id: pk.pegawai_id,
                      mata_pelajaran_id: pk.mata_pelajaran_id,
                    });
                  }
                }

                // Salin Anggota Siswa Kelas
                const studentMembers = await db
                  .select()
                  .from(anggotaKelas)
                  .where(
                    and(
                      eq(anggotaKelas.kelas_id, sc.id),
                      eq(anggotaKelas.tahun_ajaran_id, sourceGanjil.id)
                    )
                  );

                for (const sm of studentMembers) {
                  const existAk = await db
                    .select()
                    .from(anggotaKelas)
                    .where(
                      and(
                        eq(anggotaKelas.siswa_id, sm.siswa_id),
                        eq(anggotaKelas.tahun_ajaran_id, targetGenap.id)
                      )
                    );
                  if (existAk.length === 0) {
                    await db.insert(anggotaKelas).values({
                      id: generateUUID(),
                      created_at: now,
                      updated_at: now,
                      deleted_at: null,
                      sync_status: "pending_push",
                      last_synced_at: null,
                      version: 1,
                      siswa_id: sm.siswa_id,
                      kelas_id: targetClassId,
                      tahun_ajaran_id: targetGenap.id,
                    });
                    copiedStudentCount++;
                  }
                }
              }

              await refreshPendingCountAsync();
              Alert.alert(
                "Salin Rombel Berhasil!",
                `Berhasil menyalin ${copiedClassCount} rombel baru dan menempatkan ${copiedStudentCount} siswa ke Semester 2 Genap.`
              );
            } catch (err: any) {
              Alert.alert("Gagal Menyalin", err?.message);
            }
          },
        },
      ]
    );
  };

  // Hapus Tahun Ajaran (Menghapus kedua semester dalam tahun ajaran tersebut)
  const handleDeleteGroup = async (group: TahunAjaranGroup) => {
    const isSuperAdmin = role === "super_admin";

    if (!isSuperAdmin && group.isActive) {
      Alert.alert(
        "Peringatan",
        "Tahun ajaran ini memiliki semester yang sedang AKTIF. Silakan aktifkan tahun ajaran lain terlebih dahulu."
      );
      return;
    }

    try {
      const ids = [group.semester1?.id, group.semester2?.id].filter(Boolean) as string[];

      // Cek relasi kelas
      let totalClasses = 0;
      for (const id of ids) {
        const cList = await db
          .select()
          .from(kelas)
          .where(and(eq(kelas.tahun_ajaran_id, id), isNull(kelas.deleted_at)));
        totalClasses += cList.length;
      }

      if (!isSuperAdmin && totalClasses > 0) {
        Alert.alert(
          "Tidak Dapat Dihapus",
          `Tahun ajaran ini memiliki ${totalClasses} rombel kelas terkait. Hapus rombel terlebih dahulu.`
        );
        return;
      }

      // Cek relasi surat
      let totalSurat = 0;
      for (const id of ids) {
        const sm = await db
          .select()
          .from(suratMasuk)
          .where(and(eq(suratMasuk.tahun_ajaran_id, id), isNull(suratMasuk.deleted_at)));
        const sk = await db
          .select()
          .from(suratKeluar)
          .where(and(eq(suratKeluar.tahun_ajaran_id, id), isNull(suratKeluar.deleted_at)));
        totalSurat += sm.length + sk.length;
      }

      if (!isSuperAdmin && totalSurat > 0) {
        Alert.alert(
          "Tidak Dapat Dihapus",
          `Tahun ajaran ini memiliki ${totalSurat} data surat masuk/keluar terkait.`
        );
        return;
      }

      let warningMsg = `Hapus Tahun Ajaran ${group.nama} beserta 2 Semester (Ganjil & Genap)?`;
      if (isSuperAdmin && (group.isActive || totalClasses > 0 || totalSurat > 0)) {
        warningMsg = `[SUPER ADMIN PERHATIAN]\nTahun ajaran ${group.nama} memiliki:\n` +
          (group.isActive ? "• Semester aktif\n" : "") +
          (totalClasses > 0 ? `• ${totalClasses} rombel kelas terkait\n` : "") +
          (totalSurat > 0 ? `• ${totalSurat} data surat terkait\n` : "") +
          "Yakin ingin menghapus secara paksa?";
      }

      Alert.alert(
        isSuperAdmin ? "Hapus Tahun Ajaran (Super Admin)" : "Konfirmasi Hapus",
        warningMsg,
        [
          { text: "Batal", style: "cancel" },
          {
            text: isSuperAdmin ? "Ya, Hapus (Paksa)" : "Hapus",
            style: "destructive",
            onPress: async () => {
              const now = getIsoUtcString();

              for (const ta of [group.semester1, group.semester2]) {
                if (!ta) continue;

                await db
                  .update(tahunAjaran)
                  .set({
                    deleted_at: now,
                    updated_at: now,
                    is_active: 0,
                    sync_status: "pending_push",
                    version: ta.version + 1,
                  })
                  .where(eq(tahunAjaran.id, ta.id));

                if (isSuperAdmin) {
                  // Cascade soft-delete kelas
                  const classList = await db
                    .select()
                    .from(kelas)
                    .where(and(eq(kelas.tahun_ajaran_id, ta.id), isNull(kelas.deleted_at)));
                  for (const c of classList) {
                    await db
                      .update(kelas)
                      .set({ deleted_at: now, updated_at: now, sync_status: "pending_push" })
                      .where(eq(kelas.id, c.id));

                    await db
                      .update(anggotaKelas)
                      .set({ deleted_at: now, updated_at: now, sync_status: "pending_push" })
                      .where(eq(anggotaKelas.kelas_id, c.id));

                    await db
                      .update(pengampuKelas)
                      .set({ deleted_at: now, updated_at: now, sync_status: "pending_push" })
                      .where(eq(pengampuKelas.kelas_id, c.id));
                  }
                }
              }

              await refreshPendingCountAsync();
              showToast(`Tahun Ajaran ${group.nama} berhasil dihapus.`);
              await loadData();
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Gagal", e?.message);
    }
  };

  const renderHeader = () => (
    <View style={styles.topActionRow}>
      <View style={styles.noticeBox}>
        <Ionicons name="information-circle-outline" size={20} color={colors.primary[700]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>
            Sistem 2 Semester Otomatis Langsung
          </Text>
          <Text style={styles.noticeText}>
            Tiap tahun ajaran memiliki 2 Semester (Ganjil & Genap). Arahkan / klik semester (active hover), lalu klik Simpan untuk mengaktifkan.
          </Text>
        </View>
      </View>

      {isOperator && (
        <ModernButton
          title="Tambah Tahun Ajar"
          variant="primary"
          size="sm"
          icon={<Ionicons name="add-circle-outline" size={18} color={colors.neutral.white} />}
          onPress={openAddModal}
        />
      )}
    </View>
  );

  // Render Card Tiap Tahun Ajaran dengan 2 Semester Langsung & Metode Active Hover
  const renderYearGroupItem = useCallback(
    ({ item: group }: { item: TahunAjaranGroup }) => {
      const selectedSem = selectedSemPerYear[group.nama] || group.activeSemesterNum || 1;
      const currentActiveSem = group.activeSemesterNum;
      const isSelectedSemDifferent = selectedSem !== currentActiveSem;

      // Semester 1 & 2 objects
      const sem1 = group.semester1;
      const sem2 = group.semester2;

      const isSem1ActiveInDb = sem1?.is_active === 1;
      const isSem2ActiveInDb = sem2?.is_active === 1;

      const isSem1Selected = selectedSem === 1;
      const isSem2Selected = selectedSem === 2;

      const isHovered1 = hoveredSemKey === `${group.nama}-1`;
      const isHovered2 = hoveredSemKey === `${group.nama}-2`;

      const targetSelectedTa = selectedSem === 1 ? sem1 : sem2;
      const isActivatingThis = activatingId === targetSelectedTa?.id;

      return (
        <ModernCard
          key={group.nama}
          style={styles.card}
          variant={group.isActive ? "accent" : "flat"}
        >
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleCol}>
              <View style={styles.yearTitleRow}>
                <Ionicons
                  name="calendar"
                  size={20}
                  color={group.isActive ? colors.primary[700] : colors.neutral.textSecondary}
                />
                <Text style={styles.yearTitleText}>Tahun Ajaran {group.nama}</Text>
              </View>
              <Text style={styles.yearSubtext}>
                Mencakup 2 Semester langsung (Semester 1 & 2)
              </Text>
            </View>

            <Badge
              label={
                group.isActive
                  ? `AKTIF: S${group.activeSemesterNum} (${group.activeSemesterNum === 1 ? "Ganjil" : "Genap"})`
                  : "NONAKTIF"
              }
              variant={group.isActive ? "active" : "neutral"}
              size="sm"
            />
          </View>

          {/* PEMILIHAN TIAP SEMESTER DENGAN METODE ACTIVE HOOVER */}
          <View style={styles.semesterSection}>
            <View style={styles.semesterSectionHeader}>
              <Text style={styles.semesterSectionTitle}>Pilih Semester Sekolah</Text>
              <Text style={styles.semesterSectionHint}>
                Arahkan / klik salah satu semester untuk memilih (active hover), lalu klik Simpan:
              </Text>
            </View>

            <View style={styles.semesterGrid}>
              {/* Box Semester 1 (Ganjil) - Simple tanpa tanggal di dalam */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Pilih Semester 1 Ganjil Tahun Ajaran ${group.nama}`}
                accessibilityState={{ selected: isSem1Selected }}
                onPress={() => {
                  setSelectedSemPerYear((prev) => ({ ...prev, [group.nama]: 1 }));
                }}
                onHoverIn={() => setHoveredSemKey(`${group.nama}-1`)}
                onHoverOut={() => setHoveredSemKey(null)}
                style={({ pressed }) => [
                  styles.semesterCardBox,
                  isSem1Selected && styles.semesterCardBoxActive,
                  (isHovered1 || pressed) && styles.semesterCardBoxHover,
                ]}
              >
                <View style={styles.semesterBoxTop}>
                  <View style={styles.radioRow}>
                    <Ionicons
                      name={isSem1Selected ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={isSem1Selected ? colors.primary[700] : colors.neutral.textMuted}
                    />
                    <Text
                      style={[
                        styles.semesterBoxName,
                        isSem1Selected && styles.semesterBoxNameActive,
                      ]}
                    >
                      Semester 1 (Ganjil)
                    </Text>
                  </View>

                  {isSem1ActiveInDb ? (
                    <View style={styles.activeTag}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.accent.teal} />
                      <Text style={styles.activeTagText}>Aktif di DB</Text>
                    </View>
                  ) : isSem1Selected ? (
                    <View style={styles.chosenTag}>
                      <Text style={styles.chosenTagText}>Terpilih</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>

              {/* Box Semester 2 (Genap) - Simple tanpa tanggal di dalam */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Pilih Semester 2 Genap Tahun Ajaran ${group.nama}`}
                accessibilityState={{ selected: isSem2Selected }}
                onPress={() => {
                  setSelectedSemPerYear((prev) => ({ ...prev, [group.nama]: 2 }));
                }}
                onHoverIn={() => setHoveredSemKey(`${group.nama}-2`)}
                onHoverOut={() => setHoveredSemKey(null)}
                style={({ pressed }) => [
                  styles.semesterCardBox,
                  isSem2Selected && styles.semesterCardBoxActive,
                  (isHovered2 || pressed) && styles.semesterCardBoxHover,
                ]}
              >
                <View style={styles.semesterBoxTop}>
                  <View style={styles.radioRow}>
                    <Ionicons
                      name={isSem2Selected ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={isSem2Selected ? colors.primary[700] : colors.neutral.textMuted}
                    />
                    <Text
                      style={[
                        styles.semesterBoxName,
                        isSem2Selected && styles.semesterBoxNameActive,
                      ]}
                    >
                      Semester 2 (Genap)
                    </Text>
                  </View>

                  {isSem2ActiveInDb ? (
                    <View style={styles.activeTag}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.accent.teal} />
                      <Text style={styles.activeTagText}>Aktif di DB</Text>
                    </View>
                  ) : isSem2Selected ? (
                    <View style={styles.chosenTag}>
                      <Text style={styles.chosenTagText}>Terpilih</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            </View>

            {/* INFORMASI PERIODE TANGGAL DI BAWAH CARD PEMILIHAN SEMESTER */}
            <View style={styles.semesterInfoBar}>
              <View style={styles.infoRowItem}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={isSem1Selected ? colors.primary[700] : colors.neutral.textMuted}
                />
                <Text style={styles.infoText}>
                  <Text style={[styles.infoLabel, isSem1Selected && styles.infoLabelActive]}>
                    Semester 1 (Ganjil):
                  </Text>{" "}
                  {sem1?.tanggal_mulai || "-"} s.d. {sem1?.tanggal_selesai || "-"}
                </Text>
              </View>

              <View style={styles.infoRowItem}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={isSem2Selected ? colors.primary[700] : colors.neutral.textMuted}
                />
                <Text style={styles.infoText}>
                  <Text style={[styles.infoLabel, isSem2Selected && styles.infoLabelActive]}>
                    Semester 2 (Genap):
                  </Text>{" "}
                  {sem2?.tanggal_mulai || "-"} s.d. {sem2?.tanggal_selesai || "-"}
                </Text>
              </View>
            </View>

            {/* BAR TOMBOL SIMPAN HASIL PILIHAN ACTIVE HOOVER */}
            {isOperator && (
              <View style={styles.saveActionContainer}>
                {isSelectedSemDifferent ? (
                  <View style={styles.savePromptRow}>
                    <View style={styles.savePromptTextCol}>
                      <Text style={styles.savePromptTitle}>
                        Semester {selectedSem} ({selectedSem === 1 ? "Ganjil" : "Genap"}) Siap Disimpan
                      </Text>
                      <Text style={styles.savePromptDesc}>
                        Klik tombol Simpan untuk menjadikan periode ini aktif sekolah.
                      </Text>
                    </View>
                    <ModernButton
                      title={`Simpan Semester ${selectedSem}`}
                      variant="primary"
                      size="sm"
                      icon={<Ionicons name="save-outline" size={16} color={colors.neutral.white} />}
                      loading={isActivatingThis}
                      onPress={() => handleSaveActiveSemester(group, selectedSem)}
                    />
                  </View>
                ) : (
                  <View style={styles.alreadyActiveRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.accent.teal} />
                    <Text style={styles.alreadyActiveText}>
                      Semester {currentActiveSem} ({currentActiveSem === 1 ? "Ganjil" : "Genap"}) telah tersimpan sebagai periode aktif.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* OPSI OPERATOR LANJUTAN: SALIN ROMBEL, EDIT, HAPUS */}
          {isOperator && (
            <View style={styles.cardFooterActions}>
              {/* Salin Rombel dari Semester 1 ke Semester 2 */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Salin rombel dari Semester 1 ke Semester 2"
                onPress={() => handleCopyClassesFromSemester1(group)}
                style={({ pressed }) => [styles.footerBtnCopy, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Ionicons name="copy-outline" size={14} color={colors.primary[700]} />
                <Text style={styles.footerBtnCopyText}>Salin Rombel S1 ke S2</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${group.nama}`}
                onPress={() => openEditModal(group)}
                style={({ pressed }) => [styles.footerBtnEdit, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Ionicons name="create-outline" size={14} color={colors.neutral.textSecondary} />
                <Text style={styles.footerBtnEditText}>Edit Tanggal</Text>
              </Pressable>

              {!group.isActive && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Hapus Tahun Ajaran ${group.nama}`}
                  onPress={() => handleDeleteGroup(group)}
                  style={({ pressed }) => [styles.footerBtnDelete, pressed && { opacity: 0.7 }]}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={14} color={colors.status.conflict} />
                  <Text style={styles.footerBtnDeleteText}>Hapus</Text>
                </Pressable>
              )}
            </View>
          )}
        </ModernCard>
      );
    },
    [isOperator, selectedSemPerYear, hoveredSemKey, activatingId]
  );

  return (
    <AppShell
      title="Tahun Ajaran & Semester"
      showBack
      onAdd={isOperator ? openAddModal : undefined}
      addLabel="Tambah Periode"
    >
      <FlatList
        data={groupedList}
        keyExtractor={(item) => item.nama}
        renderItem={renderYearGroupItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[700]]}
            tintColor={colors.primary[700]}
          />
        }
      />

      {/* FAB Tambah Periode (Mobile only < 768px untuk Operator) */}
      {isOperator && (
        <FAB
          onPress={openAddModal}
          accessibilityLabel="Tambah Tahun Ajaran Baru (2 Semester Langsung)"
        />
      )}

      {/* MODAL FORM TAMBAH / EDIT TAHUN AJARAN (2 SEMESTER LANGSUNG) */}
      {/* Penanganan responsif keyboard dinamis agar tombol Simpan selalu muncul di atas keyboard */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View
          style={[
            styles.modalOverlay,
            keyboardHeight > 0 && {
              justifyContent: "flex-end",
              paddingBottom: Platform.OS === "ios" ? keyboardHeight + 10 : keyboardHeight + 8,
            },
          ]}
        >
          <TouchableWithoutFeedback
            onPress={() => {
              if (keyboardHeight > 0) {
                Keyboard.dismiss();
              } else {
                setModalVisible(false);
              }
            }}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View
            style={[
              styles.modalCard,
              keyboardHeight > 0 && {
                maxHeight: Math.max(
                  windowHeight - keyboardHeight - (Platform.OS === "ios" ? 70 : 50),
                  280
                ),
              },
            ]}
          >
            {/* Header Dialog */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {isEditing ? `Edit Tahun Ajaran ${formNamaTa}` : "Tambah Tahun Ajaran Baru"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Otomatis mencakup 2 Semester (Ganjil & Genap) langsung
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tutup dialog"
                hitSlop={10}
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={colors.neutral.textMuted} />
              </Pressable>
            </View>

            {/* Form Scrollable Content */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Input Nama Tahun Ajaran */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Nama Tahun Ajaran <Text style={styles.requiredMark}>*</Text>
                </Text>
                <TextInput
                  value={formNamaTa}
                  onChangeText={handleNamaTaChange}
                  placeholder="2027/2028"
                  placeholderTextColor={colors.neutral.textSubtle}
                  style={styles.input}
                  autoCapitalize="none"
                />
                <Text style={styles.inputHelper}>
                  Format umum: 2026/2027 atau 2027/2028
                </Text>
              </View>

              {/* Box Semester 1 (Ganjil) */}
              <View style={styles.semesterFormBox}>
                <View style={styles.semesterFormHeader}>
                  <View style={styles.semesterFormBadge}>
                    <Text style={styles.semesterFormBadgeText}>Semester 1 (Ganjil)</Text>
                  </View>
                  <Text style={styles.semesterFormDuration}>Juli - Desember</Text>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.subInputLabel}>Tanggal Mulai</Text>
                    <TextInput
                      value={formSem1Mulai}
                      onChangeText={setFormSem1Mulai}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.neutral.textSubtle}
                      style={styles.input}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.subInputLabel}>Tanggal Selesai</Text>
                    <TextInput
                      value={formSem1Selesai}
                      onChangeText={setFormSem1Selesai}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.neutral.textSubtle}
                      style={styles.input}
                    />
                  </View>
                </View>
              </View>

              {/* Box Semester 2 (Genap) */}
              <View style={styles.semesterFormBox}>
                <View style={styles.semesterFormHeader}>
                  <View style={[styles.semesterFormBadge, { backgroundColor: colors.accent.tealLight }]}>
                    <Text style={[styles.semesterFormBadgeText, { color: colors.accent.teal }]}>
                      Semester 2 (Genap)
                    </Text>
                  </View>
                  <Text style={styles.semesterFormDuration}>Januari - Juni</Text>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.subInputLabel}>Tanggal Mulai</Text>
                    <TextInput
                      value={formSem2Mulai}
                      onChangeText={setFormSem2Mulai}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.neutral.textSubtle}
                      style={styles.input}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.subInputLabel}>Tanggal Selesai</Text>
                    <TextInput
                      value={formSem2Selesai}
                      onChangeText={setFormSem2Selesai}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.neutral.textSubtle}
                      style={styles.input}
                    />
                  </View>
                </View>
              </View>

              {/* Pemilihan Semester Aktif Awal (Metode Active Hoover) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Pilih Semester Aktif Awal (Active Hover):
                </Text>
                <View style={styles.modalRadioGrid}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: formSelectedInitialSem === 1 }}
                    onPress={() => setFormSelectedInitialSem(1)}
                    style={({ pressed }) => [
                      styles.modalSemesterPill,
                      formSelectedInitialSem === 1 && styles.modalSemesterPillActive,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons
                      name={formSelectedInitialSem === 1 ? "radio-button-on" : "radio-button-off"}
                      size={16}
                      color={formSelectedInitialSem === 1 ? colors.primary[700] : colors.neutral.textMuted}
                    />
                    <Text
                      style={[
                        styles.modalSemesterPillText,
                        formSelectedInitialSem === 1 && styles.modalSemesterPillTextActive,
                      ]}
                    >
                      Semester 1 (Ganjil)
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: formSelectedInitialSem === 2 }}
                    onPress={() => setFormSelectedInitialSem(2)}
                    style={({ pressed }) => [
                      styles.modalSemesterPill,
                      formSelectedInitialSem === 2 && styles.modalSemesterPillActive,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons
                      name={formSelectedInitialSem === 2 ? "radio-button-on" : "radio-button-off"}
                      size={16}
                      color={formSelectedInitialSem === 2 ? colors.primary[700] : colors.neutral.textMuted}
                    />
                    <Text
                      style={[
                        styles.modalSemesterPillText,
                        formSelectedInitialSem === 2 && styles.modalSemesterPillTextActive,
                      ]}
                    >
                      Semester 2 (Genap)
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Checkbox Jadikan Periode Aktif Sekolah */}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: formIsActivePeriod }}
                onPress={() => setFormIsActivePeriod(!formIsActivePeriod)}
                style={({ pressed }) => [styles.activeCheckRow, pressed && { opacity: 0.8 }]}
              >
                <Ionicons
                  name={formIsActivePeriod ? "checkbox" : "square-outline"}
                  size={22}
                  color={formIsActivePeriod ? colors.primary[700] : colors.neutral.textMuted}
                />
                <Text style={styles.activeCheckText}>
                  Jadikan periode ini sebagai Tahun Ajaran Aktif Sekolah saat ini
                </Text>
              </Pressable>
            </ScrollView>

            {/* FOOTER TOMBOL DI BAWAH MODAL (Tetap Muncul & Tidak Terhalang Keyboard HP) */}
            <View style={styles.modalBtnRow}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                onPress={() => setModalVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title={isEditing ? "Simpan" : "Simpan (2 Semester)"}
                variant="primary"
                size="md"
                loading={saving}
                icon={<Ionicons name="checkmark" size={18} color={colors.neutral.white} />}
                onPress={handleSaveForm}
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
  listContent: {
    paddingBottom: 60,
  },
  topActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: spacing.md,
    flexWrap: "wrap",
  },
  noticeBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.primary[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
    padding: 12,
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary[900],
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 12,
    color: colors.primary[800],
    lineHeight: 17,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 8,
  },
  cardTitleCol: {
    flex: 1,
  },
  yearTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  yearTitleText: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
  },
  yearSubtext: {
    fontSize: 12,
    color: colors.neutral.textMuted,
  },
  semesterSection: {
    backgroundColor: colors.neutral.canvas,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    marginVertical: 4,
  },
  semesterSectionHeader: {
    marginBottom: 10,
  },
  semesterSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  semesterSectionHint: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  semesterGrid: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  semesterCardBox: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderCurve: "continuous",
    ...shadows.soft,
    justifyContent: "center",
  },
  semesterCardBoxActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[700],
    borderWidth: 2,
  },
  semesterCardBoxHover: {
    borderColor: colors.primary[400],
    backgroundColor: colors.primary[50],
  },
  semesterBoxTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  semesterBoxName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  semesterBoxNameActive: {
    fontWeight: "800",
    color: colors.primary[900],
  },
  activeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.accent.tealLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  activeTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.accent.teal,
  },
  chosenTag: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  chosenTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary[800],
  },
  semesterInfoBar: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
    flexDirection: "column",
    gap: 4,
  },
  infoRowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 11,
    color: colors.neutral.textSecondary,
  },
  infoLabel: {
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  infoLabelActive: {
    fontWeight: "700",
    color: colors.primary[800],
  },
  saveActionContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
  },
  savePromptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  savePromptTextCol: {
    flex: 1,
    minWidth: 160,
  },
  savePromptTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary[900],
  },
  savePromptDesc: {
    fontSize: 11,
    color: colors.neutral.textMuted,
  },
  alreadyActiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  alreadyActiveText: {
    fontSize: 12,
    color: colors.accent.teal,
    fontWeight: "600",
  },
  cardFooterActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
    flexWrap: "wrap",
  },
  footerBtnCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  footerBtnCopyText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary[700],
  },
  footerBtnEdit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.neutral.surfaceHover,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  footerBtnEditText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
  },
  footerBtnDelete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.status.conflictBg,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  footerBtnDeleteText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.status.conflict,
  },
  // MODAL STYLES (Keyboard avoiding & responsive)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    borderCurve: "continuous",
    padding: 20,
    width: "100%",
    maxWidth: 500,
    maxHeight: Platform.OS === "web" ? 720 : "88%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    ...shadows.raised,
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
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
  modalScrollView: {
    flexGrow: 0,
    flexShrink: 1,
    marginVertical: 4,
  },
  modalScrollContent: {
    paddingBottom: 10,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.neutral.textSecondary,
    marginBottom: 5,
  },
  subInputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral.textMuted,
    marginBottom: 4,
  },
  requiredMark: {
    color: colors.status.conflict,
  },
  inputHelper: {
    fontSize: 10,
    color: colors.neutral.textMuted,
    marginTop: 3,
  },
  input: {
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: colors.neutral.textPrimary,
  },
  semesterFormBox: {
    backgroundColor: colors.neutral.canvas,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    marginBottom: 12,
  },
  semesterFormHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  semesterFormBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  semesterFormBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary[800],
  },
  semesterFormDuration: {
    fontSize: 11,
    color: colors.neutral.textMuted,
  },
  modalRadioGrid: {
    flexDirection: "row",
    gap: 8,
  },
  modalSemesterPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.canvas,
  },
  modalSemesterPillActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[700],
  },
  modalSemesterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textMuted,
  },
  modalSemesterPillTextActive: {
    color: colors.primary[800],
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  activeCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 8,
  },
  activeCheckText: {
    fontSize: 12,
    color: colors.neutral.textPrimary,
    fontWeight: "600",
    flex: 1,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
  },
});
