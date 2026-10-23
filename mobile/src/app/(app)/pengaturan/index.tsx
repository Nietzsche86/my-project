import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, shadows, spacing } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { useSync } from "../../../context/SyncContext";
import { useAlert } from "../../../context/AlertContext";
import { AppShell } from "../../../components/layout/AppShell";
import {
  ListItemCard,
  FormSection,
  ModernButton,
  ModernCard,
  ConfirmDialog,
  useToast,
  Badge,
} from "../../../components/ui";
import { db } from "../../../db/client";
import { pengaturan, users, pegawai } from "../../../db/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { hashPassword, getIsoUtcString } from "../../../db/crypto";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function PengaturanScreen() {
  const { user, pegawaiData, role, logoutAsync, switchRoleDemoAsync, refreshCurrentUserAsync } = useAuth();
  const { apiUrl, updateApiUrlAsync } = useSync();
  const { showToast } = useToast();
  const { showAlert } = useAlert();

  const [inputUrl, setInputUrl] = useState(apiUrl);
  const [savingUrl, setSavingUrl] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState<Record<string, string>>({});
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false);

  // Edit Profile & Password Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNewPassword, setFormNewPassword] = useState("");
  const [formConfirmPassword, setFormConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const isSuperAdmin = role === "super_admin";
  const isOperator = role === "super_admin" || role === "staf_tu";

  const handleLogout = async () => {
    setConfirmLogoutVisible(false);
    await logoutAsync();
    router.replace("/(public)/login");
  };

  const openEditProfileModal = () => {
    setFormName(user?.name || "");
    setFormEmail(user?.email || "");
    setFormPhone(pegawaiData?.no_hp || "");
    setFormAddress(pegawaiData?.alamat_jalan || "");
    setFormNewPassword("");
    setFormConfirmPassword("");
    setShowPassword(false);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    const cleanName = formName.trim();
    const cleanEmail = formEmail.trim().toLowerCase();
    const cleanPhone = formPhone.trim();
    const cleanAddress = formAddress.trim();

    if (!cleanName) {
      showAlert({
        title: "Nama Wajib Diisi",
        message: "Silakan masukkan nama lengkap akun Anda.",
        type: "warning",
      });
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      showAlert({
        title: "Email Tidak Valid",
        message: "Silakan masukkan alamat email yang valid.",
        type: "warning",
      });
      return;
    }

    if (formNewPassword) {
      if (formNewPassword.length < 6) {
        showAlert({
          title: "Kata Sandi Terlalu Pendek",
          message: "Kata sandi baru minimal harus terdiri dari 6 karakter.",
          type: "warning",
        });
        return;
      }

      if (formNewPassword !== formConfirmPassword) {
        showAlert({
          title: "Konfirmasi Kata Sandi Berbeda",
          message: "Kata sandi baru dan konfirmasi kata sandi tidak cocok. Mohon periksa kembali.",
          type: "warning",
        });
        return;
      }
    }

    if (!user?.id) return;

    try {
      setSavingProfile(true);

      // Cek apakah email sudah dipakai oleh pengguna lain
      const duplicateUser = await db
        .select()
        .from(users)
        .where(and(eq(users.email, cleanEmail), ne(users.id, user.id)))
        .limit(1);

      if (duplicateUser.length > 0) {
        showAlert({
          title: "Email Sudah Terdaftar",
          message: `Email '${cleanEmail}' telah digunakan oleh akun lain. Silakan gunakan email yang berbeda.`,
          type: "error",
        });
        setSavingProfile(false);
        return;
      }

      const now = getIsoUtcString();
      const userUpdate: any = {
        name: cleanName,
        email: cleanEmail,
        updated_at: now,
        sync_status: "pending_push",
        version: (user.version || 1) + 1,
      };

      if (formNewPassword) {
        userUpdate.password_hash = await hashPassword(formNewPassword);
      }

      await db.update(users).set(userUpdate).where(eq(users.id, user.id));

      if (user.pegawai_id) {
        await db
          .update(pegawai)
          .set({
            nama_lengkap: cleanName,
            email: cleanEmail,
            no_hp: cleanPhone || null,
            alamat_jalan: cleanAddress || null,
            updated_at: now,
            sync_status: "pending_push",
            version: sql`version + 1`,
          })
          .where(eq(pegawai.id, user.pegawai_id));
      }

      await refreshCurrentUserAsync();
      setEditModalVisible(false);
      showToast(
        formNewPassword
          ? "Data diri dan kata sandi berhasil diperbarui!"
          : "Data diri berhasil diperbarui!"
      );
    } catch (err: any) {
      showAlert({
        title: "Gagal Menyimpan Data",
        message: err?.message || "Terjadi kesalahan saat menyimpan pembaruan profil.",
        type: "error",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    loadSettings();
    setInputUrl(apiUrl);
  }, [apiUrl]);

  const loadSettings = async () => {
    try {
      const records = await db.select().from(pengaturan);
      const map: Record<string, string> = {};
      records.forEach((r) => {
        map[r.key] = r.value;
      });
      setSchoolSettings(map);
    } catch (e) {
      console.warn("Gagal membaca pengaturan:", e);
    }
  };

  const handleSaveApiUrl = async () => {
    setSavingUrl(true);
    await updateApiUrlAsync(inputUrl);
    setSavingUrl(false);
    showToast("Alamat server backend berhasil disimpan!");
  };

  return (
    <AppShell title="Menu Lainnya" subtitle="MTs Roudhotut Thowalib">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Card (Bisa diklik untuk edit data diri & password) */}
        <Pressable
          onPress={openEditProfileModal}
          style={({ pressed }) => [
            styles.userCard,
            shadows.soft,
            pressed && styles.userCardPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Edit data diri dan kata sandi"
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </Text>
          </View>
          <View style={styles.userCol}>
            <Text style={styles.userName} numberOfLines={1}>{user?.name || "Pengguna"}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{user?.email || "-"}</Text>
            <View style={styles.badgeWrap}>
              <Badge
                label={
                  role === "super_admin"
                    ? "SUPER ADMIN"
                    : role === "staf_tu"
                    ? "STAF TU"
                    : role === "guru"
                    ? "GURU"
                    : "TAMU"
                }
                variant={role === "guru" ? "gold" : "primary"}
                size="sm"
              />
              <View style={styles.editHintBadge}>
                <Ionicons name="pencil" size={11} color={colors.primary[700]} />
                <Text style={styles.editHintText}>Edit Data & Password</Text>
              </View>
            </View>
          </View>
          <View style={styles.chevronBox}>
            <Ionicons name="chevron-forward" size={18} color={colors.neutral.textMuted} />
          </View>
        </Pressable>

        {/* 1. GRUP: MANAJEMEN (Bagian 2) */}
        {isOperator && (
          <FormSection
            title="MANAJEMEN"
            description="Tahun Ajaran, Semester, dan Mata Pelajaran"
          >
            <ListItemCard
              title="Tahun Ajaran & Semester"
              subtitle="Atur periode aktif ganjil/genap madrasah"
              avatarIcon="calendar-outline"
              onPress={() => router.push("/(app)/tahun-ajaran")}
            />
            <ListItemCard
              title="Mata Pelajaran"
              subtitle="Master mapel dan kelompok kurikulum"
              avatarIcon="book-outline"
              onPress={() => router.push("/(app)/mata-pelajaran")}
            />
            <ListItemCard
              title="Kelas & Rombongan Belajar"
              subtitle="Daftar rombel tingkat 7, 8, dan 9"
              avatarIcon="school-outline"
              onPress={() => router.push("/(app)/kelas")}
            />
          </FormSection>
        )}

        {/* 2. GRUP: KONTEN (Bagian 2) */}
        <FormSection
          title="KONTEN & PUBLIKASI"
          description="Berita dan pengumuman madrasah"
        >
          <ListItemCard
            title="Berita & Artikel Madrasah"
            subtitle="Publikasi kegiatan dan kabar madrasah"
            avatarIcon="newspaper-outline"
            onPress={() => router.push("/(app)/cms")}
          />
          <ListItemCard
            title="Pengumuman Aktif"
            subtitle="Pemberitahuan kepada siswa dan dewan guru"
            avatarIcon="megaphone-outline"
            onPress={() => router.push("/(app)/cms")}
          />
        </FormSection>

        {/* 3. GRUP: SISTEM (HANYA tampil untuk Super Admin sesuai Bagian 2) */}
        {isSuperAdmin && (
          <FormSection
            title="SISTEM & BACKUP"
            description="Akses khusus Super Administrator"
          >
            <ListItemCard
              title="Manajemen Pengguna & Akun"
              subtitle="Kelola akun, role, email & kata sandi akun madrasah"
              avatarIcon="shield-checkmark-outline"
              avatarBg={colors.primary[50]}
              onPress={() => router.push("/(app)/pengguna")}
            />
            <ListItemCard
              title="Eksport & Import Excel"
              subtitle="Download template dan olah data massal"
              avatarIcon="swap-vertical-outline"
              onPress={() => router.push("/(app)/data-io")}
            />

            {/* Pengaturan Host API Wi-Fi LAN */}
            <View style={styles.apiBox}>
              <Text style={styles.apiLabel}>URL Server Sinkronisasi (Wi-Fi LAN)</Text>
              <Text style={styles.apiSub}>
                IP host backend untuk sinkronisasi HP via Wi-Fi:
              </Text>
              <View style={styles.apiRow}>
                <TextInput
                  value={inputUrl}
                  onChangeText={setInputUrl}
                  placeholder="http://192.168.1.10:3000"
                  style={styles.apiInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <ModernButton
                  title="Simpan"
                  variant="primary"
                  size="sm"
                  loading={savingUrl}
                  onPress={handleSaveApiUrl}
                />
              </View>
            </View>

            {/* Identitas Madrasah */}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Nama Madrasah:</Text>
              <Text style={styles.metaVal}>{schoolSettings["nama_madrasah"] || "MTs Roudhotut Thowalib"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>NSM / NPSN:</Text>
              <Text style={styles.metaVal}>
                {schoolSettings["nsm"] || "-"} / {schoolSettings["npsn"] || "-"}
              </Text>
            </View>
          </FormSection>
        )}

        {/* 4. GRUP: PENGUJIAN & DEVELOPER (Bagian 9 & 14) */}
        <FormSection
          title="PENGUJIAN & DEVELOPER"
          description="Alat uji cepat tampilan dan alur mobile"
        >
          <ListItemCard
            title="Halaman Uji Komponen UI"
            subtitle="Checksheet komponen Bagian 14 UI/UX Guideline"
            avatarIcon="construct-outline"
            avatarBg={colors.primary[50]}
            onPress={() => router.push("/(app)/dev/components")}
          />

          {/* Quick Role Switcher */}
          <View style={styles.roleDemoBox}>
            <Text style={styles.roleDemoLabel}>Ganti Peran Cepat (Demo Offline):</Text>
            <View style={styles.roleBtnRow}>
              <Pressable
                onPress={() => {
                  switchRoleDemoAsync("super_admin");
                  showToast("Beralih ke peran Super Admin");
                }}
                style={[styles.roleBtn, role === "super_admin" && styles.roleBtnActive]}
              >
                <Text
                  style={[
                    styles.roleBtnText,
                    role === "super_admin" && styles.roleBtnTextActive,
                  ]}
                >
                  Admin
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  switchRoleDemoAsync("staf_tu");
                  showToast("Beralih ke peran Staf TU");
                }}
                style={[styles.roleBtn, role === "staf_tu" && styles.roleBtnActive]}
              >
                <Text
                  style={[
                    styles.roleBtnText,
                    role === "staf_tu" && styles.roleBtnTextActive,
                  ]}
                >
                  Staf TU
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  switchRoleDemoAsync("guru");
                  showToast("Beralih ke peran Guru");
                }}
                style={[styles.roleBtn, role === "guru" && styles.roleBtnActive]}
              >
                <Text
                  style={[
                    styles.roleBtnText,
                    role === "guru" && styles.roleBtnTextActive,
                  ]}
                >
                  Guru
                </Text>
              </Pressable>
            </View>
          </View>
        </FormSection>

        {/* SEKSI KELUAR DARI AKUN (LOGOUT) */}
        <ModernCard style={styles.logoutCard}>
          <View style={styles.logoutRow}>
            <View style={styles.logoutIconBox}>
              <Ionicons name="log-out-outline" size={22} color={colors.status.conflict} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logoutTitle}>Keluar dari Akun</Text>
              <Text style={styles.logoutSub}>
                Keluar dari akun {user?.name || "pengguna"} ({role === "super_admin" ? "Super Admin" : role === "staf_tu" ? "Staf TU" : "Guru"}). Anda perlu login kembali untuk mengakses data.
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

      {/* Modal Edit Data Diri & Kata Sandi */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={["top", "bottom"]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons name="person-circle-outline" size={24} color={colors.primary[700]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Edit Data Diri & Password</Text>
                  <Text style={styles.modalSub}>Perbarui data akun dan kata sandi Anda</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                hitSlop={8}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressedOpacity]}
                accessibilityLabel="Tutup dialog"
              >
                <Ionicons name="close" size={22} color={colors.neutral.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Form Section 1: Data Diri */}
              <View style={styles.formSectionBox}>
                <Text style={styles.formSectionHeader}>DATA IDENTITAS</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Nama Lengkap <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={18} color={colors.neutral.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={formName}
                      onChangeText={setFormName}
                      placeholder="Masukkan nama lengkap"
                      placeholderTextColor={colors.neutral.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Alamat Email <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={18} color={colors.neutral.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={formEmail}
                      onChangeText={setFormEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="email@madrasah.sch.id"
                      placeholderTextColor={colors.neutral.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nomor WhatsApp / HP</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="call-outline" size={18} color={colors.neutral.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={formPhone}
                      onChangeText={setFormPhone}
                      keyboardType="phone-pad"
                      placeholder="081234567890"
                      placeholderTextColor={colors.neutral.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Alamat Domisili</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="home-outline" size={18} color={colors.neutral.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={formAddress}
                      onChangeText={setFormAddress}
                      placeholder="Alamat tempat tinggal saat ini"
                      placeholderTextColor={colors.neutral.textMuted}
                    />
                  </View>
                </View>
              </View>

              {/* Form Section 2: Ganti Password */}
              <View style={[styles.formSectionBox, { marginTop: spacing.md }]}>
                <View style={styles.passwordSectionHeaderRow}>
                  <Text style={styles.formSectionHeader}>KATA SANDI / PASSWORD</Text>
                  <Text style={styles.optionalBadge}>Opsional</Text>
                </View>
                <Text style={styles.passwordHintText}>
                  Kosongkan kolom kata sandi di bawah jika Anda tidak ingin mengubah password saat ini.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Kata Sandi Baru</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.neutral.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={formNewPassword}
                      onChangeText={setFormNewPassword}
                      secureTextEntry={!showPassword}
                      placeholder="Minimal 6 karakter"
                      placeholderTextColor={colors.neutral.textMuted}
                      autoCapitalize="none"
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={8}
                      style={styles.eyeBtn}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={18}
                        color={colors.neutral.textSecondary}
                      />
                    </Pressable>
                  </View>
                </View>

                {formNewPassword.length > 0 && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Konfirmasi Kata Sandi Baru <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="shield-checkmark-outline" size={18} color={colors.neutral.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        value={formConfirmPassword}
                        onChangeText={setFormConfirmPassword}
                        secureTextEntry={!showPassword}
                        placeholder="Ulangi kata sandi baru"
                        placeholderTextColor={colors.neutral.textMuted}
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Save & Cancel Buttons (Pinned at bottom, not blocked by keyboard) */}
            <View style={styles.modalActionRow}>
              <ModernButton
                title="Batal"
                variant="secondary"
                size="lg"
                onPress={() => setEditModalVisible(false)}
                style={{ flex: 1 }}
              />
              <ModernButton
                title="Simpan"
                variant="primary"
                size="lg"
                loading={savingProfile}
                onPress={handleSaveProfile}
                icon={<Ionicons name="save-outline" size={18} color={colors.neutral.white} />}
                style={{ flex: 1.5 }}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screen,
    paddingBottom: 80,
  },
  userCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: spacing.cardGap,
  },
  userCardPressed: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
    opacity: 0.9,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primary[700],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.neutral.white,
  },
  userCol: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: colors.neutral.textSmall,
    marginTop: 2,
  },
  badgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  editHintBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  editHintText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primary[800],
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.neutral.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  apiBox: {
    backgroundColor: colors.neutral.canvas,
    borderRadius: radius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginTop: 4,
  },
  apiLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  apiSub: {
    fontSize: 11,
    color: colors.neutral.textSmall,
    marginTop: 2,
    marginBottom: 8,
  },
  apiRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  apiInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.neutral.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.border,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.neutral.textSmall,
    fontWeight: "500",
  },
  metaVal: {
    fontSize: 12,
    color: colors.neutral.textPrimary,
    fontWeight: "600",
  },
  roleDemoBox: {
    marginTop: 4,
  },
  roleDemoLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.neutral.textSmall,
    marginBottom: 8,
  },
  roleBtnRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.button,
    backgroundColor: colors.neutral.canvas,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: "center",
    justifyContent: "center",
  },
  roleBtnActive: {
    backgroundColor: colors.primary[700],
    borderColor: colors.primary[700],
  },
  roleBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textSmall,
  },
  roleBtnTextActive: {
    color: colors.neutral.white,
  },
  logoutCard: {
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
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
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.border,
    backgroundColor: colors.neutral.surface,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  modalHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.neutral.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    flex: 1,
    backgroundColor: colors.neutral.canvas,
  },
  modalScrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  formSectionBox: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    ...shadows.soft,
  },
  formSectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: colors.primary[800],
    marginBottom: spacing.md,
  },
  passwordSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  optionalBadge: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    backgroundColor: colors.neutral.canvas,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  passwordHintText: {
    fontSize: 12,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: colors.status.conflict,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    backgroundColor: colors.neutral.surface,
    paddingHorizontal: spacing.md,
    minHeight: 46,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: colors.neutral.textPrimary,
    paddingVertical: 10,
  },
  eyeBtn: {
    padding: 6,
  },
  modalActionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  pressedOpacity: {
    opacity: 0.7,
  },
});
