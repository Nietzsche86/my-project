import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, radii, shadows, spacing } from "../../../theme";
import { useAuth, RoleType } from "../../../context/AuthContext";
import { useSync } from "../../../context/SyncContext";
import { useAlert } from "../../../context/AlertContext";
import { AppShell } from "../../../components/layout/AppShell";
import {
  ModernCard,
  ModernButton,
  Badge,
  SearchBar,
  EmptyState,
  FAB,
  ConfirmDialog,
  useToast,
  BottomSheetPicker,
  PickerItem,
} from "../../../components/ui";
import { db } from "../../../db/client";
import { users, pegawai, type User, type Pegawai } from "../../../db/schema";
import { eq, and, isNull, ne, sql } from "drizzle-orm";
import { hashPassword, generateUUID, getIsoUtcString } from "../../../db/crypto";

interface UserWithPegawai extends User {
  pegawai_nama?: string | null;
  pegawai_nip?: string | null;
  pegawai_jabatan?: string | null;
  pegawai_jenis?: string | null;
}

type RoleFilter = "Semua" | "super_admin" | "staf_tu" | "guru";

export default function ManajemenPenggunaScreen() {
  const { user: currentUser, role, refreshCurrentUserAsync } = useAuth();
  const { refreshPendingCountAsync, apiUrl } = useSync();
  const { showToast } = useToast();
  const { showAlert } = useAlert();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 768;

  const isSuperAdmin = role === "super_admin";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userList, setUserList] = useState<UserWithPegawai[]>([]);
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<RoleFilter>("Semua");

  // Edit User Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithPegawai | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<"super_admin" | "staf_tu" | "guru">("guru");
  const [formPegawaiId, setFormPegawaiId] = useState<string | null>(null);
  const [formNewPassword, setFormNewPassword] = useState("");
  const [formConfirmPassword, setFormConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Add User Modal State
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"super_admin" | "staf_tu" | "guru">("guru");
  const [addPegawaiId, setAddPegawaiId] = useState<string | null>(null);
  const [addPassword, setAddPassword] = useState("");
  const [addConfirmPassword, setAddConfirmPassword] = useState("");
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);

  // Pegawai Picker BottomSheet State
  const [pegawaiPickerVisible, setPegawaiPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"edit" | "add">("edit");

  // Delete User Confirm State
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithPegawai | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Baca seluruh pengguna yang belum di-soft-delete
      const rawUsers = await db
        .select()
        .from(users)
        .where(isNull(users.deleted_at));

      // Baca data master pegawai untuk referensi NIP & nama
      const rawPegawai = await db
        .select()
        .from(pegawai)
        .where(isNull(pegawai.deleted_at));
      setPegawaiList(rawPegawai);

      const pegawaiMap = new Map<string, Pegawai>();
      rawPegawai.forEach((p) => pegawaiMap.set(p.id, p));

      const enriched: UserWithPegawai[] = rawUsers.map((u) => {
        const p = u.pegawai_id ? pegawaiMap.get(u.pegawai_id) : undefined;
        return {
          ...u,
          pegawai_nama: p?.nama_lengkap || null,
          pegawai_nip: p?.nip || null,
          pegawai_jabatan: p?.jabatan || null,
          pegawai_jenis: p?.jenis || null,
        };
      });

      setUserList(enriched);
    } catch (err) {
      console.warn("Gagal memuat daftar pengguna:", err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return userList.filter((item) => {
      // 1. Filter Role
      if (selectedRoleFilter !== "Semua" && item.role !== selectedRoleFilter) {
        return false;
      }

      // 2. Filter Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchEmail = item.email.toLowerCase().includes(q);
        const matchPegawaiNama = (item.pegawai_nama || "").toLowerCase().includes(q);
        const matchNip = (item.pegawai_nip || "").toLowerCase().includes(q);
        return matchName || matchEmail || matchPegawaiNama || matchNip;
      }

      return true;
    });
  }, [userList, selectedRoleFilter, searchQuery]);

  // Role Counts for Stat Badges
  const roleCounts = useMemo(() => {
    let superAdmin = 0;
    let stafTu = 0;
    let guru = 0;
    userList.forEach((u) => {
      if (u.role === "super_admin") superAdmin++;
      else if (u.role === "staf_tu") stafTu++;
      else if (u.role === "guru") guru++;
    });
    return {
      total: userList.length,
      superAdmin,
      stafTu,
      guru,
    };
  }, [userList]);

  // Open Edit Modal
  const openEditModal = (target: UserWithPegawai) => {
    setEditingUser(target);
    setFormName(target.name);
    setFormEmail(target.email);
    setFormRole(target.role as any);
    setFormPegawaiId(target.pegawai_id || null);
    setFormNewPassword("");
    setFormConfirmPassword("");
    setShowPassword(false);
    setEditModalVisible(true);
  };

  // Open Add Modal
  const openAddModal = () => {
    setAddName("");
    setAddEmail("");
    setAddRole("guru");
    setAddPegawaiId(null);
    setAddPassword("");
    setAddConfirmPassword("");
    setShowAddPassword(false);
    setAddModalVisible(true);
  };

  // Pegawai Picker Items
  const pegawaiPickerItems: PickerItem[] = useMemo(() => {
    const list: PickerItem[] = [
      { id: "none", label: "(Tanpa Hubungan Pegawai)", subtitle: "Akun mandiri / luar" },
    ];
    pegawaiList.forEach((p) => {
      list.push({
        id: p.id,
        label: p.nama_lengkap,
        subtitle: `${p.jenis === "guru" ? "Guru" : "Tenaga Kependidikan"} • NIP: ${p.nip || "-"}`,
      });
    });
    return list;
  }, [pegawaiList]);

  const handleSelectPegawai = (item: PickerItem) => {
    const targetId = item.id === "none" ? null : item.id;
    if (pickerTarget === "edit") {
      setFormPegawaiId(targetId);
      // Jika nama akun masih kosong, otomatis isi dengan nama pegawai
      if (targetId && !formName) {
        const found = pegawaiList.find((p) => p.id === targetId);
        if (found) setFormName(found.nama_lengkap);
      }
    } else {
      setAddPegawaiId(targetId);
      if (targetId && !addName) {
        const found = pegawaiList.find((p) => p.id === targetId);
        if (found) setAddName(found.nama_lengkap);
      }
    }
    setPegawaiPickerVisible(false);
  };

  // Simpan Pembaruan Akun (Ganti Email & Password)
  const handleSaveEdit = async () => {
    if (!editingUser) return;

    const cleanName = formName.trim();
    const cleanEmail = formEmail.trim().toLowerCase();

    if (!cleanName) {
      showAlert({
        title: "Nama Wajib Diisi",
        message: "Silakan masukkan nama lengkap akun pengguna.",
        type: "warning",
      });
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      showAlert({
        title: "Email Tidak Valid",
        message: "Silakan masukkan alamat email yang valid untuk login pengguna.",
        type: "warning",
      });
      return;
    }

    // Validasi Password jika diisi
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
          title: "Konfirmasi Sandi Berbeda",
          message: "Kata sandi baru dan konfirmasi kata sandi tidak cocok. Mohon periksa kembali.",
          type: "warning",
        });
        return;
      }
    }

    try {
      setSavingEdit(true);

      // Cek apakah email baru sudah dipakai oleh akun lain
      const duplicate = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.email, cleanEmail),
            ne(users.id, editingUser.id),
            isNull(users.deleted_at)
          )
        )
        .limit(1);

      if (duplicate.length > 0) {
        showAlert({
          title: "Email Sudah Terdaftar",
          message: `Email '${cleanEmail}' telah digunakan oleh akun lain. Silakan pilih alamat email lain.`,
          type: "error",
        });
        setSavingEdit(false);
        return;
      }

      const now = getIsoUtcString();
      const userUpdate: any = {
        name: cleanName,
        email: cleanEmail,
        role: formRole,
        pegawai_id: formPegawaiId,
        updated_at: now,
        sync_status: "pending_push",
        version: (editingUser.version || 1) + 1,
      };

      if (formNewPassword) {
        userUpdate.password_hash = await hashPassword(formNewPassword);
      }

      await db.update(users).set(userUpdate).where(eq(users.id, editingUser.id));

      // Jika terhubung ke pegawai, perbarui nama & email pegawai agar sinkron
      if (formPegawaiId) {
        await db
          .update(pegawai)
          .set({
            nama_lengkap: cleanName,
            email: cleanEmail,
            updated_at: now,
            sync_status: "pending_push",
            version: sql`version + 1`,
          })
          .where(eq(pegawai.id, formPegawaiId));
      }

      // Jika yang diedit adalah akun Super Admin yang sedang login saat ini, refresh sesi
      if (currentUser?.id === editingUser.id) {
        await refreshCurrentUserAsync();
      }

      // Beri notifikasi ke backend jika server tersedia (background sync)
      try {
        const backendHost = apiUrl || process.env.EXPO_PUBLIC_API_URL || "http://10.87.253.15:3000";
        fetch(`${backendHost}/api/auth/update-account`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldEmail: editingUser.email,
            newEmail: cleanEmail,
            name: cleanName,
            password: formNewPassword || undefined,
            role: formRole,
            pegawai_id: formPegawaiId,
          }),
        }).catch(() => {});
      } catch {}

      await refreshPendingCountAsync();
      await loadData();
      setEditModalVisible(false);

      const msg = formNewPassword
        ? `Email dan kata sandi akun '${cleanName}' berhasil diperbarui!`
        : `Data akun '${cleanName}' berhasil diperbarui!`;
      showToast(msg);
    } catch (err: any) {
      showAlert({
        title: "Gagal Menyimpan Akun",
        message: err?.message || "Terjadi kesalahan sistem saat memperbarui akun.",
        type: "error",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // Tambah Akun Pengguna Baru
  const handleSaveAdd = async () => {
    const cleanName = addName.trim();
    const cleanEmail = addEmail.trim().toLowerCase();

    if (!cleanName) {
      showAlert({
        title: "Nama Wajib Diisi",
        message: "Silakan masukkan nama lengkap akun pengguna baru.",
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

    if (!addPassword) {
      showAlert({
        title: "Kata Sandi Wajib Diisi",
        message: "Silakan buat kata sandi untuk akun baru ini (minimal 6 karakter).",
        type: "warning",
      });
      return;
    }

    if (addPassword.length < 6) {
      showAlert({
        title: "Kata Sandi Terlalu Pendek",
        message: "Kata sandi minimal harus 6 karakter.",
        type: "warning",
      });
      return;
    }

    if (addPassword !== addConfirmPassword) {
      showAlert({
        title: "Konfirmasi Sandi Berbeda",
        message: "Kata sandi dan konfirmasi kata sandi tidak cocok. Silakan periksa kembali.",
        type: "warning",
      });
      return;
    }

    try {
      setSavingAdd(true);

      // Cek apakah email sudah terdaftar
      const exists = await db
        .select()
        .from(users)
        .where(and(eq(users.email, cleanEmail), isNull(users.deleted_at)))
        .limit(1);

      if (exists.length > 0) {
        showAlert({
          title: "Email Sudah Terdaftar",
          message: `Email '${cleanEmail}' sudah digunakan akun lain. Silakan gunakan email lain.`,
          type: "error",
        });
        setSavingAdd(false);
        return;
      }

      const now = getIsoUtcString();
      const pHash = await hashPassword(addPassword);
      const newId = generateUUID();

      await db.insert(users).values({
        id: newId,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        sync_status: "pending_push",
        last_synced_at: null,
        version: 1,
        name: cleanName,
        email: cleanEmail,
        password_hash: pHash,
        role: addRole,
        pegawai_id: addPegawaiId || null,
      });

      // Sinkronisasi info pegawai jika terhubung
      if (addPegawaiId) {
        await db
          .update(pegawai)
          .set({
            nama_lengkap: cleanName,
            email: cleanEmail,
            updated_at: now,
            sync_status: "pending_push",
            version: sql`version + 1`,
          })
          .where(eq(pegawai.id, addPegawaiId));
      }

      // Beri notifikasi ke backend jika server tersedia
      try {
        const backendHost = apiUrl || process.env.EXPO_PUBLIC_API_URL || "http://10.87.253.15:3000";
        fetch(`${backendHost}/api/auth/update-account`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldEmail: cleanEmail,
            newEmail: cleanEmail,
            name: cleanName,
            password: addPassword,
            role: addRole,
            pegawai_id: addPegawaiId,
          }),
        }).catch(() => {});
      } catch {}

      await refreshPendingCountAsync();
      await loadData();
      setAddModalVisible(false);
      showToast(`Akun pengguna '${cleanName}' berhasil dibuat!`);
    } catch (err: any) {
      showAlert({
        title: "Gagal Menambah Akun",
        message: err?.message || "Terjadi kesalahan sistem saat membuat akun pengguna.",
        type: "error",
      });
    } finally {
      setSavingAdd(false);
    }
  };

  // Konfirmasi & Hapus Akun (Soft-delete)
  const confirmDeleteUser = (target: UserWithPegawai) => {
    if (target.id === currentUser?.id) {
      showAlert({
        title: "Aksi Ditolak",
        message: "Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.",
        type: "warning",
      });
      return;
    }
    setUserToDelete(target);
    setDeleteConfirmVisible(true);
  };

  const executeDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleteConfirmVisible(false);

    try {
      const now = getIsoUtcString();
      await db
        .update(users)
        .set({
          deleted_at: now,
          sync_status: "pending_push",
          updated_at: now,
          version: sql`version + 1`,
        })
        .where(eq(users.id, userToDelete.id));

      await refreshPendingCountAsync();
      await loadData();
      showToast(`Akun '${userToDelete.name}' berhasil dinonaktifkan/dihapus.`);
    } catch (err: any) {
      showAlert({
        title: "Gagal Menghapus Akun",
        message: err?.message || "Terjadi kesalahan saat menghapus akun pengguna.",
        type: "error",
      });
    } finally {
      setUserToDelete(null);
    }
  };

  // Helper Badge & Style Peran
  const getRoleBadgeConfig = (r: string) => {
    switch (r) {
      case "super_admin":
        return {
          label: "SUPER ADMIN",
          variant: "primary" as const,
          bg: colors.primary[50],
          text: colors.primary[800],
          icon: "shield-checkmark" as const,
        };
      case "staf_tu":
        return {
          label: "STAF TU",
          variant: "neutral" as const,
          bg: colors.accent.indigoLight,
          text: colors.accent.indigo,
          icon: "briefcase" as const,
        };
      case "guru":
        return {
          label: "GURU",
          variant: "gold" as const,
          bg: colors.accent.goldLight,
          text: colors.neutral.textPrimary,
          icon: "school" as const,
        };
      default:
        return {
          label: "PENGGUNA",
          variant: "neutral" as const,
          bg: colors.neutral.surfaceHover,
          text: colors.neutral.textSmall,
          icon: "person" as const,
        };
    }
  };

  // Proteksi Akses Khusus Super Admin
  if (!isSuperAdmin) {
    return (
      <AppShell title="Akses Ditolak" subtitle="MTs Roudhotut Thowalib">
        <View style={styles.deniedContainer}>
          <EmptyState
            icon="lock-closed-outline"
            title="Akses Eksklusif Super Admin"
            message="Menu Manajemen Pengguna dan ganti kata sandi seluruh peran hanya dapat diakses oleh akun Super Administrator."
            actionLabel="Kembali ke Dashboard"
            onAction={() => router.replace("/(app)/dashboard")}
          />
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Manajemen Pengguna"
      subtitle="Kelola Akun, Role, Email & Password"
      showBack={true}
      onBack={() => router.back()}
      onAdd={openAddModal}
      addLabel="Tambah Akun"
    >
      <View style={styles.container}>
        {/* HEADER: KARTU METRIK RINGKAS */}
        <View style={styles.metricRow}>
          <View style={[styles.metricCard, shadows.soft]}>
            <View style={[styles.metricIconWrap, { backgroundColor: colors.primary[50] }]}>
              <Ionicons name="people" size={18} color={colors.primary[700]} />
            </View>
            <View>
              <Text style={styles.metricVal}>{roleCounts.total}</Text>
              <Text style={styles.metricLabel}>Total Akun</Text>
            </View>
          </View>

          <View style={[styles.metricCard, shadows.soft]}>
            <View style={[styles.metricIconWrap, { backgroundColor: colors.primary[100] }]}>
              <Ionicons name="shield-checkmark" size={18} color={colors.primary[800]} />
            </View>
            <View>
              <Text style={styles.metricVal}>{roleCounts.superAdmin}</Text>
              <Text style={styles.metricLabel}>Admin</Text>
            </View>
          </View>

          <View style={[styles.metricCard, shadows.soft]}>
            <View style={[styles.metricIconWrap, { backgroundColor: colors.accent.indigoLight }]}>
              <Ionicons name="briefcase" size={18} color={colors.accent.indigo} />
            </View>
            <View>
              <Text style={styles.metricVal}>{roleCounts.stafTu}</Text>
              <Text style={styles.metricLabel}>Staf TU</Text>
            </View>
          </View>

          <View style={[styles.metricCard, shadows.soft]}>
            <View style={[styles.metricIconWrap, { backgroundColor: colors.accent.goldLight }]}>
              <Ionicons name="school" size={18} color={colors.accent.gold} />
            </View>
            <View>
              <Text style={styles.metricVal}>{roleCounts.guru}</Text>
              <Text style={styles.metricLabel}>Guru</Text>
            </View>
          </View>
        </View>

        {/* SEARCH BAR & FILTER CHIP */}
        <View style={styles.filterSection}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari nama, email, NIP pegawai..."
            onClear={() => setSearchQuery("")}
            style={styles.searchBar}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {(["Semua", "super_admin", "staf_tu", "guru"] as RoleFilter[]).map((filter) => {
              const isActive = selectedRoleFilter === filter;
              const label =
                filter === "Semua"
                  ? "Semua Peran"
                  : filter === "super_admin"
                  ? "Super Admin"
                  : filter === "staf_tu"
                  ? "Staf TU"
                  : "Guru";
              const count =
                filter === "Semua"
                  ? roleCounts.total
                  : filter === "super_admin"
                  ? roleCounts.superAdmin
                  : filter === "staf_tu"
                  ? roleCounts.stafTu
                  : roleCounts.guru;

              return (
                <Pressable
                  key={filter}
                  onPress={() => setSelectedRoleFilter(filter)}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {label}
                  </Text>
                  <View
                    style={[
                      styles.filterChipBadge,
                      isActive && styles.filterChipBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipBadgeText,
                        isActive && styles.filterChipBadgeTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* DAFTAR AKUN PENGGUNA */}
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: insets.bottom + 90 },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title={searchQuery ? "Tidak Ada Hasil" : "Belum Ada Pengguna"}
              message={
                searchQuery
                  ? `Tidak ditemukan akun dengan kata kunci "${searchQuery}".`
                  : "Belum ada akun pengguna madrasah terdaftar."
              }
              actionLabel={!searchQuery ? "+ Tambah Akun Baru" : undefined}
              onAction={!searchQuery ? openAddModal : undefined}
            />
          }
          renderItem={({ item }) => {
            const roleCfg = getRoleBadgeConfig(item.role);
            const isSelf = item.id === currentUser?.id;

            return (
              <ModernCard style={styles.userItemCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.userAvatar, { backgroundColor: roleCfg.bg }]}>
                    <Ionicons name={roleCfg.icon} size={20} color={roleCfg.text} />
                  </View>

                  <View style={styles.cardHeaderInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {isSelf && (
                        <View style={styles.selfBadge}>
                          <Text style={styles.selfBadgeText}>Akun Anda</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.emailRow}>
                      <Ionicons name="mail-outline" size={13} color={colors.neutral.textMuted} />
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {item.email}
                      </Text>
                    </View>
                  </View>

                  <Badge
                    label={roleCfg.label}
                    variant={roleCfg.variant}
                    size="sm"
                  />
                </View>

                {/* Hubungan Pegawai (jika terhubung) */}
                {item.pegawai_nama && (
                  <View style={styles.pegawaiTagBox}>
                    <Ionicons name="link-outline" size={13} color={colors.primary[700]} />
                    <Text style={styles.pegawaiTagText} numberOfLines={1}>
                      Pegawai: {item.pegawai_nama}{" "}
                      {item.pegawai_nip ? `(NIP: ${item.pegawai_nip})` : ""}
                    </Text>
                  </View>
                )}

                {/* Tombol Aksi */}
                <View style={styles.cardActionRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.btnActionEdit,
                      pressed && styles.btnActionPressed,
                    ]}
                    onPress={() => openEditModal(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ganti email dan password untuk ${item.name}`}
                  >
                    <Ionicons name="key-outline" size={15} color={colors.primary[700]} />
                    <Text style={styles.btnActionEditText}>Ganti Email & Password</Text>
                  </Pressable>

                  {!isSelf && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.btnActionDelete,
                        pressed && styles.btnActionPressed,
                      ]}
                      onPress={() => confirmDeleteUser(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Hapus akun ${item.name}`}
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.status.danger} />
                    </Pressable>
                  )}
                </View>
              </ModernCard>
            );
          }}
        />

        {/* FAB MOBILE */}
        <FAB
          iconName="add"
          onPress={openAddModal}
          accessibilityLabel="Tambah Akun Pengguna Baru"
        />
      </View>

      {/* ============================================================ */}
      {/* MODAL 1: EDIT AKUN (GANTI EMAIL & PASSWORD) */}
      {/* ============================================================ */}
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
                  <Ionicons name="key-outline" size={22} color={colors.primary[700]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Edit Akun & Keamanan</Text>
                  <Text style={styles.modalSub}>
                    Ganti email login, hak akses, atau setel ulang kata sandi
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                hitSlop={8}
                style={styles.modalCloseBtn}
                accessibilityLabel="Tutup dialog"
              >
                <Ionicons name="close" size={22} color={colors.neutral.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Pesan Otoritas Super Admin */}
              <View style={styles.adminNoticeBox}>
                <Ionicons name="shield-checkmark" size={18} color={colors.primary[700]} />
                <Text style={styles.adminNoticeText}>
                  Sebagai Super Admin, Anda memiliki hak penuh untuk mengganti email akun dan
                  mereset kata sandi peran lain jika guru atau operator lupa sandi login.
                </Text>
              </View>

              {/* 1. Nama Lengkap */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nama Lengkap Pengguna *</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={18} color={colors.neutral.textMuted} />
                  <TextInput
                    value={formName}
                    onChangeText={setFormName}
                    placeholder="Contoh: Muhammad Ilham, S.Pd."
                    placeholderTextColor={colors.neutral.textSubtle}
                    style={styles.inputField}
                  />
                </View>
              </View>

              {/* 2. Peran / Hak Akses Akun */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Peran Akun (Role) *</Text>
                <View style={styles.roleSelectorRow}>
                  {[
                    { key: "super_admin", label: "Super Admin", icon: "shield-checkmark" as const },
                    { key: "staf_tu", label: "Staf TU", icon: "briefcase" as const },
                    { key: "guru", label: "Guru", icon: "school" as const },
                  ].map((r) => {
                    const active = formRole === r.key;
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => setFormRole(r.key as any)}
                        style={[styles.roleSelectCard, active && styles.roleSelectCardActive]}
                      >
                        <Ionicons
                          name={r.icon}
                          size={18}
                          color={active ? colors.primary[700] : colors.neutral.textMuted}
                        />
                        <Text
                          style={[
                            styles.roleSelectText,
                            active && styles.roleSelectTextActive,
                          ]}
                        >
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 3. Alamat Email (GANTI EMAIL) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Alamat Email Masuk (Login) *</Text>
                <Text style={styles.fieldHint}>
                  Pengguna menggunakan email ini untuk masuk ke aplikasi mobile MTs RTH.
                </Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={colors.neutral.textMuted} />
                  <TextInput
                    value={formEmail}
                    onChangeText={setFormEmail}
                    placeholder="nama@mts-rth.sch.id"
                    placeholderTextColor={colors.neutral.textSubtle}
                    style={styles.inputField}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* 4. Hubungkan Data Pegawai */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Hubungkan ke Data Pegawai (Opsional)</Text>
                <Pressable
                  onPress={() => {
                    setPickerTarget("edit");
                    setPegawaiPickerVisible(true);
                  }}
                  style={styles.pickerSelectorBtn}
                >
                  <Ionicons name="person-circle-outline" size={20} color={colors.primary[700]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerSelectorText} numberOfLines={1}>
                      {formPegawaiId
                        ? pegawaiList.find((p) => p.id === formPegawaiId)?.nama_lengkap || "Pegawai Terpilih"
                        : "(Tidak terhubung ke profil pegawai)"}
                    </Text>
                    {formPegawaiId && (
                      <Text style={styles.pickerSelectorSub}>
                        NIP: {pegawaiList.find((p) => p.id === formPegawaiId)?.nip || "-"}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.neutral.textMuted} />
                </Pressable>
              </View>

              {/* 5. SEKSI GANTI KATA SANDI (PASSWORD) */}
              <View style={styles.passwordCard}>
                <View style={styles.passwordCardHeader}>
                  <View style={styles.passwordCardIconWrap}>
                    <Ionicons name="lock-closed" size={18} color={colors.accent.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.passwordCardTitle}>Setel Kata Sandi Baru</Text>
                    <Text style={styles.passwordCardSub}>
                      Kosongkan bagian ini jika Anda TIDAK ingin mengubah kata sandi akun ini.
                    </Text>
                  </View>
                </View>

                {/* Input Kata Sandi Baru */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Kata Sandi Baru (Opsional)</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="key-outline" size={18} color={colors.neutral.textMuted} />
                    <TextInput
                      value={formNewPassword}
                      onChangeText={setFormNewPassword}
                      placeholder="Masukkan kata sandi baru (min 6 karakter)"
                      placeholderTextColor={colors.neutral.textSubtle}
                      secureTextEntry={!showPassword}
                      style={styles.inputField}
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
                        color={colors.neutral.textMuted}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Input Konfirmasi Kata Sandi */}
                {formNewPassword.length > 0 && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Konfirmasi Kata Sandi Baru *</Text>
                    <View style={styles.inputWrap}>
                      <Ionicons name="checkmark-circle-outline" size={18} color={colors.neutral.textMuted} />
                      <TextInput
                        value={formConfirmPassword}
                        onChangeText={setFormConfirmPassword}
                        placeholder="Ketik ulang kata sandi baru"
                        placeholderTextColor={colors.neutral.textSubtle}
                        secureTextEntry={!showPassword}
                        style={styles.inputField}
                        autoCapitalize="none"
                      />
                    </View>
                    {formConfirmPassword.length > 0 && formNewPassword !== formConfirmPassword && (
                      <Text style={styles.passwordMismatchText}>
                        ⚠️ Kata sandi tidak cocok. Silakan periksa kembali.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Sticky Footer Buttons */}
            <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 12 }]}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                style={{ flex: 1 }}
                onPress={() => setEditModalVisible(false)}
              />
              <ModernButton
                title="Simpan Perubahan"
                variant="primary"
                size="md"
                loading={savingEdit}
                style={{ flex: 2 }}
                onPress={handleSaveEdit}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: TAMBAH AKUN PENGGUNA BARU */}
      {/* ============================================================ */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
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
                  <Ionicons name="person-add-outline" size={22} color={colors.primary[700]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Tambah Akun Baru</Text>
                  <Text style={styles.modalSub}>
                    Buat akun login madrasah untuk Guru, Staf TU, atau Admin
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setAddModalVisible(false)}
                hitSlop={8}
                style={styles.modalCloseBtn}
                accessibilityLabel="Tutup dialog"
              >
                <Ionicons name="close" size={22} color={colors.neutral.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* 1. Nama Lengkap */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nama Lengkap Pengguna *</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={18} color={colors.neutral.textMuted} />
                  <TextInput
                    value={addName}
                    onChangeText={setAddName}
                    placeholder="Contoh: Dra. Hj. Siti Maryam"
                    placeholderTextColor={colors.neutral.textSubtle}
                    style={styles.inputField}
                  />
                </View>
              </View>

              {/* 2. Peran / Hak Akses */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Peran Akun (Role) *</Text>
                <View style={styles.roleSelectorRow}>
                  {[
                    { key: "super_admin", label: "Super Admin", icon: "shield-checkmark" as const },
                    { key: "staf_tu", label: "Staf TU", icon: "briefcase" as const },
                    { key: "guru", label: "Guru", icon: "school" as const },
                  ].map((r) => {
                    const active = addRole === r.key;
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => setAddRole(r.key as any)}
                        style={[styles.roleSelectCard, active && styles.roleSelectCardActive]}
                      >
                        <Ionicons
                          name={r.icon}
                          size={18}
                          color={active ? colors.primary[700] : colors.neutral.textMuted}
                        />
                        <Text
                          style={[
                            styles.roleSelectText,
                            active && styles.roleSelectTextActive,
                          ]}
                        >
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 3. Email Masuk */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Alamat Email Masuk *</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={colors.neutral.textMuted} />
                  <TextInput
                    value={addEmail}
                    onChangeText={setAddEmail}
                    placeholder="nama@mts-rth.sch.id"
                    placeholderTextColor={colors.neutral.textSubtle}
                    style={styles.inputField}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* 4. Hubungkan Pegawai */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Hubungkan ke Data Pegawai (Opsional)</Text>
                <Pressable
                  onPress={() => {
                    setPickerTarget("add");
                    setPegawaiPickerVisible(true);
                  }}
                  style={styles.pickerSelectorBtn}
                >
                  <Ionicons name="person-circle-outline" size={20} color={colors.primary[700]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerSelectorText} numberOfLines={1}>
                      {addPegawaiId
                        ? pegawaiList.find((p) => p.id === addPegawaiId)?.nama_lengkap || "Pegawai Terpilih"
                        : "(Tidak terhubung ke profil pegawai)"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.neutral.textMuted} />
                </Pressable>
              </View>

              {/* 5. Kata Sandi Baru */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Kata Sandi Masuk *</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="key-outline" size={18} color={colors.neutral.textMuted} />
                  <TextInput
                    value={addPassword}
                    onChangeText={setAddPassword}
                    placeholder="Minimal 6 karakter"
                    placeholderTextColor={colors.neutral.textSubtle}
                    secureTextEntry={!showAddPassword}
                    style={styles.inputField}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => setShowAddPassword(!showAddPassword)}
                    hitSlop={8}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showAddPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={colors.neutral.textMuted}
                    />
                  </Pressable>
                </View>
              </View>

              {/* 6. Konfirmasi Kata Sandi */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Konfirmasi Kata Sandi *</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.neutral.textMuted} />
                  <TextInput
                    value={addConfirmPassword}
                    onChangeText={setAddConfirmPassword}
                    placeholder="Ketik ulang kata sandi"
                    placeholderTextColor={colors.neutral.textSubtle}
                    secureTextEntry={!showAddPassword}
                    style={styles.inputField}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </ScrollView>

            {/* Sticky Footer */}
            <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 12 }]}>
              <ModernButton
                title="Batal"
                variant="outline"
                size="md"
                style={{ flex: 1 }}
                onPress={() => setAddModalVisible(false)}
              />
              <ModernButton
                title="Buat Akun"
                variant="primary"
                size="md"
                loading={savingAdd}
                style={{ flex: 2 }}
                onPress={handleSaveAdd}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ============================================================ */}
      {/* PEGAWAI PICKER BOTTOM SHEET */}
      {/* ============================================================ */}
      <BottomSheetPicker
        visible={pegawaiPickerVisible}
        title="Pilih Profil Pegawai"
        items={pegawaiPickerItems}
        selectedId={pickerTarget === "edit" ? formPegawaiId : addPegawaiId}
        onSelect={handleSelectPegawai}
        onClose={() => setPegawaiPickerVisible(false)}
        placeholder="Cari nama pegawai atau NIP..."
      />

      {/* ============================================================ */}
      {/* DIALOG KONFIRMASI HAPUS / NONAKTIFKAN AKUN */}
      {/* ============================================================ */}
      <ConfirmDialog
        visible={deleteConfirmVisible}
        title="Nonaktifkan Akun Pengguna?"
        message={`Apakah Anda yakin ingin menonaktifkan akun '${userToDelete?.name}' (${userToDelete?.email})? Pengguna ini tidak akan dapat login lagi.`}
        confirmLabel="Ya, Nonaktifkan"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={executeDeleteUser}
        onCancel={() => {
          setDeleteConfirmVisible(false);
          setUserToDelete(null);
        }}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  deniedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  // Metric Row
  metricRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  metricVal: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.neutral.textMuted,
  },

  // Filter Section
  filterSection: {
    marginBottom: 12,
  },
  searchBar: {
    marginBottom: 8,
  },
  chipScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary[700],
    borderColor: colors.primary[700],
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  filterChipTextActive: {
    color: colors.neutral.white,
  },
  filterChipBadge: {
    backgroundColor: colors.neutral.surfaceHover,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  filterChipBadgeActive: {
    backgroundColor: colors.primary[800],
  },
  filterChipBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.neutral.textSmall,
  },
  filterChipBadgeTextActive: {
    color: colors.neutral.white,
  },

  // List & Cards
  listContainer: {
    paddingTop: 4,
  },
  userItemCard: {
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  cardHeaderInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
    flexShrink: 1,
  },
  selfBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  selfBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary[800],
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  userEmail: {
    fontSize: 13,
    color: colors.neutral.textMuted,
  },

  // Pegawai Tag
  pegawaiTagBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginTop: 8,
    gap: 6,
  },
  pegawaiTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primary[800],
    flex: 1,
  },

  // Card Action Row
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  btnActionEdit: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    gap: 6,
  },
  btnActionEditText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary[700],
  },
  btnActionDelete: {
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.status.cancelledBg,
  },
  btnActionPressed: {
    opacity: 0.7,
  },

  // Modal Styles
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: colors.neutral.textMuted,
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 16,
    gap: 16,
  },

  // Admin Notice
  adminNoticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary[50],
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    gap: 10,
  },
  adminNoticeText: {
    fontSize: 12,
    color: colors.primary[900],
    lineHeight: 18,
    flex: 1,
  },

  // Fields
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  fieldHint: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: -2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.canvas,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    color: colors.neutral.textPrimary,
    paddingVertical: 8,
  },
  eyeBtn: {
    padding: 6,
  },

  // Role Selector Row
  roleSelectorRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleSelectCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral.canvas,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    gap: 6,
  },
  roleSelectCardActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[700],
  },
  roleSelectText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral.textMuted,
  },
  roleSelectTextActive: {
    color: colors.primary[800],
    fontWeight: "700",
  },

  // Pegawai Picker Button
  pickerSelectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.canvas,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  pickerSelectorText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  pickerSelectorSub: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },

  // Password Card Section
  passwordCard: {
    backgroundColor: colors.accent.goldLight,
    borderWidth: 1,
    borderColor: colors.accent.goldBorder,
    borderRadius: radius.lg,
    padding: 14,
    gap: 12,
    marginTop: 4,
  },
  passwordCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  passwordCardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.neutral.white,
    justifyContent: "center",
    alignItems: "center",
  },
  passwordCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  passwordCardSub: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    marginTop: 1,
  },
  passwordMismatchText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.status.danger,
    marginTop: 2,
  },

  // Modal Footer
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    backgroundColor: colors.neutral.surface,
  },
});
