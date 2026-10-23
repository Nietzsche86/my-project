import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, radii, shadows, spacing } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { useSync } from "../../../context/SyncContext";
import { useAlert } from "../../../context/AlertContext";
import { AppShell } from "../../../components/layout/AppShell";
import {
  ModernCard,
  ModernButton,
  StickyFooterButton,
  useToast,
} from "../../../components/ui";
import { db } from "../../../db/client";
import { siswa, waliSiswa, type Siswa, type WaliSiswa } from "../../../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  generateUUID,
  getIsoUtcString,
  encryptSensitive,
  decryptSensitive,
  generateNikHash,
} from "../../../db/crypto";
import { Ionicons } from "@expo/vector-icons";

export default function SiswaFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);

  const { role } = useAuth();
  const { refreshPendingCountAsync } = useSync();
  const { showAlert } = useAlert();
  const { showToast } = useToast();

  const isOperator = role === "super_admin" || role === "staf_tu";

  const [saving, setSaving] = useState(false);
  const [existingData, setExistingData] = useState<Siswa | null>(null);

  // Form Fields: Identitas Siswa
  const [namaLengkap, setNamaLengkap] = useState("");
  const [nis, setNis] = useState("");
  const [nisn, setNisn] = useState("");
  const [jenisKelamin, setJenisKelamin] = useState<"L" | "P">("L");
  const [tempatLahir, setTempatLahir] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [agama, setAgama] = useState("Islam");
  const [anakKe, setAnakKe] = useState("1");
  const [jumlahSaudara, setJumlahSaudara] = useState("2");
  const [tinggalBersama, setTinggalBersama] = useState("Orang Tua");
  const [fotoLocalPath, setFotoLocalPath] = useState<string | null>(null);

  // Form Fields: Pendidikan Asal
  const [asalSekolah, setAsalSekolah] = useState("");
  const [npsnSekolahAsal, setNpsnSekolahAsal] = useState("");
  const [tahunMasuk, setTahunMasuk] = useState("2026");

  // Form Fields: Alamat & Kontak
  const [noHp, setNoHp] = useState("");
  const [email, setEmail] = useState("");
  const [alamatJalan, setAlamatJalan] = useState("");
  const [rt, setRt] = useState("");
  const [rw, setRw] = useState("");
  const [desa, setDesa] = useState("");
  const [kecamatan, setKecamatan] = useState("");
  const [kabupaten, setKabupaten] = useState("Jombang");
  const [provinsi, setProvinsi] = useState("Jawa Timur");
  const [kodePos, setKodePos] = useState("");

  // Form Fields: Data Sensitif & Kependudukan (AES-256)
  const [nikRaw, setNikRaw] = useState("");
  const [noKkRaw, setNoKkRaw] = useState("");
  const [nikAyahRaw, setNikAyahRaw] = useState("");
  const [nikIbuRaw, setNikIbuRaw] = useState("");

  // Form Fields: Orang Tua / Wali
  const [ayahNama, setAyahNama] = useState("");
  const [ayahStatus, setAyahStatus] = useState<"hidup" | "cerai" | "meninggal">("hidup");
  const [ayahTempatLahir, setAyahTempatLahir] = useState("");
  const [ayahTanggalLahir, setAyahTanggalLahir] = useState("");
  const [ayahPendidikan, setAyahPendidikan] = useState("SMA");
  const [ayahPekerjaan, setAyahPekerjaan] = useState("");
  const [ayahNoHp, setAyahNoHp] = useState("");

  const [ibuNama, setIbuNama] = useState("");
  const [ibuStatus, setIbuStatus] = useState<"hidup" | "cerai" | "meninggal">("hidup");
  const [ibuTempatLahir, setIbuTempatLahir] = useState("");
  const [ibuTanggalLahir, setIbuTanggalLahir] = useState("");
  const [ibuPendidikan, setIbuPendidikan] = useState("SMA");
  const [ibuPekerjaan, setIbuPekerjaan] = useState("");
  const [ibuNoHp, setIbuNoHp] = useState("");
  const [kartuBantuan, setKartuBantuan] = useState("Tidak Menerima");

  // Data Wali Siswa (Opsional)
  const [waliNama, setWaliNama] = useState("");
  const [waliHubungan, setWaliHubungan] = useState("Paman");
  const [waliStatus, setWaliStatus] = useState<"hidup" | "meninggal">("hidup");
  const [waliNikRaw, setWaliNikRaw] = useState("");
  const [waliTempatLahir, setWaliTempatLahir] = useState("");
  const [waliTanggalLahir, setWaliTanggalLahir] = useState("");
  const [waliPendidikan, setWaliPendidikan] = useState("SMA");
  const [waliPekerjaan, setWaliPekerjaan] = useState("");
  const [waliNoHp, setWaliNoHp] = useState("");

  useEffect(() => {
    if (!isOperator) {
      showAlert({
        title: "Akses Dibatasi",
        message: "Hanya Super Admin dan Staf TU yang memiliki wewenang mengelola data siswa.",
        type: "error",
      });
      router.back();
      return;
    }

    if (id) {
      loadSiswaDetail(id);
    }
  }, [id, role]);

  const loadSiswaDetail = async (siswaId: string) => {
    try {
      const res = await db.select().from(siswa).where(eq(siswa.id, siswaId)).limit(1);
      if (res.length === 0 || !res[0]) {
        showAlert({
          title: "Siswa Tidak Ditemukan",
          message: "Data siswa tidak ditemukan dalam database.",
          type: "error",
        });
        router.back();
        return;
      }

      const s = res[0];
      setExistingData(s);

      setNamaLengkap(s.nama_lengkap);
      setNis(s.nis || "");
      setNisn(s.nisn || "");
      setJenisKelamin(s.jenis_kelamin as "L" | "P");
      setTempatLahir(s.tempat_lahir || "");
      setTanggalLahir(s.tanggal_lahir || "");
      setAgama(s.agama || "Islam");
      setAnakKe(s.anak_ke ? String(s.anak_ke) : "1");
      setJumlahSaudara(s.jumlah_saudara ? String(s.jumlah_saudara) : "2");
      setTinggalBersama(s.tinggal_bersama || "Orang Tua");
      setFotoLocalPath(s.foto_local_path || null);

      setAsalSekolah(s.asal_sekolah || "");
      setNpsnSekolahAsal(s.npsn_sekolah_asal || "");
      setTahunMasuk(s.tahun_masuk || "2026");

      setNoHp(s.no_hp || "");
      setEmail(s.email || "");
      setAlamatJalan(s.alamat_jalan || "");
      setRt(s.rt || "");
      setRw(s.rw || "");
      setDesa(s.desa || "");
      setKecamatan(s.kecamatan || "");
      setKabupaten(s.kabupaten || "Jombang");
      setProvinsi(s.provinsi || "Jawa Timur");
      setKodePos(s.kode_pos || "");

      // Dekripsi NIK Siswa & No KK & NIK Ayah & NIK Ibu
      if (s.nik) {
        const decNik = await decryptSensitive(s.nik);
        setNikRaw(decNik || "");
      }
      if (s.no_kk) {
        const decKk = await decryptSensitive(s.no_kk);
        setNoKkRaw(decKk || "");
      }
      if (s.nik_ayah) {
        const decNikAyah = await decryptSensitive(s.nik_ayah);
        setNikAyahRaw(decNikAyah || "");
      }
      if (s.nik_ibu) {
        const decNikIbu = await decryptSensitive(s.nik_ibu);
        setNikIbuRaw(decNikIbu || "");
      }

      // Ambil data orang tua & wali dari tabel wali_siswa
      const wRes = await db
        .select()
        .from(waliSiswa)
        .where(and(eq(waliSiswa.siswa_id, siswaId), isNull(waliSiswa.deleted_at)));

      const ayah = wRes.find((w) => w.hubungan === "ayah");
      if (ayah) {
        setAyahNama(ayah.nama_lengkap);
        setAyahStatus((ayah.status as any) || "hidup");
        setAyahTempatLahir(ayah.tempat_lahir || "");
        setAyahTanggalLahir(ayah.tanggal_lahir || "");
        setAyahPendidikan(ayah.pendidikan_terakhir || "SMA");
        setAyahPekerjaan(ayah.pekerjaan || "");
        setAyahNoHp(ayah.no_hp || "");
        if (ayah.nik && !s.nik_ayah) {
          const decAyahNik = await decryptSensitive(ayah.nik);
          if (decAyahNik) setNikAyahRaw(decAyahNik);
        }
      }

      const ibu = wRes.find((w) => w.hubungan === "ibu");
      if (ibu) {
        setIbuNama(ibu.nama_lengkap);
        setIbuStatus((ibu.status as any) || "hidup");
        setIbuTempatLahir(ibu.tempat_lahir || "");
        setIbuTanggalLahir(ibu.tanggal_lahir || "");
        setIbuPendidikan(ibu.pendidikan_terakhir || "SMA");
        setIbuPekerjaan(ibu.pekerjaan || "");
        setIbuNoHp(ibu.no_hp || "");
        setKartuBantuan(ibu.kartu_bantuan || "Tidak Menerima");
        if (ibu.nik && !s.nik_ibu) {
          const decIbuNik = await decryptSensitive(ibu.nik);
          if (decIbuNik) setNikIbuRaw(decIbuNik);
        }
      }

      const wali = wRes.find((w) => w.hubungan === "wali");
      if (wali) {
        setWaliNama(wali.nama_lengkap);
        setWaliHubungan(wali.keterangan_hubungan || "Paman");
        setWaliStatus((wali.status as any) || "hidup");
        setWaliTempatLahir(wali.tempat_lahir || "");
        setWaliTanggalLahir(wali.tanggal_lahir || "");
        setWaliPendidikan(wali.pendidikan_terakhir || "SMA");
        setWaliPekerjaan(wali.pekerjaan || "");
        setWaliNoHp(wali.no_hp || "");
        if (wali.nik) {
          const decWaliNik = await decryptSensitive(wali.nik);
          if (decWaliNik) setWaliNikRaw(decWaliNik);
        }
      }
    } catch (e) {
      console.warn("Gagal membaca data siswa:", e);
    }
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert({
          title: "Izin Galeri Diperlukan",
          message: "Berikan izin akses galeri foto untuk memilih pasfoto siswa.",
          type: "warning",
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setFotoLocalPath(result.assets[0].uri);
      }
    } catch (e: any) {
      showAlert({
        title: "Gagal Membuka Galeri",
        message: e?.message || "Terjadi kesalahan saat memilih gambar",
        type: "error",
      });
    }
  };

  const handleSave = async () => {
    const cleanNama = namaLengkap.trim();
    const cleanNik = nikRaw.trim();

    if (!cleanNama) {
      showAlert({
        title: "Nama Siswa Wajib Diisi",
        message: "Mohon masukkan nama lengkap peserta didik.",
        type: "warning",
      });
      return;
    }

    if (!cleanNik || cleanNik.length < 16) {
      showAlert({
        title: "NIK Tidak Lengkap",
        message: "Nomor Induk Kependudukan (NIK) siswa wajib 16 digit angka.",
        type: "warning",
      });
      return;
    }

    setSaving(true);
    const now = getIsoUtcString();

    try {
      // 1. Blind Indexing untuk NIK & Validasi Keunikan
      const hNik = await generateNikHash(cleanNik);
      if (!hNik) {
        showAlert({
          title: "Error Hash NIK",
          message: "Tidak dapat menghasilkan hash pengindeksan NIK.",
          type: "error",
        });
        setSaving(false);
        return;
      }

      const existingWithNik = await db
        .select()
        .from(siswa)
        .where(and(eq(siswa.nik_hash, hNik), isNull(siswa.deleted_at)));

      if (
        existingWithNik.length > 0 &&
        (!isEditing || (isEditing && existingWithNik[0]?.id !== id))
      ) {
        showAlert({
          title: "NIK Sudah Terdaftar",
          message: `Siswa dengan NIK tersebut sudah terdaftar atas nama '${existingWithNik[0]?.nama_lengkap}'.`,
          type: "error",
        });
        setSaving(false);
        return;
      }

      // 2. Enkripsi AES-256 untuk kolom sensitif (NIK Siswa, No KK, NIK Ayah, NIK Ibu)
      const encNik = await encryptSensitive(cleanNik);
      const encKk = noKkRaw.trim() ? await encryptSensitive(noKkRaw.trim()) : null;
      const cleanNikAyah = nikAyahRaw.trim();
      const cleanNikIbu = nikIbuRaw.trim();
      const cleanNikWali = waliNikRaw.trim();
      const encNikAyah = cleanNikAyah ? await encryptSensitive(cleanNikAyah) : null;
      const encNikIbu = cleanNikIbu ? await encryptSensitive(cleanNikIbu) : null;
      const encNikWali = cleanNikWali ? await encryptSensitive(cleanNikWali) : null;
      const hNikAyah = cleanNikAyah ? await generateNikHash(cleanNikAyah) : null;
      const hNikIbu = cleanNikIbu ? await generateNikHash(cleanNikIbu) : null;
      const hNikWali = cleanNikWali ? await generateNikHash(cleanNikWali) : null;

      const siswaId = isEditing && id ? id : generateUUID();

      if (isEditing && id) {
        await db
          .update(siswa)
          .set({
            nama_lengkap: cleanNama,
            nis: nis.trim() || null,
            nisn: nisn.trim() || null,
            jenis_kelamin: jenisKelamin,
            tempat_lahir: tempatLahir.trim() || null,
            tanggal_lahir: tanggalLahir.trim() || null,
            agama,
            anak_ke: Number(anakKe) || 1,
            jumlah_saudara: Number(jumlahSaudara) || 0,
            tinggal_bersama: tinggalBersama,
            foto_local_path: fotoLocalPath,
            asal_sekolah: asalSekolah.trim() || null,
            npsn_sekolah_asal: npsnSekolahAsal.trim() || null,
            tahun_masuk: tahunMasuk.trim() || "2026",
            no_hp: noHp.trim() || null,
            email: email.trim().toLowerCase() || null,
            alamat_jalan: alamatJalan.trim() || null,
            rt: rt.trim() || null,
            rw: rw.trim() || null,
            desa: desa.trim() || null,
            kecamatan: kecamatan.trim() || null,
            kabupaten: kabupaten.trim() || null,
            provinsi: provinsi.trim() || null,
            kode_pos: kodePos.trim() || null,
            nik: encNik,
            nik_hash: hNik,
            no_kk: encKk,
            nik_ayah: encNikAyah,
            nik_ibu: encNikIbu,
            updated_at: now,
            sync_status: "pending_push",
            version: (existingData?.version || 1) + 1,
          })
          .where(eq(siswa.id, id));
      } else {
        await db.insert(siswa).values({
          id: siswaId,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "pending_push",
          last_synced_at: null,
          version: 1,
          nama_lengkap: cleanNama,
          nis: nis.trim() || null,
          nisn: nisn.trim() || null,
          jenis_kelamin: jenisKelamin,
          tempat_lahir: tempatLahir.trim() || null,
          tanggal_lahir: tanggalLahir.trim() || null,
          agama,
          anak_ke: Number(anakKe) || 1,
          jumlah_saudara: Number(jumlahSaudara) || 0,
          tinggal_bersama: tinggalBersama,
          foto_local_path: fotoLocalPath,
          foto_remote_url: null,
          asal_sekolah: asalSekolah.trim() || null,
          npsn_sekolah_asal: npsnSekolahAsal.trim() || null,
          tahun_masuk: tahunMasuk.trim() || "2026",
          status: "aktif",
          no_hp: noHp.trim() || null,
          email: email.trim().toLowerCase() || null,
          alamat_jalan: alamatJalan.trim() || null,
          rt: rt.trim() || null,
          rw: rw.trim() || null,
          desa: desa.trim() || null,
          kecamatan: kecamatan.trim() || null,
          kabupaten: kabupaten.trim() || null,
          provinsi: provinsi.trim() || null,
          kode_pos: kodePos.trim() || null,
          nik: encNik,
          nik_hash: hNik,
          no_kk: encKk,
          nik_ayah: encNikAyah,
          nik_ibu: encNikIbu,
        });
      }

      // 3. Simpan / Perbarui Data Orang Tua (Ayah & Ibu)
      if (ayahNama.trim()) {
        const existAyah = await db
          .select()
          .from(waliSiswa)
          .where(and(eq(waliSiswa.siswa_id, siswaId), eq(waliSiswa.hubungan, "ayah")));

        if (existAyah.length > 0) {
          await db
            .update(waliSiswa)
            .set({
              nama_lengkap: ayahNama.trim(),
              status: ayahStatus,
              tempat_lahir: ayahTempatLahir.trim() || null,
              tanggal_lahir: ayahTanggalLahir.trim() || null,
              pendidikan_terakhir: ayahPendidikan,
              pekerjaan: ayahPekerjaan.trim() || null,
              no_hp: ayahNoHp.trim() || null,
              nik: encNikAyah,
              nik_hash: hNikAyah,
              deleted_at: null,
              updated_at: now,
              sync_status: "pending_push",
            })
            .where(eq(waliSiswa.id, existAyah[0]!.id));
        } else {
          await db.insert(waliSiswa).values({
            id: generateUUID(),
            created_at: now,
            updated_at: now,
            deleted_at: null,
            sync_status: "pending_push",
            last_synced_at: null,
            version: 1,
            siswa_id: siswaId,
            hubungan: "ayah",
            nama_lengkap: ayahNama.trim(),
            status: ayahStatus,
            tempat_lahir: ayahTempatLahir.trim() || null,
            tanggal_lahir: ayahTanggalLahir.trim() || null,
            pendidikan_terakhir: ayahPendidikan,
            pekerjaan: ayahPekerjaan.trim() || null,
            no_hp: ayahNoHp.trim() || null,
            nik: encNikAyah,
            nik_hash: hNikAyah,
          });
        }
      }

      if (ibuNama.trim()) {
        const existIbu = await db
          .select()
          .from(waliSiswa)
          .where(and(eq(waliSiswa.siswa_id, siswaId), eq(waliSiswa.hubungan, "ibu")));

        if (existIbu.length > 0) {
          await db
            .update(waliSiswa)
            .set({
              nama_lengkap: ibuNama.trim(),
              status: ibuStatus,
              tempat_lahir: ibuTempatLahir.trim() || null,
              tanggal_lahir: ibuTanggalLahir.trim() || null,
              pendidikan_terakhir: ibuPendidikan,
              pekerjaan: ibuPekerjaan.trim() || null,
              no_hp: ibuNoHp.trim() || null,
              kartu_bantuan: kartuBantuan,
              nik: encNikIbu,
              nik_hash: hNikIbu,
              deleted_at: null,
              updated_at: now,
              sync_status: "pending_push",
            })
            .where(eq(waliSiswa.id, existIbu[0]!.id));
        } else {
          await db.insert(waliSiswa).values({
            id: generateUUID(),
            created_at: now,
            updated_at: now,
            deleted_at: null,
            sync_status: "pending_push",
            last_synced_at: null,
            version: 1,
            siswa_id: siswaId,
            hubungan: "ibu",
            nama_lengkap: ibuNama.trim(),
            status: ibuStatus,
            tempat_lahir: ibuTempatLahir.trim() || null,
            tanggal_lahir: ibuTanggalLahir.trim() || null,
            pendidikan_terakhir: ibuPendidikan,
            pekerjaan: ibuPekerjaan.trim() || null,
            no_hp: ibuNoHp.trim() || null,
            kartu_bantuan: kartuBantuan,
            nik: encNikIbu,
            nik_hash: hNikIbu,
          });
        }
      }

      // 4. Simpan / Perbarui Data Wali Siswa (jika diisi)
      const existWali = await db
        .select()
        .from(waliSiswa)
        .where(and(eq(waliSiswa.siswa_id, siswaId), eq(waliSiswa.hubungan, "wali")));

      if (waliNama.trim()) {
        if (existWali.length > 0) {
          await db
            .update(waliSiswa)
            .set({
              nama_lengkap: waliNama.trim(),
              keterangan_hubungan: waliHubungan.trim() || null,
              status: waliStatus,
              tempat_lahir: waliTempatLahir.trim() || null,
              tanggal_lahir: waliTanggalLahir.trim() || null,
              pendidikan_terakhir: waliPendidikan,
              pekerjaan: waliPekerjaan.trim() || null,
              no_hp: waliNoHp.trim() || null,
              nik: encNikWali,
              nik_hash: hNikWali,
              deleted_at: null,
              updated_at: now,
              sync_status: "pending_push",
            })
            .where(eq(waliSiswa.id, existWali[0]!.id));
        } else {
          await db.insert(waliSiswa).values({
            id: generateUUID(),
            created_at: now,
            updated_at: now,
            deleted_at: null,
            sync_status: "pending_push",
            last_synced_at: null,
            version: 1,
            siswa_id: siswaId,
            hubungan: "wali",
            nama_lengkap: waliNama.trim(),
            keterangan_hubungan: waliHubungan.trim() || null,
            status: waliStatus,
            tempat_lahir: waliTempatLahir.trim() || null,
            tanggal_lahir: waliTanggalLahir.trim() || null,
            pendidikan_terakhir: waliPendidikan,
            pekerjaan: waliPekerjaan.trim() || null,
            no_hp: waliNoHp.trim() || null,
            nik: encNikWali,
            nik_hash: hNikWali,
          });
        }
      } else if (existWali.length > 0 && !existWali[0]!.deleted_at) {
        await db
          .update(waliSiswa)
          .set({
            deleted_at: now,
            updated_at: now,
            sync_status: "pending_push",
          })
          .where(eq(waliSiswa.id, existWali[0]!.id));
      }

      await refreshPendingCountAsync();
      showToast(isEditing ? "Perubahan data siswa berhasil disimpan." : "Data siswa baru berhasil disimpan.");
      router.back();
    } catch (e: any) {
      showAlert({
        title: "Gagal Menyimpan",
        message: e?.message || "Terjadi kesalahan database.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title={isEditing ? "Edit Data Siswa" : "Tambah Siswa Baru"}
      subtitle="Madrasah Tsanawiyah Roudhotut Thowalib"
      showBack
      hideBottomDock
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

        {/* 1. IDENTITAS PESERTA DIDIK */}
        <ModernCard style={styles.card}>
          <Text style={styles.sectionHeader}>Foto & Identitas Siswa</Text>

          <View style={styles.photoRow}>
            <Pressable
              onPress={handlePickImage}
              style={({ pressed }) => [styles.photoWrapper, pressed && styles.pressedState]}
              accessibilityRole="button"
              accessibilityLabel="Pilih pasfoto siswa"
            >
              {fotoLocalPath ? (
                <Image source={{ uri: fotoLocalPath }} style={styles.photoImg} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={32} color={colors.primary[700]} />
                  <Text style={styles.photoLabel}>Pilih Pasfoto</Text>
                </View>
              )}
            </Pressable>

            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.photoHintTitle}>Pasfoto Resmi Siswa</Text>
              <Text style={styles.photoHintSub}>
                Gunakan pasfoto seragam madrasah dengan rasio 3x4 untuk buku induk.
              </Text>
              {fotoLocalPath && (
                <Pressable
                  onPress={() => setFotoLocalPath(null)}
                  hitSlop={8}
                  style={({ pressed }) => [pressed && styles.pressedOpacity]}
                  accessibilityRole="button"
                  accessibilityLabel="Hapus foto"
                >
                  <Text style={styles.removePhotoText}>Hapus Foto</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Nama Lengkap */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Nama Lengkap Siswa *</Text>
            <TextInput
              value={namaLengkap}
              onChangeText={setNamaLengkap}
              placeholder="Contoh: Ahmad Rizky Pratama"
              style={styles.input}
            />
          </View>

          {/* NIS & NISN */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>NIS Madrasah</Text>
              <TextInput
                value={nis}
                onChangeText={setNis}
                placeholder="26001"
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1.2 }]}>
              <Text style={styles.fieldLabel}>NISN Kemdikbud</Text>
              <TextInput
                value={nisn}
                onChangeText={setNisn}
                placeholder="0112345678"
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>

          {/* Jenis Kelamin */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Jenis Kelamin *</Text>
            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => setJenisKelamin("L")}
                style={({ pressed }) => [
                  styles.toggleBtn,
                  jenisKelamin === "L" && styles.toggleBtnActive,
                  pressed && styles.pressedState,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Laki-laki"
              >
                <Text
                  style={[styles.toggleText, jenisKelamin === "L" && styles.toggleTextActive]}
                >
                  Laki-laki
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setJenisKelamin("P")}
                style={({ pressed }) => [
                  styles.toggleBtn,
                  jenisKelamin === "P" && styles.toggleBtnActive,
                  pressed && styles.pressedState,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Perempuan"
              >
                <Text
                  style={[styles.toggleText, jenisKelamin === "P" && styles.toggleTextActive]}
                >
                  Perempuan
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Tempat & Tanggal Lahir */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1.2 }]}>
              <Text style={styles.fieldLabel}>Tempat Lahir</Text>
              <TextInput
                value={tempatLahir}
                onChangeText={setTempatLahir}
                placeholder="Jombang"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Tgl Lahir (YYYY-MM-DD)</Text>
              <TextInput
                value={tanggalLahir}
                onChangeText={setTanggalLahir}
                placeholder="2011-03-15"
                style={styles.input}
              />
            </View>
          </View>

          {/* Anak ke, Jumlah Saudara, Tinggal Bersama */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Anak Ke-</Text>
              <TextInput
                value={anakKe}
                onChangeText={setAnakKe}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Jumlah Saudara</Text>
              <TextInput
                value={jumlahSaudara}
                onChangeText={setJumlahSaudara}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Status Tempat Tinggal</Text>
            <View style={styles.chipRow}>
              {["Orang Tua", "Pondok Pesantren", "Wali / Kerabat", "Kost"].map((tb) => {
                const isSel = tinggalBersama === tb;
                return (
                  <Pressable
                    key={tb}
                    onPress={() => setTinggalBersama(tb)}
                    style={({ pressed }) => [
                      styles.chipItem,
                      isSel && styles.chipItemActive,
                      pressed && styles.pressedState,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Pilih ${tb}`}
                  >
                    <Text style={[styles.chipText, isSel && styles.chipTextActive]}>{tb}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ModernCard>

        {/* 2. PENDIDIKAN ASAL */}
        <ModernCard style={styles.card}>
          <Text style={styles.sectionHeader}>Pendidikan Asal (SD / MI)</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Nama Sekolah Asal (SD/MI)</Text>
            <TextInput
              value={asalSekolah}
              onChangeText={setAsalSekolah}
              placeholder="Contoh: MI Roudhotut Thowalib / SDN Bandung 1"
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1.2 }]}>
              <Text style={styles.fieldLabel}>NPSN Sekolah Asal</Text>
              <TextInput
                value={npsnSekolahAsal}
                onChangeText={setNpsnSekolahAsal}
                placeholder="20584489"
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Tahun Masuk MTs</Text>
              <TextInput
                value={tahunMasuk}
                onChangeText={setTahunMasuk}
                placeholder="2026"
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>
        </ModernCard>

        {/* 3. ALAMAT & KONTAK SISWA */}
        <ModernCard style={styles.card}>
          <Text style={styles.sectionHeader}>Alamat & Kontak Domisili</Text>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>No. Handphone / WhatsApp</Text>
              <TextInput
                value={noHp}
                onChangeText={setNoHp}
                placeholder="081234567890"
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="siswa@domain.com"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Jalan / Dusun</Text>
            <TextInput
              value={alamatJalan}
              onChangeText={setAlamatJalan}
              placeholder="Dsn. Thowalib RT 02 RW 01"
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>RT / RW</Text>
              <TextInput
                value={rt}
                onChangeText={setRt}
                placeholder="02"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>RW</Text>
              <TextInput
                value={rw}
                onChangeText={setRw}
                placeholder="01"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Desa</Text>
              <TextInput
                value={desa}
                onChangeText={setDesa}
                placeholder="Bandung"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Kecamatan</Text>
              <TextInput
                value={kecamatan}
                onChangeText={setKecamatan}
                placeholder="Diwek"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Kabupaten</Text>
              <TextInput
                value={kabupaten}
                onChangeText={setKabupaten}
                placeholder="Jombang"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Kode Pos</Text>
              <TextInput
                value={kodePos}
                onChangeText={setKodePos}
                placeholder="61471"
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>
        </ModernCard>

        {/* 4. DATA SENSITIF & KEPENDUDUKAN (AES-256) */}
        <ModernCard style={styles.card}>
          <View style={styles.secHeaderRow}>
            <Text style={styles.sectionHeader}>Data Sensitif & Kependudukan (AES-256)</Text>
            <Ionicons name="lock-closed" size={16} color={colors.primary[700]} />
          </View>
          <Text style={styles.secSub}>
            NIK Siswa, Nomor KK, NIK Ayah, dan NIK Ibu dienkripsi secara otomatis menggunakan algoritma AES-256 untuk privasi data siswa dan keluarga.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Nomor Induk Kependudukan (NIK Siswa) *</Text>
            <TextInput
              value={nikRaw}
              onChangeText={setNikRaw}
              placeholder="16 digit angka NIK Siswa"
              keyboardType="numeric"
              maxLength={16}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Nomor Kartu Keluarga (No. KK)</Text>
            <TextInput
              value={noKkRaw}
              onChangeText={setNoKkRaw}
              placeholder="16 digit nomor KK"
              keyboardType="numeric"
              maxLength={16}
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>NIK Ayah Kandung</Text>
              <TextInput
                value={nikAyahRaw}
                onChangeText={setNikAyahRaw}
                placeholder="16 digit NIK Ayah"
                keyboardType="numeric"
                maxLength={16}
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>NIK Ibu Kandung</Text>
              <TextInput
                value={nikIbuRaw}
                onChangeText={setNikIbuRaw}
                placeholder="16 digit NIK Ibu"
                keyboardType="numeric"
                maxLength={16}
                style={styles.input}
              />
            </View>
          </View>
        </ModernCard>

        {/* 5. DATA ORANG TUA / WALI */}
        <ModernCard style={styles.card}>
          <Text style={styles.sectionHeader}>Data Orang Tua / Wali Siswa</Text>

          {/* Ayah Kandung */}
          <Text style={styles.subHeading}>A. Data Ayah Kandung</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Nama Lengkap Ayah</Text>
            <TextInput
              value={ayahNama}
              onChangeText={setAyahNama}
              placeholder="Nama ayah kandung"
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Status Ayah</Text>
              <View style={styles.statusChipsMini}>
                {(["hidup", "cerai", "meninggal"] as const).map((st) => (
                  <Pressable
                    key={st}
                    onPress={() => setAyahStatus(st)}
                    style={({ pressed }) => [
                      styles.miniChip,
                      ayahStatus === st && styles.miniChipActive,
                      pressed && styles.pressedState,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Status ayah ${st}`}
                  >
                    <Text
                      style={[
                        styles.miniChipText,
                        ayahStatus === st && styles.miniChipTextActive,
                      ]}
                    >
                      {st}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Pekerjaan Ayah</Text>
              <TextInput
                value={ayahPekerjaan}
                onChangeText={setAyahPekerjaan}
                placeholder="Petani / Wiraswasta"
                style={styles.input}
              />
            </View>
          </View>

          {/* Tempat & Tanggal Lahir Ayah */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1.2 }]}>
              <Text style={styles.fieldLabel}>Tempat Lahir Ayah</Text>
              <TextInput
                value={ayahTempatLahir}
                onChangeText={setAyahTempatLahir}
                placeholder="Jombang"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Tgl Lahir (YYYY-MM-DD)</Text>
              <TextInput
                value={ayahTanggalLahir}
                onChangeText={setAyahTanggalLahir}
                placeholder="1978-04-05"
                style={styles.input}
              />
            </View>
          </View>

          {/* Lulusan Pendidikan Ayah */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Lulusan Pendidikan Terakhir Ayah</Text>
            <View style={styles.chipRow}>
              {["SD", "SMP", "SMA", "D3", "S1", "S2", "S3", "Tidak Sekolah"].map((edu) => {
                const isSel = ayahPendidikan === edu;
                return (
                  <Pressable
                    key={edu}
                    onPress={() => setAyahPendidikan(edu)}
                    style={({ pressed }) => [
                      styles.chipItem,
                      isSel && styles.chipItemActive,
                      pressed && styles.pressedState,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Pendidikan ayah ${edu}`}
                  >
                    <Text style={[styles.chipText, isSel && styles.chipTextActive]}>{edu}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>No. HP / WhatsApp Ayah</Text>
            <TextInput
              value={ayahNoHp}
              onChangeText={setAyahNoHp}
              placeholder="081234567890"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          {/* Ibu Kandung */}
          <Text style={[styles.subHeading, { marginTop: 14 }]}>B. Data Ibu Kandung</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Nama Lengkap Ibu</Text>
            <TextInput
              value={ibuNama}
              onChangeText={setIbuNama}
              placeholder="Nama ibu kandung"
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Status Ibu</Text>
              <View style={styles.statusChipsMini}>
                {(["hidup", "cerai", "meninggal"] as const).map((st) => (
                  <Pressable
                    key={st}
                    onPress={() => setIbuStatus(st)}
                    style={({ pressed }) => [
                      styles.miniChip,
                      ibuStatus === st && styles.miniChipActive,
                      pressed && styles.pressedState,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Status ibu ${st}`}
                  >
                    <Text
                      style={[
                        styles.miniChipText,
                        ibuStatus === st && styles.miniChipTextActive,
                      ]}
                    >
                      {st}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Pekerjaan Ibu</Text>
              <TextInput
                value={ibuPekerjaan}
                onChangeText={setIbuPekerjaan}
                placeholder="Ibu Rumah Tangga / Guru"
                style={styles.input}
              />
            </View>
          </View>

          {/* Tempat & Tanggal Lahir Ibu */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1.2 }]}>
              <Text style={styles.fieldLabel}>Tempat Lahir Ibu</Text>
              <TextInput
                value={ibuTempatLahir}
                onChangeText={setIbuTempatLahir}
                placeholder="Jombang"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Tgl Lahir (YYYY-MM-DD)</Text>
              <TextInput
                value={ibuTanggalLahir}
                onChangeText={setIbuTanggalLahir}
                placeholder="1980-08-18"
                style={styles.input}
              />
            </View>
          </View>

          {/* Lulusan Pendidikan Ibu */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Lulusan Pendidikan Terakhir Ibu</Text>
            <View style={styles.chipRow}>
              {["SD", "SMP", "SMA", "D3", "S1", "S2", "S3", "Tidak Sekolah"].map((edu) => {
                const isSel = ibuPendidikan === edu;
                return (
                  <Pressable
                    key={edu}
                    onPress={() => setIbuPendidikan(edu)}
                    style={({ pressed }) => [
                      styles.chipItem,
                      isSel && styles.chipItemActive,
                      pressed && styles.pressedState,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Pendidikan ibu ${edu}`}
                  >
                    <Text style={[styles.chipText, isSel && styles.chipTextActive]}>{edu}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>No. HP / WhatsApp Ibu</Text>
            <TextInput
              value={ibuNoHp}
              onChangeText={setIbuNoHp}
              placeholder="081234567890"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          {/* Kartu Bantuan Sosial */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Kepemilikan Kartu Bantuan Sosial</Text>
            <View style={styles.chipRow}>
              {["Tidak Menerima", "KIP", "PKH", "KKS", "Lainnya"].map((kb) => {
                const isSel = kartuBantuan === kb;
                return (
                  <Pressable
                    key={kb}
                    onPress={() => setKartuBantuan(kb)}
                    style={({ pressed }) => [
                      styles.chipItem,
                      isSel && styles.chipItemActive,
                      pressed && styles.pressedState,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Pilih bantuan ${kb}`}
                  >
                    <Text style={[styles.chipText, isSel && styles.chipTextActive]}>{kb}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Wali Siswa (Opsional) */}
          <Text style={[styles.subHeading, { marginTop: 14 }]}>C. Data Wali Siswa (Opsional)</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Nama Lengkap Wali (Kosongkan jika tidak ada)</Text>
            <TextInput
              value={waliNama}
              onChangeText={setWaliNama}
              placeholder="Nama wali murid (jika ada)"
              style={styles.input}
            />
          </View>

          {waliNama.trim().length > 0 && (
            <>
              <View style={styles.row}>
                <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                  <Text style={styles.fieldLabel}>Hubungan dengan Siswa</Text>
                  <TextInput
                    value={waliHubungan}
                    onChangeText={setWaliHubungan}
                    placeholder="Paman / Kakek / Nenek / Kakak"
                    style={styles.input}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Status Wali</Text>
                  <View style={styles.statusChipsMini}>
                    {(["hidup", "meninggal"] as const).map((st) => (
                      <Pressable
                        key={st}
                        onPress={() => setWaliStatus(st)}
                        style={({ pressed }) => [
                          styles.miniChip,
                          waliStatus === st && styles.miniChipActive,
                          pressed && styles.pressedState,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Status wali ${st}`}
                      >
                        <Text
                          style={[
                            styles.miniChipText,
                            waliStatus === st && styles.miniChipTextActive,
                          ]}
                        >
                          {st}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>NIK Wali (Opsional)</Text>
                <TextInput
                  value={waliNikRaw}
                  onChangeText={setWaliNikRaw}
                  placeholder="16 digit NIK Wali"
                  keyboardType="numeric"
                  maxLength={16}
                  style={styles.input}
                />
              </View>

              {/* Tempat & Tanggal Lahir Wali */}
              <View style={styles.row}>
                <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                  <Text style={styles.fieldLabel}>Tempat Lahir Wali</Text>
                  <TextInput
                    value={waliTempatLahir}
                    onChangeText={setWaliTempatLahir}
                    placeholder="Jombang"
                    style={styles.input}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Tgl Lahir (YYYY-MM-DD)</Text>
                  <TextInput
                    value={waliTanggalLahir}
                    onChangeText={setWaliTanggalLahir}
                    placeholder="1982-06-15"
                    style={styles.input}
                  />
                </View>
              </View>

              {/* Lulusan Pendidikan Wali */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Lulusan Pendidikan Terakhir Wali</Text>
                <View style={styles.chipRow}>
                  {["SD", "SMP", "SMA", "D3", "S1", "S2", "S3", "Tidak Sekolah"].map((edu) => {
                    const isSel = waliPendidikan === edu;
                    return (
                      <Pressable
                        key={edu}
                        onPress={() => setWaliPendidikan(edu)}
                        style={({ pressed }) => [
                          styles.chipItem,
                          isSel && styles.chipItemActive,
                          pressed && styles.pressedState,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Pendidikan wali ${edu}`}
                      >
                        <Text style={[styles.chipText, isSel && styles.chipTextActive]}>{edu}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Pekerjaan Wali</Text>
                  <TextInput
                    value={waliPekerjaan}
                    onChangeText={setWaliPekerjaan}
                    placeholder="Wiraswasta / PNS"
                    style={styles.input}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>No. HP / WA Wali</Text>
                  <TextInput
                    value={waliNoHp}
                    onChangeText={setWaliNoHp}
                    placeholder="081234567890"
                    keyboardType="phone-pad"
                    style={styles.input}
                  />
                </View>
              </View>
            </>
          )}
        </ModernCard>
      </ScrollView>

      {/* Sticky footer: menempel di bawah layar, naik di atas keyboard (Bagian 5, 10 & 14) */}
      <StickyFooterButton
        title={saving ? "Menyimpan Data..." : isEditing ? "Simpan" : "Simpan Data Siswa"}
        onPress={handleSave}
        loading={saving}
        secondaryTitle="Batal"
        onSecondaryPress={() => router.back()}
        icon={<Ionicons name="save-outline" size={18} color={colors.neutral.white} />}
      />
    </KeyboardAvoidingView>
  </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.md,
  },
  backText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary[700],
  },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderCurve: "continuous",
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
    marginBottom: spacing.md,
  },
  subHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary[800],
    marginBottom: spacing.sm,
  },
  secHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  secSub: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.neutral.canvas,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  photoWrapper: {
    width: 75,
    height: 100,
    borderRadius: radius.md,
    borderCurve: "continuous",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  photoImg: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  photoLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary[700],
  },
  photoHintTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  photoHintSub: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    lineHeight: 15,
  },
  removePhotoText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.status.cancelled,
    marginTop: 4,
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
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 6,
  },
  toggleBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral.canvas,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary[700],
    borderColor: colors.primary[700],
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.neutral.textSecondary,
  },
  toggleTextActive: {
    color: colors.neutral.white,
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
  statusChipsMini: {
    flexDirection: "row",
    gap: 6,
  },
  miniChip: {
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
  miniChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[400],
  },
  miniChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral.textSecondary,
  },
  miniChipTextActive: {
    color: colors.primary[800],
    fontWeight: "700",
  },
  bottomActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xxl,
    marginTop: 6,
  },
  pressedState: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  pressedOpacity: {
    opacity: 0.6,
  },
});
