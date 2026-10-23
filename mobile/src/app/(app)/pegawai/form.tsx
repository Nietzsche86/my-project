import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, radii, shadows, spacing } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { useSync } from "../../../context/SyncContext";
import { useAlert } from "../../../context/AlertContext";
import { AppShell } from "../../../components/layout/AppShell";
import { ModernCard } from "../../../components/ui/ModernCard";
import { ModernButton } from "../../../components/ui/ModernButton";
import { StickyFooterButton, useToast } from "../../../components/ui";
import { db } from "../../../db/client";
import { pegawai, type Pegawai } from "../../../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  generateUUID,
  getIsoUtcString,
  encryptSensitive,
  decryptSensitive,
  generateNikHash,
} from "../../../db/crypto";
import { Ionicons } from "@expo/vector-icons";

export default function PegawaiFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);

  const { role } = useAuth();
  const { refreshPendingCountAsync } = useSync();
  const { showAlert } = useAlert();
  const { showToast } = useToast();

  const isOperator = role === "super_admin" || role === "staf_tu";

  const [saving, setSaving] = useState(false);
  const [existingData, setExistingData] = useState<Pegawai | null>(null);

  // Form Fields: Identitas
  const [namaLengkap, setNamaLengkap] = useState("");
  const [jenis, setJenis] = useState<"guru" | "tendik">("guru");
  const [jenisKelamin, setJenisKelamin] = useState<"L" | "P">("L");
  const [tempatLahir, setTempatLahir] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [fotoLocalPath, setFotoLocalPath] = useState<string | null>(null);

  // Form Fields: Kepegawaian & EMIS
  const [statusKepegawaian, setStatusKepegawaian] = useState<string>("GTY");
  const [statusAktif, setStatusAktif] = useState<"aktif" | "nonaktif" | "pensiun">("aktif");
  const [jabatan, setJabatan] = useState("");
  const [tugasTambahan, setTugasTambahan] = useState("");
  const [tmt, setTmt] = useState("");
  const [skNomor, setSkNomor] = useState("");
  const [skTanggal, setSkTanggal] = useState("");
  const [nip, setNip] = useState("");
  const [nuptk, setNuptk] = useState("");
  const [npk, setNpk] = useState("");
  const [pegid, setPegid] = useState("");
  const [nrg, setNrg] = useState("");

  // Form Fields: Kontak & Alamat
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

  // Form Fields: Sensitif (Terenkripsi)
  const [nikRaw, setNikRaw] = useState("");
  const [npwpRaw, setNpwpRaw] = useState("");
  const [namaBank, setNamaBank] = useState("");
  const [noRekeningRaw, setNoRekeningRaw] = useState("");
  const [atasNamaRekening, setAtasNamaRekening] = useState("");

  useEffect(() => {
    if (!isOperator) {
      showAlert({
        title: "Akses Dibatasi",
        message: "Hanya Super Admin dan Staf TU yang memiliki wewenang mengelola data pegawai.",
        type: "error",
      });
      router.back();
      return;
    }

    if (id) {
      loadPegawaiDetail(id);
    }
  }, [id, role]);

  const loadPegawaiDetail = async (pegawaiId: string) => {
    try {
      const res = await db.select().from(pegawai).where(eq(pegawai.id, pegawaiId)).limit(1);
      if (res.length === 0 || !res[0]) {
        showAlert({
          title: "Data Tidak Ditemukan",
          message: "Pegawai dengan ID tersebut tidak ditemukan.",
          type: "error",
        });
        router.back();
        return;
      }

      const p = res[0];
      setExistingData(p);

      setNamaLengkap(p.nama_lengkap);
      setJenis(p.jenis as "guru" | "tendik");
      setJenisKelamin(p.jenis_kelamin as "L" | "P");
      setTempatLahir(p.tempat_lahir || "");
      setTanggalLahir(p.tanggal_lahir || "");
      setFotoLocalPath(p.foto_local_path || null);

      setStatusKepegawaian(p.status_kepegawaian);
      setStatusAktif(p.status_aktif as "aktif" | "nonaktif" | "pensiun");
      setJabatan(p.jabatan || "");
      setTugasTambahan(p.tugas_tambahan || "");
      setTmt(p.tmt || "");
      setSkNomor(p.sk_pengangkatan_nomor || "");
      setSkTanggal(p.sk_pengangkatan_tanggal || "");
      setNip(p.nip || "");
      setNuptk(p.nuptk || "");
      setNpk(p.npk || "");
      setPegid(p.pegid || "");
      setNrg(p.nrg || "");

      setNoHp(p.no_hp || "");
      setEmail(p.email || "");
      setAlamatJalan(p.alamat_jalan || "");
      setRt(p.rt || "");
      setRw(p.rw || "");
      setDesa(p.desa || "");
      setKecamatan(p.kecamatan || "");
      setKabupaten(p.kabupaten || "Jombang");
      setProvinsi(p.provinsi || "Jawa Timur");
      setKodePos(p.kode_pos || "");

      setNamaBank(p.nama_bank || "");
      setAtasNamaRekening(p.atas_nama_rekening || "");

      // Dekripsi data sensitif
      if (p.nik) {
        const decNik = await decryptSensitive(p.nik);
        setNikRaw(decNik || "");
      }
      if (p.npwp) {
        const decNpwp = await decryptSensitive(p.npwp);
        setNpwpRaw(decNpwp || "");
      }
      if (p.no_rekening) {
        const decRek = await decryptSensitive(p.no_rekening);
        setNoRekeningRaw(decRek || "");
      }
    } catch (e) {
      console.warn("Gagal memuat detail pegawai:", e);
    }
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert({
          title: "Izin Galeri Diperlukan",
          message: "Berikan izin akses galeri foto untuk memilih pasfoto pegawai.",
          type: "warning",
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
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
        title: "Nama Wajib Diisi",
        message: "Mohon masukkan nama lengkap pegawai beserta gelar.",
        type: "warning",
      });
      return;
    }

    if (!cleanNik || cleanNik.length < 16) {
      showAlert({
        title: "NIK Tidak Lengkap",
        message: "Nomor Induk Kependudukan (NIK) wajib 16 digit angka.",
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
          title: "Format NIK Tidak Valid",
          message: "Tidak dapat menghasilkan hash pengindeksan NIK.",
          type: "error",
        });
        setSaving(false);
        return;
      }

      const existingWithNik = await db
        .select()
        .from(pegawai)
        .where(and(eq(pegawai.nik_hash, hNik), isNull(pegawai.deleted_at)));

      if (
        existingWithNik.length > 0 &&
        (!isEditing || (isEditing && existingWithNik[0]?.id !== id))
      ) {
        showAlert({
          title: "NIK Sudah Terdaftar",
          message: `Pegawai dengan NIK tersebut sudah terdaftar atas nama '${existingWithNik[0]?.nama_lengkap}'.`,
          type: "error",
        });
        setSaving(false);
        return;
      }

      // 2. Enkripsi AES-256 untuk kolom-kolom sensitif
      const encNik = await encryptSensitive(cleanNik);
      const encNpwp = npwpRaw.trim() ? await encryptSensitive(npwpRaw.trim()) : null;
      const encRekening = noRekeningRaw.trim()
        ? await encryptSensitive(noRekeningRaw.trim())
        : null;

      if (isEditing && id) {
        await db
          .update(pegawai)
          .set({
            nama_lengkap: cleanNama,
            jenis,
            jenis_kelamin: jenisKelamin,
            tempat_lahir: tempatLahir.trim() || null,
            tanggal_lahir: tanggalLahir.trim() || null,
            foto_local_path: fotoLocalPath,
            status_kepegawaian: statusKepegawaian,
            status_aktif: statusAktif,
            jabatan: jabatan.trim() || null,
            tugas_tambahan: tugasTambahan.trim() || null,
            tmt: tmt.trim() || null,
            sk_pengangkatan_nomor: skNomor.trim() || null,
            sk_pengangkatan_tanggal: skTanggal.trim() || null,
            nip: nip.trim() || null,
            nuptk: nuptk.trim() || null,
            npk: npk.trim() || null,
            pegid: pegid.trim() || null,
            nrg: nrg.trim() || null,
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
            npwp: encNpwp,
            nama_bank: namaBank.trim() || null,
            no_rekening: encRekening,
            atas_nama_rekening: atasNamaRekening.trim() || null,
            updated_at: now,
            sync_status: "pending_push",
            version: (existingData?.version || 1) + 1,
          })
          .where(eq(pegawai.id, id));
      } else {
        const newId = generateUUID();
        await db.insert(pegawai).values({
          id: newId,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "pending_push",
          last_synced_at: null,
          version: 1,
          nama_lengkap: cleanNama,
          jenis,
          jenis_kelamin: jenisKelamin,
          tempat_lahir: tempatLahir.trim() || null,
          tanggal_lahir: tanggalLahir.trim() || null,
          foto_local_path: fotoLocalPath,
          foto_remote_url: null,
          status_kepegawaian: statusKepegawaian,
          status_aktif: statusAktif,
          jabatan: jabatan.trim() || null,
          tugas_tambahan: tugasTambahan.trim() || null,
          tmt: tmt.trim() || null,
          sk_pengangkatan_nomor: skNomor.trim() || null,
          sk_pengangkatan_tanggal: skTanggal.trim() || null,
          sk_pengangkatan_local_path: null,
          sk_pengangkatan_remote_url: null,
          nip: nip.trim() || null,
          nuptk: nuptk.trim() || null,
          npk: npk.trim() || null,
          pegid: pegid.trim() || null,
          nrg: nrg.trim() || null,
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
          npwp: encNpwp,
          nama_bank: namaBank.trim() || null,
          no_rekening: encRekening,
          atas_nama_rekening: atasNamaRekening.trim() || null,
        });
      }

      await refreshPendingCountAsync();
      showToast(isEditing ? `Perubahan data pegawai '${cleanNama}' berhasil disimpan.` : `Pegawai '${cleanNama}' berhasil ditambahkan.`);
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
      title={isEditing ? "Edit Data Pegawai" : "Tambah Pegawai Baru"}
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
          {/* FOTO PROFIL & IDENTITAS UTAMA */}
          <ModernCard style={styles.card}>
          <Text style={styles.sectionHeader}>Foto & Identitas Utama</Text>

          <View style={styles.photoRow}>
            <Pressable
              onPress={handlePickImage}
              style={({ pressed }) => [styles.photoWrapper, pressed && styles.pressedState]}
              accessibilityRole="button"
              accessibilityLabel="Pilih foto profil"
            >
              {fotoLocalPath ? (
                <Image source={{ uri: fotoLocalPath }} style={styles.photoImg} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={32} color={colors.primary[700]} />
                  <Text style={styles.photoLabel}>Pilih Foto</Text>
                </View>
              )}
            </Pressable>

            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.photoHintTitle}>Pasfoto Resmi PTK</Text>
              <Text style={styles.photoHintSub}>
                Gunakan foto formal latar belakang polos untuk biodata resmi Kemenag.
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
            <Text style={styles.fieldLabel}>Nama Lengkap & Gelar *</Text>
            <TextInput
              value={namaLengkap}
              onChangeText={setNamaLengkap}
              placeholder="Contoh: Muhammad Ilham, S.Pd.I"
              style={styles.input}
            />
          </View>

          {/* Jenis Pegawai & Jenis Kelamin */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Jenis Pegawai *</Text>
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setJenis("guru")}
                  style={({ pressed }) => [
                    styles.toggleBtn,
                    jenis === "guru" && styles.toggleBtnActive,
                    pressed && styles.pressedState,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Jenis Guru"
                >
                  <Text style={[styles.toggleText, jenis === "guru" && styles.toggleTextActive]}>
                    Guru
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setJenis("tendik")}
                  style={({ pressed }) => [
                    styles.toggleBtn,
                    jenis === "tendik" && styles.toggleBtnActive,
                    pressed && styles.pressedState,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Jenis Tendik"
                >
                  <Text style={[styles.toggleText, jenis === "tendik" && styles.toggleTextActive]}>
                    Tendik
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
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
                  <Text style={[styles.toggleText, jenisKelamin === "L" && styles.toggleTextActive]}>
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
                  <Text style={[styles.toggleText, jenisKelamin === "P" && styles.toggleTextActive]}>
                    Perempuan
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Tempat & Tanggal Lahir */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1.2 }]}>
              <Text style={styles.fieldLabel}>Tempat Lahir</Text>
              <TextInput
                value={tempatLahir}
                onChangeText={setTempatLahir}
                placeholder="Misal: Jombang"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Tgl Lahir (YYYY-MM-DD)</Text>
              <TextInput
                value={tanggalLahir}
                onChangeText={setTanggalLahir}
                placeholder="1990-05-15"
                style={styles.input}
              />
            </View>
          </View>
        </ModernCard>

        {/* DATA KEPEGAWAIAN & EMIS KEMENAG */}
        <ModernCard style={styles.card}>
          <Text style={styles.sectionHeader}>Kepegawaian & EMIS Kemenag</Text>

          {/* Status Kepegawaian & Status Aktif */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Status Kepegawaian</Text>
            <View style={styles.statusChipsRow}>
              {["PNS", "PPPK", "GTY", "GTT", "Honorer"].map((st) => {
                const isSel = statusKepegawaian === st;
                return (
                  <Pressable
                    key={st}
                    onPress={() => setStatusKepegawaian(st)}
                    style={({ pressed }) => [
                      styles.chipItem,
                      isSel && styles.chipItemActive,
                      pressed && styles.pressedState,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Status kepegawaian ${st}`}
                  >
                    <Text style={[styles.chipText, isSel && styles.chipTextActive]}>{st}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Status Aktif</Text>
            <View style={styles.statusChipsRow}>
              {(["aktif", "nonaktif", "pensiun"] as const).map((sa) => {
                const isSel = statusAktif === sa;
                return (
                  <Pressable
                    key={sa}
                    onPress={() => setStatusAktif(sa)}
                    style={({ pressed }) => [
                      styles.chipItem,
                      isSel && styles.chipItemActive,
                      pressed && styles.pressedState,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Status aktif ${sa}`}
                  >
                    <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                      {sa.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Jabatan & Tugas Tambahan */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Jabatan Utama</Text>
              <TextInput
                value={jabatan}
                onChangeText={setJabatan}
                placeholder="Guru Mapel / Staf TU"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Tugas Tambahan</Text>
              <TextInput
                value={tugasTambahan}
                onChangeText={setTugasTambahan}
                placeholder="Wali Kelas 7A / Bendahara"
                style={styles.input}
              />
            </View>
          </View>

          {/* TMT & SK Pengangkatan */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>TMT (YYYY-MM-DD)</Text>
              <TextInput
                value={tmt}
                onChangeText={setTmt}
                placeholder="2020-07-15"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Nomor SK</Text>
              <TextInput
                value={skNomor}
                onChangeText={setSkNomor}
                placeholder="SK/01/YPP-RTH/2020"
                style={styles.input}
              />
            </View>
          </View>

          {/* NIP, NUPTK, NPK */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>NIP (Jika Ada)</Text>
              <TextInput
                value={nip}
                onChangeText={setNip}
                placeholder="19800512..."
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>NUPTK</Text>
              <TextInput
                value={nuptk}
                onChangeText={setNuptk}
                placeholder="16 digit NUPTK"
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* NPK, PegID, NRG */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>NPK Kemenag</Text>
              <TextInput
                value={npk}
                onChangeText={setNpk}
                placeholder="NPK Simpatika"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>PegID Simpatika</Text>
              <TextInput
                value={pegid}
                onChangeText={setPegid}
                placeholder="PegID"
                style={styles.input}
              />
            </View>
          </View>
        </ModernCard>

        {/* KONTAK & DOMISILI */}
        <ModernCard style={styles.card}>
          <Text style={styles.sectionHeader}>Kontak & Alamat Domisili</Text>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>No HP / WhatsApp</Text>
              <TextInput
                value={noHp}
                onChangeText={setNoHp}
                placeholder="081234567890"
                style={styles.input}
                keyboardType="phone-pad"
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Alamat Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="email@domain.sch.id"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Alamat Jalan / Dusun</Text>
            <TextInput
              value={alamatJalan}
              onChangeText={setAlamatJalan}
              placeholder="Dsn. Thowalib RT 01 RW 02"
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Desa / Kelurahan</Text>
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
              <Text style={styles.fieldLabel}>Kabupaten / Kota</Text>
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
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
          </View>
        </ModernCard>

        {/* DATA SENSITIF (TERENKRIPSI AES-256) */}
        <ModernCard style={styles.card}>
          <View style={styles.secHeaderRow}>
            <Text style={styles.sectionHeader}>Data Sensitif & Keuangan (AES-256)</Text>
            <Ionicons name="lock-closed" size={16} color={colors.primary[700]} />
          </View>
          <Text style={styles.secSub}>
            Data di bawah ini dienkripsi secara otomatis menggunakan standar AES-256 dan dilindungi dengan Blind Indexing.
          </Text>

          {/* NIK */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Nomor Induk Kependudukan (NIK) *</Text>
            <TextInput
              value={nikRaw}
              onChangeText={setNikRaw}
              placeholder="16 digit angka NIK KTP"
              style={styles.input}
              keyboardType="numeric"
              maxLength={16}
            />
          </View>

          {/* NPWP */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Nomor Pokok Wajib Pajak (NPWP)</Text>
            <TextInput
              value={npwpRaw}
              onChangeText={setNpwpRaw}
              placeholder="Contoh: 35.170.901.0-602.000"
              style={styles.input}
            />
          </View>

          {/* Rekening Bank */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Nama Bank</Text>
              <TextInput
                value={namaBank}
                onChangeText={setNamaBank}
                placeholder="BSI / BRI / Mandiri"
                style={styles.input}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1.3 }]}>
              <Text style={styles.fieldLabel}>Nomor Rekening</Text>
              <TextInput
                value={noRekeningRaw}
                onChangeText={setNoRekeningRaw}
                placeholder="Nomor rekening"
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Atas Nama Rekening</Text>
            <TextInput
              value={atasNamaRekening}
              onChangeText={setAtasNamaRekening}
              placeholder="Sesuai buku tabungan"
              style={styles.input}
            />
          </View>
        </ModernCard>
      </ScrollView>

      {/* Sticky footer button */}
      <StickyFooterButton
        title={saving ? "Menyimpan..." : isEditing ? "Simpan" : "Simpan Pegawai Baru"}
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
    width: 80,
    height: 80,
    borderRadius: radius.lg,
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
  statusChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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
