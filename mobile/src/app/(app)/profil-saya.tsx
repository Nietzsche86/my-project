import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, radii, shadows, spacing } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import { useSync } from "../../context/SyncContext";
import { useAlert } from "../../context/AlertContext";
import { AppShell } from "../../components/layout/AppShell";
import {
  ModernCard,
  ModernButton,
  Badge,
  StickyFooterButton,
  ConfirmDialog,
  useToast,
} from "../../components/ui";
import { db } from "../../db/client";
import {
  pegawai,
  riwayatPendidikan,
  mataPelajaran,
  guruMapel,
  type RiwayatPendidikan,
  type MataPelajaran,
} from "../../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  getIsoUtcString,
  encryptSensitive,
  decryptSensitive,
  generateNikHash,
  generateUUID,
} from "../../db/crypto";
import { generateAndSharePegawaiBiodataPdf } from "../../utils/pdfGenerator";
import { Ionicons } from "@expo/vector-icons";

export default function ProfilSayaScreen() {
  const { user, pegawaiData, role, logoutAsync } = useAuth();
  const { triggerPushAsync, refreshPendingCountAsync, isSyncing } = useSync();
  const { showAlert } = useAlert();
  const { showToast } = useToast();

  const [nama, setNama] = useState("");
  const [noHp, setNoHp] = useState("");
  const [email, setEmail] = useState("");
  const [alamat, setAlamat] = useState("");
  const [nikRaw, setNikRaw] = useState("");
  const [nuptk, setNuptk] = useState("");
  const [fotoLocalPath, setFotoLocalPath] = useState<string | null>(null);

  const [riwayat, setRiwayat] = useState<RiwayatPendidikan[]>([]);
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);

  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [confirmPushVisible, setConfirmPushVisible] = useState(false);
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false);
  const [profilePendingPush, setProfilePendingPush] = useState(false);

  // Modal Riwayat Pendidikan Mandiri
  const [modalEduVisible, setModalEduVisible] = useState(false);
  const [formJenjang, setFormJenjang] = useState("S1");
  const [formInstitusi, setFormInstitusi] = useState("");
  const [formJurusan, setFormJurusan] = useState("");
  const [formTahunLulus, setFormTahunLulus] = useState("");

  useEffect(() => {
    loadProfile();
  }, [pegawaiData]);

  const loadProfile = async () => {
    if (!pegawaiData) return;
    setNama(pegawaiData.nama_lengkap || "");
    setNoHp(pegawaiData.no_hp || "");
    setEmail(pegawaiData.email || user?.email || "");
    setAlamat(pegawaiData.alamat_jalan || "");
    setNuptk(pegawaiData.nuptk || "");
    setFotoLocalPath(pegawaiData.foto_local_path || null);
    setProfilePendingPush(pegawaiData.sync_status === "pending_push");

    if (pegawaiData.nik) {
      const decrypted = await decryptSensitive(pegawaiData.nik);
      setNikRaw(decrypted || "");
    }

    // Riwayat pendidikan
    const rList = await db
      .select()
      .from(riwayatPendidikan)
      .where(
        and(
          eq(riwayatPendidikan.pegawai_id, pegawaiData.id),
          isNull(riwayatPendidikan.deleted_at)
        )
      );
    setRiwayat(rList);

    // Mapel keahlian yang diampu
    if (pegawaiData.jenis === "guru") {
      const mList = await db
        .select({
          id: mataPelajaran.id,
          created_at: mataPelajaran.created_at,
          updated_at: mataPelajaran.updated_at,
          deleted_at: mataPelajaran.deleted_at,
          sync_status: mataPelajaran.sync_status,
          last_synced_at: mataPelajaran.last_synced_at,
          version: mataPelajaran.version,
          kode_mapel: mataPelajaran.kode_mapel,
          nama_mapel: mataPelajaran.nama_mapel,
          kelompok: mataPelajaran.kelompok,
          is_active: mataPelajaran.is_active,
        })
        .from(guruMapel)
        .innerJoin(mataPelajaran, eq(guruMapel.mata_pelajaran_id, mataPelajaran.id))
        .where(
          and(
            eq(guruMapel.pegawai_id, pegawaiData.id),
            isNull(guruMapel.deleted_at),
            isNull(mataPelajaran.deleted_at)
          )
        );
      setMapelList(mList);
    }
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert({
          title: "Izin Galeri Diperlukan",
          message: "Berikan izin akses foto untuk memperbarui foto profil Anda.",
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

  const handleSaveProfile = async () => {
    if (!pegawaiData?.id) return;
    setSaving(true);

    try {
      const now = getIsoUtcString();
      const cleanNik = nikRaw.trim();
      const encNik = cleanNik ? await encryptSensitive(cleanNik) : pegawaiData.nik;
      const hNik = cleanNik ? await generateNikHash(cleanNik) : pegawaiData.nik_hash;

      await db
        .update(pegawai)
        .set({
          nama_lengkap: nama.trim(),
          no_hp: noHp.trim() || null,
          email: email.trim().toLowerCase() || null,
          alamat_jalan: alamat.trim() || null,
          foto_local_path: fotoLocalPath,
          nik: encNik,
          nik_hash: hNik,
          nuptk: nuptk.trim() || null,
          updated_at: now,
          sync_status: "pending_push",
          version: (pegawaiData.version || 1) + 1,
        })
        .where(eq(pegawai.id, pegawaiData.id));

      await refreshPendingCountAsync();
      setProfilePendingPush(true);
      showToast("Biodata profil berhasil disimpan.");
    } catch (err: any) {
      showAlert({
        title: "Gagal Menyimpan",
        message: err?.message || "Terjadi kesalahan database",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadProfile = async () => {
    setConfirmPushVisible(false);
    const res = await triggerPushAsync();
    if (res.success) {
      setProfilePendingPush(false);
      showToast("Profil berhasil disinkronkan ke server!");
    } else {
      showToast(res.message, { type: "error" });
    }
  };

  const handlePrintPdf = async () => {
    if (!pegawaiData) return;
    setGeneratingPdf(true);
    try {
      const res = await generateAndSharePegawaiBiodataPdf({
        pegawai: {
          ...pegawaiData,
          nama_lengkap: nama,
          no_hp: noHp,
          email: email,
          alamat_jalan: alamat,
          foto_local_path: fotoLocalPath,
        },
        nikDecrypted: nikRaw || "-",
        riwayatPendidikan: riwayat,
        mataPelajaranList: mapelList,
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

  const handleSavePendidikan = async () => {
    if (!formInstitusi.trim() || !pegawaiData?.id) {
      showAlert({
        title: "Institusi Wajib Diisi",
        message: "Masukkan nama sekolah atau universitas.",
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
        pegawai_id: pegawaiData.id,
        jenjang: formJenjang,
        institusi: formInstitusi.trim(),
        jurusan: formJurusan.trim() || null,
        tahun_lulus: formTahunLulus.trim() || null,
      });

      await refreshPendingCountAsync();
      setModalEduVisible(false);
      setFormInstitusi("");
      setFormJurusan("");
      setFormTahunLulus("");
      await loadProfile();
    } catch (e: any) {
      showAlert({
        title: "Gagal Menyimpan",
        message: e?.message || "Terjadi kesalahan database",
        type: "error",
      });
    }
  };

  const handleRemovePendidikan = (r: RiwayatPendidikan) => {
    showAlert({
      title: "Hapus Riwayat Pendidikan",
      message: `Hapus arsip pendidikan ${r.jenjang} di ${r.institusi}?`,
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
              await loadProfile();
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

  const handleLogout = async () => {
    setConfirmLogoutVisible(false);
    await logoutAsync();
    showToast("Berhasil keluar dari akun.", { type: "info" });
    router.replace("/(public)/login");
  };

  return (
    <AppShell title="Profil Saya" subtitle="Kemandirian Data Guru & Pegawai">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ padding: spacing.screen, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER PROFILE BANNER */}
          <ModernCard style={styles.banner}>
            <Pressable
              onPress={handlePickImage}
              style={({ pressed }) => [styles.avatarWrapper, pressed && styles.avatarWrapperPressed]}
              accessibilityRole="button"
              accessibilityLabel="Ganti foto profil"
            >
              {fotoLocalPath ? (
                <Image source={{ uri: fotoLocalPath }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarBig}>
                  <Text style={styles.avatarBigText}>
                    {nama ? nama.charAt(0).toUpperCase() : "U"}
                  </Text>
                </View>
              )}
              <View style={styles.cameraIconPill}>
                <Ionicons name="camera" size={13} color={colors.neutral.white} />
              </View>
            </Pressable>

            <View style={styles.bannerInfo}>
              <Text style={styles.bannerName}>{nama || "Data Pegawai"}</Text>
              <Text style={styles.bannerRole}>
                {pegawaiData?.jabatan || "Guru Madrasah"} • {pegawaiData?.status_kepegawaian || "GTY"}
              </Text>
              <View style={styles.badgeRow}>
                <Badge label="Penyimpanan Lokal Aktif" variant="primary" size="sm" />
                <Badge
                  label={profilePendingPush ? "Perubahan Belum Diunggah" : "Tersinkron"}
                  variant={profilePendingPush ? "pending" : "synced"}
                  size="sm"
                />
              </View>
            </View>
          </ModernCard>

          {/* FORM BIODATA MANDIRI */}
          <ModernCard style={styles.formCard}>
          <Text style={styles.sectionHeading}>BIODATA PRIBADI (DAPAT DIEDIT MANDIRI)</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nama Lengkap & Gelar</Text>
            <TextInput
              value={nama}
              onChangeText={setNama}
              style={styles.input}
              placeholder="Nama lengkap"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>NIK (Terenkripsi AES-256)</Text>
            <TextInput
              value={nikRaw}
              onChangeText={setNikRaw}
              keyboardType="numeric"
              maxLength={16}
              style={styles.input}
              placeholder="16 digit NIK"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>NUPTK</Text>
            <TextInput
              value={nuptk}
              onChangeText={setNuptk}
              keyboardType="numeric"
              style={styles.input}
              placeholder="Nomor NUPTK"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>No. Handphone (WhatsApp)</Text>
              <TextInput
                value={noHp}
                onChangeText={setNoHp}
                keyboardType="phone-pad"
                style={styles.input}
                placeholder="0812..."
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                placeholder="email@..."
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Alamat Tempat Tinggal</Text>
            <TextInput
              value={alamat}
              onChangeText={setAlamat}
              multiline
              numberOfLines={2}
              style={[styles.input, { height: 60 }]}
              placeholder="Alamat domisili lengkap"
            />
          </View>
        </ModernCard>

        {/* STRUKTUR KEPEGAWAIAN (TERKUNCI / HANYA BISA DIUBAH ADMIN) */}
        <ModernCard style={styles.lockedCard}>
          <View style={styles.lockedHeader}>
            <Ionicons name="lock-closed" size={16} color={colors.neutral.textMuted} />
            <Text style={styles.lockedHeading}>ATRIBUT STRUKTURAL (DIKELOLA OLEH TATA USAHA)</Text>
          </View>
          <Text style={styles.lockedNote}>
            Data penugasan resmi berikut dikunci dan hanya dapat diperbarui oleh Super Admin / Staf TU:
          </Text>

          <View style={styles.lockedGrid}>
            <View style={styles.lockedItem}>
              <Text style={styles.lockedLabel}>Jabatan</Text>
              <Text style={styles.lockedVal}>{pegawaiData?.jabatan || "Guru Mapel"}</Text>
            </View>
            <View style={styles.lockedItem}>
              <Text style={styles.lockedLabel}>Tugas Tambahan</Text>
              <Text style={styles.lockedVal}>{pegawaiData?.tugas_tambahan || "-"}</Text>
            </View>
            <View style={styles.lockedItem}>
              <Text style={styles.lockedLabel}>Status Kepegawaian</Text>
              <Text style={styles.lockedVal}>{pegawaiData?.status_kepegawaian || "GTY"}</Text>
            </View>
            <View style={styles.lockedItem}>
              <Text style={styles.lockedLabel}>Status Aktif</Text>
              <Text style={styles.lockedVal}>{pegawaiData?.status_aktif || "aktif"}</Text>
            </View>
            <View style={styles.lockedItem}>
              <Text style={styles.lockedLabel}>NIP</Text>
              <Text style={styles.lockedVal}>{pegawaiData?.nip || "-"}</Text>
            </View>
            <View style={styles.lockedItem}>
              <Text style={styles.lockedLabel}>TMT Tugas</Text>
              <Text style={styles.lockedVal}>{pegawaiData?.tmt || "-"}</Text>
            </View>
          </View>
        </ModernCard>

        {/* RIWAYAT PENDIDIKAN MANDIRI */}
        <ModernCard style={styles.eduCard}>
          <View style={styles.eduHeaderRow}>
            <Text style={styles.sectionHeading}>RIWAYAT PENDIDIKAN FORMAL</Text>
            <Pressable
              onPress={() => setModalEduVisible(true)}
              style={({ pressed }) => [styles.addEduBtn, pressed && styles.chipPressed]}
              accessibilityRole="button"
              accessibilityLabel="Tambah Riwayat Pendidikan"
            >
              <Ionicons name="add" size={14} color={colors.primary[700]} />
              <Text style={styles.addEduText}>Tambah</Text>
            </Pressable>
          </View>

          {riwayat.length > 0 ? (
            riwayat.map((r) => (
              <View key={r.id} style={styles.eduItem}>
                <View style={styles.eduBadge}>
                  <Text style={styles.eduBadgeText}>{r.jenjang}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eduDegree}>{r.institusi}</Text>
                  <Text style={styles.eduMajor}>
                    {r.jurusan ? `${r.jurusan} • ` : ""}Tahun Lulus: {r.tahun_lulus || "-"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleRemovePendidikan(r)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.iconActionBtn, pressed && styles.pressedOpacity]}
                  accessibilityRole="button"
                  accessibilityLabel={`Hapus riwayat ${r.jenjang}`}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.status.cancelled} />
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Belum ada riwayat pendidikan yang tercatat.</Text>
          )}
        </ModernCard>

        {/* SEKSI KELUAR DARI AKUN (LOGOUT) */}
        <ModernCard style={styles.logoutCard}>
          <View style={styles.logoutRow}>
            <View style={styles.logoutIconBox}>
              <Ionicons name="log-out-outline" size={22} color={colors.status.conflict} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logoutTitle}>Keluar dari Akun</Text>
              <Text style={styles.logoutSub}>
                Keluar dari akun {user?.name || "pengguna"} ({role === "guru" ? "Guru" : role === "staf_tu" ? "Staf TU" : "Admin"}). Anda perlu login kembali untuk mengakses data.
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
            onPress={() => setConfirmLogoutVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Keluar dari akun"
          >
            <Ionicons name="log-out-outline" size={18} color={colors.status.conflict} />
            <Text style={styles.logoutBtnText}>Keluar Sesi (Logout)</Text>
          </Pressable>
        </ModernCard>
      </ScrollView>

      {/* Sticky footer: Sinkronkan Profil Saya ke Server aktif hanya jika ada pending_push (Bagian 13) */}
      <StickyFooterButton
        title={
          profilePendingPush
            ? "Sinkronkan Profil Saya ke Server"
            : "Simpan Biodata Profil"
        }
        onPress={
          profilePendingPush
            ? () => setConfirmPushVisible(true)
            : handleSaveProfile
        }
        loading={saving || isSyncing}
        secondaryTitle={profilePendingPush ? "Simpan Biodata" : "Cetak PDF"}
        onSecondaryPress={
          profilePendingPush ? handleSaveProfile : handlePrintPdf
        }
        icon={
          profilePendingPush ? (
            <Ionicons name="cloud-upload-outline" size={18} color={colors.neutral.white} />
          ) : (
            <Ionicons name="save-outline" size={18} color={colors.neutral.white} />
          )
        }
      />
    </KeyboardAvoidingView>

    {/* Dialog Konfirmasi Upload Data Guru (Bagian 13) */}
    <ConfirmDialog
      visible={confirmPushVisible}
      title="Unggah Pembaruan Profil?"
      message="Unggah perubahan profil mandiri Anda ke server madrasah? Data di server akan diperbarui."
      confirmLabel="Unggah"
      cancelLabel="Batal"
      loading={isSyncing}
      onConfirm={handleUploadProfile}
      onCancel={() => setConfirmPushVisible(false)}
    />

    {/* Dialog Konfirmasi Keluar Akun (Logout) */}
    <ConfirmDialog
      visible={confirmLogoutVisible}
      title="Keluar dari Akun?"
      message="Apakah Anda yakin ingin keluar dari sesi akun ini? Anda perlu memasukkan email dan kata sandi kembali untuk masuk."
      confirmLabel="Ya, Keluar"
      cancelLabel="Batal"
      variant="danger"
      onConfirm={handleLogout}
      onCancel={() => setConfirmLogoutVisible(false)}
    />

      {/* Modal Tambah Riwayat Pendidikan */}
      <Modal visible={modalEduVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Tambah Riwayat Pendidikan</Text>
                <Text style={styles.modalSubtitle}>Pendidikan formal Anda</Text>
              </View>
              <Pressable
                onPress={() => setModalEduVisible(false)}
                hitSlop={8}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedOpacity]}
                accessibilityRole="button"
                accessibilityLabel="Tutup"
              >
                <Ionicons name="close" size={20} color={colors.neutral.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Jenjang Pendidikan</Text>
              <View style={styles.jenjangChipRow}>
                {["SD/MI", "SMP/MTs", "SMA/MA", "D3", "S1", "S2", "S3"].map((j) => {
                  const isSel = formJenjang === j;
                  return (
                    <Pressable
                      key={j}
                      onPress={() => setFormJenjang(j)}
                      style={({ pressed }) => [
                        styles.jenjangChip,
                        isSel && styles.jenjangChipActive,
                        pressed && styles.chipPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Pilih jenjang ${j}`}
                    >
                      <Text
                        style={[
                          styles.jenjangChipText,
                          isSel && styles.jenjangChipTextActive,
                        ]}
                      >
                        {j}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Sekolah / Universitas *</Text>
              <TextInput
                value={formInstitusi}
                onChangeText={setFormInstitusi}
                placeholder="Contoh: UIN Malang"
                style={styles.input}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Jurusan / Program Studi</Text>
              <TextInput
                value={formJurusan}
                onChangeText={setFormJurusan}
                placeholder="Pendidikan Agama Islam"
                style={styles.input}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tahun Lulus</Text>
              <TextInput
                value={formTahunLulus}
                onChangeText={setFormTahunLulus}
                placeholder="2016"
                keyboardType="numeric"
                maxLength={4}
                style={styles.input}
              />
            </View>

            <View style={styles.modalActions}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                onPress={() => setModalEduVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title="Simpan"
                variant="primary"
                size="md"
                onPress={handleSavePendidikan}
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
  scroll: {
    flex: 1,
  },
  banner: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.xl,
    borderCurve: "continuous",
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarWrapperPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    borderCurve: "continuous",
    borderWidth: 2,
    borderColor: colors.primary[200],
  },
  avatarBig: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.primary[700],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBigText: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.neutral.white,
  },
  cameraIconPill: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: colors.primary[700],
    width: 22,
    height: 22,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.neutral.white,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerInfo: {
    flex: 1,
  },
  bannerName: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
    marginBottom: 2,
  },
  bannerRole: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  quickBar: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  formCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderCurve: "continuous",
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.neutral.textMuted,
    letterSpacing: 0.6,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
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
  lockedCard: {
    backgroundColor: colors.neutral.surfaceHover,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderCurve: "continuous",
  },
  lockedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  lockedHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.neutral.textMuted,
    letterSpacing: 0.5,
  },
  lockedNote: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginBottom: 10,
    lineHeight: 16,
  },
  lockedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  lockedItem: {
    flex: 1,
    minWidth: 130,
    backgroundColor: colors.neutral.surface,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
  },
  lockedLabel: {
    fontSize: 10,
    color: colors.neutral.textMuted,
    marginBottom: 2,
  },
  lockedVal: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  eduCard: {
    marginBottom: spacing.xxl,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderCurve: "continuous",
  },
  eduHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  addEduBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
  },
  addEduText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary[700],
  },
  eduItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.borderSubtle,
  },
  eduBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderCurve: "continuous",
    backgroundColor: colors.accent.indigoLight,
  },
  eduBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.accent.indigo,
  },
  eduDegree: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  eduMajor: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    padding: 4,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  pressedOpacity: {
    opacity: 0.6,
  },
  chipPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  emptyText: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 440,
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
  jenjangChipRow: {
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
    gap: spacing.sm,
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
    paddingTop: spacing.sm,
  },
  logoutCard: {
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.conflictBorder,
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.card,
  },
  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  logoutIconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.status.conflictBg,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  logoutSub: {
    fontSize: 12,
    color: colors.neutral.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.status.conflictBg,
    borderWidth: 1,
    borderColor: colors.status.conflictBorder,
    borderRadius: radius.button,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  logoutBtnPressed: {
    opacity: 0.75,
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.status.conflict,
  },
});
