import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Platform,
  Keyboard,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { colors, radius, shadows, spacing } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "../ui/AppHeader";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  rightAction?: React.ReactNode;
  headerChildren?: React.ReactNode;
  noHeader?: boolean;
  hideBottomDock?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  title,
  subtitle,
  showBack = false,
  onBack,
  onAdd,
  addLabel = "Tambah",
  rightAction,
  headerChildren,
  noHeader = false,
  hideBottomDock = false,
}) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 768;
  const pathname = usePathname();
  const { user, role, logoutAsync, switchRoleDemoAsync } = useAuth();

  // Normalisasi rute pathname agar kompatibel dengan group route Expo Router /(app)/ atau /(public)/
  const normalizeRoute = (pathStr: string): string => {
    if (!pathStr) return "/";
    let cleaned = pathStr.replace(/\/\([^)]+\)/g, "");
    if (cleaned.length > 1 && cleaned.endsWith("/")) {
      cleaned = cleaned.slice(0, -1);
    }
    if (cleaned.endsWith("/index")) {
      cleaned = cleaned.slice(0, -6) || "/";
    }
    return cleaned || "/";
  };

  const currentPath = normalizeRoute(pathname);
  const [confirmLogoutVisible, setConfirmLogoutVisible] = React.useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = React.useState(false);

  React.useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleLogout = async () => {
    setConfirmLogoutVisible(false);
    await logoutAsync();
    router.replace("/(public)/login");
  };

  const isItemActive = (route: string, label: string): boolean => {
    const target = normalizeRoute(route);

    // 1. Beranda / Dashboard
    if (label === "Beranda" || label === "Dashboard" || target === "/dashboard") {
      return currentPath === "/dashboard" || currentPath === "/";
    }

    // 2. Data / Data Madrasah (Mencakup Siswa dan Pegawai/Guru/Tendik)
    if (label === "Data" || label === "Data Madrasah" || label === "Siswa") {
      return currentPath.startsWith("/siswa") || currentPath.startsWith("/pegawai");
    }

    // 3. Kelas / Kelas Saya
    if (label === "Kelas" || label === "Kelas Saya" || target === "/kelas") {
      return currentPath.startsWith("/kelas");
    }

    // 4. Surat / Administrasi Surat
    if (label === "Surat" || label === "Administrasi Surat" || target === "/surat") {
      return currentPath.startsWith("/surat");
    }

    // 5. Profil Saya
    if (label === "Profil Saya" || target === "/profil-saya") {
      return currentPath.startsWith("/profil-saya");
    }

    // 6. Mobile Tab "Lainnya" (Mencakup Pengaturan, Pengguna, Tahun Ajaran, Mapel, CMS, Data-IO, Dev)
    if (label === "Lainnya") {
      return (
        currentPath.startsWith("/pengaturan") ||
        currentPath.startsWith("/pengguna") ||
        currentPath.startsWith("/tahun-ajaran") ||
        currentPath.startsWith("/mata-pelajaran") ||
        currentPath.startsWith("/cms") ||
        currentPath.startsWith("/data-io") ||
        currentPath.startsWith("/dev")
      );
    }

    // 7. Desktop specific menu items
    if (target === "/tahun-ajaran") return currentPath.startsWith("/tahun-ajaran");
    if (target === "/mata-pelajaran") return currentPath.startsWith("/mata-pelajaran");
    if (target === "/cms") return currentPath.startsWith("/cms");
    if (target === "/data-io") return currentPath.startsWith("/data-io");
    if (target === "/pengguna") return currentPath.startsWith("/pengguna");
    if (target === "/pengaturan") return currentPath.startsWith("/pengaturan") || currentPath.startsWith("/dev");

    // 8. Halaman Publik
    if (label === "Login" || target === "/login") {
      return currentPath.startsWith("/login");
    }
    if (label === "Berita") {
      return currentPath.startsWith("/cms") || currentPath.startsWith("/berita");
    }
    if (label === "Pengumuman") {
      return currentPath.startsWith("/pengumuman");
    }

    return currentPath === target || (target !== "/" && currentPath.startsWith(target));
  };

  // Desktop Sidebar Navigation Items (Role-filtered)
  const desktopNavItems = [
    { label: "Dashboard", route: "/(app)/dashboard", icon: "home-outline" as const, minRole: "all" },
    { label: "Data Madrasah", route: "/(app)/siswa", icon: "people-outline" as const, minRole: "tu_admin" },
    {
      label: role === "guru" ? "Kelas Saya" : "Kelas & Rombel",
      route: "/(app)/kelas",
      icon: "school-outline" as const,
      minRole: "all",
    },
    { label: "Administrasi Surat", route: "/(app)/surat", icon: "mail-outline" as const, minRole: "tu_admin" },
    { label: "Profil Saya", route: "/(app)/profil-saya", icon: "person-outline" as const, minRole: "authenticated" },
    { label: "Tahun Ajaran", route: "/(app)/tahun-ajaran", icon: "calendar-outline" as const, minRole: "tu_admin" },
    { label: "Mata Pelajaran", route: "/(app)/mata-pelajaran", icon: "book-outline" as const, minRole: "tu_admin" },
    { label: "CMS & Publikasi", route: "/(app)/cms", icon: "newspaper-outline" as const, minRole: "tu_admin" },
    { label: "Eksport & Import", route: "/(app)/data-io", icon: "swap-vertical-outline" as const, minRole: "tu_admin" },
    { label: "Manajemen Akun", route: "/(app)/pengguna", icon: "shield-checkmark-outline" as const, minRole: "admin_only" },
    { label: "Pengaturan & Lainnya", route: "/(app)/pengaturan", icon: "settings-outline" as const, minRole: "tu_admin" },
  ];

  const filteredDesktopNav = desktopNavItems.filter((item) => {
    if (item.minRole === "all") return true;
    if (item.minRole === "authenticated") return role !== "guest";
    if (item.minRole === "tu_admin") return role === "super_admin" || role === "staf_tu";
    if (item.minRole === "admin_only") return role === "super_admin";
    return false;
  });

  // Mobile Bottom Tab Items per Role (UI/UX Guideline Bagian 2)
  // Maksimal 5 item (ikon + label)
  const getMobileTabs = () => {
    if (role === "super_admin" || role === "staf_tu") {
      return [
        { label: "Beranda", route: "/(app)/dashboard", icon: "home-outline" as const, activeIcon: "home" as const },
        { label: "Data", route: "/(app)/siswa", icon: "people-outline" as const, activeIcon: "people" as const },
        { label: "Kelas", route: "/(app)/kelas", icon: "school-outline" as const, activeIcon: "school" as const },
        { label: "Surat", route: "/(app)/surat", icon: "mail-outline" as const, activeIcon: "mail" as const },
        { label: "Lainnya", route: "/(app)/pengaturan", icon: "grid-outline" as const, activeIcon: "grid" as const },
      ];
    }

    if (role === "guru") {
      return [
        { label: "Beranda", route: "/(app)/dashboard", icon: "home-outline" as const, activeIcon: "home" as const },
        { label: "Kelas Saya", route: "/(app)/kelas", icon: "school-outline" as const, activeIcon: "school" as const },
        { label: "Profil Saya", route: "/(app)/profil-saya", icon: "person-outline" as const, activeIcon: "person" as const },
      ];
    }

    // Role Publik
    return [
      { label: "Beranda", route: "/(public)", icon: "home-outline" as const, activeIcon: "home" as const },
      { label: "Berita", route: "/(public)/cms", icon: "newspaper-outline" as const, activeIcon: "newspaper" as const },
      { label: "Pengumuman", route: "/(public)/cms", icon: "megaphone-outline" as const, activeIcon: "megaphone" as const },
      { label: "Login", route: "/(public)/login", icon: "log-in-outline" as const, activeIcon: "log-in" as const },
    ];
  };

  const mobileTabs = getMobileTabs();

  const getRoleBadge = (r: string) => {
    switch (r) {
      case "super_admin":
        return { label: "Super Admin", bg: colors.primary[50], text: colors.primary[800] };
      case "staf_tu":
        return { label: "Staf TU", bg: colors.primary[100], text: colors.primary[800] };
      case "guru":
        return { label: "Guru", bg: colors.accent.goldLight, text: colors.neutral.textPrimary }; // Teks di atas latar emas = #1F2937
      default:
        return { label: "Publik", bg: colors.neutral.surfaceHover, text: colors.neutral.textSmall };
    }
  };

  const roleInfo = getRoleBadge(role);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.container}>
        {/* DESKTOP SIDEBAR (>= 768px) */}
        {isDesktop && (
          <View style={styles.sidebar}>
            {/* Header Brand */}
            <View style={styles.sidebarHeader}>
              <View style={styles.logoBadge}>
                <Ionicons name="school" size={24} color={colors.primary[700]} />
              </View>
              <View style={styles.brandCol}>
                <Text style={styles.brandTitle} numberOfLines={1}>
                  MTs RTH
                </Text>
                <Text style={styles.brandSubtitle}>Local-First System</Text>
              </View>
            </View>

            {/* User Profile Card */}
            <View style={styles.userCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                </Text>
              </View>
              <View style={styles.userCol}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.name || "Pengguna"}
                </Text>
                <View style={[styles.rolePill, { backgroundColor: roleInfo.bg }]}>
                  <Text style={[styles.roleText, { color: roleInfo.text }]}>{roleInfo.label}</Text>
                </View>
              </View>
            </View>

            {/* Navigation Links */}
            <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
              <Text style={styles.menuHeading}>NAVIGASI UTAMA</Text>
              {filteredDesktopNav.map((item) => {
                const isActive = isItemActive(item.route, item.label);
                return (
                  <Pressable
                    key={item.route}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => router.push(item.route as any)}
                    style={({ pressed }) => [
                      styles.navItem,
                      isActive && styles.navItemActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={isActive ? colors.primary[800] : colors.neutral.textSecondary}
                    />
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Quick Demo Role Switcher */}
            <View style={styles.demoSection}>
              <Text style={styles.demoHeading}>SWITCH ROLE (DEMO)</Text>
              <View style={styles.demoBtnRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => switchRoleDemoAsync("super_admin")}
                  style={[styles.demoBtn, role === "super_admin" && styles.demoBtnActive]}
                >
                  <Text
                    style={[styles.demoBtnText, role === "super_admin" && styles.demoBtnTextActive]}
                  >
                    Admin
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => switchRoleDemoAsync("staf_tu")}
                  style={[styles.demoBtn, role === "staf_tu" && styles.demoBtnActive]}
                >
                  <Text
                    style={[styles.demoBtnText, role === "staf_tu" && styles.demoBtnTextActive]}
                  >
                    TU
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => switchRoleDemoAsync("guru")}
                  style={[styles.demoBtn, role === "guru" && styles.demoBtnActive]}
                >
                  <Text
                    style={[styles.demoBtnText, role === "guru" && styles.demoBtnTextActive]}
                  >
                    Guru
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Logout Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keluar Sesi"
              onPress={() => setConfirmLogoutVisible(true)}
              style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.status.conflict} />
              <Text style={styles.logoutText}>Keluar Sesi</Text>
            </Pressable>
          </View>
        )}

        {/* MAIN BODY AREA */}
        <View style={styles.main}>
          {/* Top Header */}
          {!noHeader && (
            <AppHeader
              title={title || "MTs Roudhotut Thowalib"}
              subtitle={subtitle}
              showBack={showBack}
              onBack={onBack}
              onAdd={onAdd}
              addLabel={addLabel}
              rightAction={rightAction}
            >
              {headerChildren}
            </AppHeader>
          )}

          {/* Page Content: Centered on desktop, constrained to max-w-4xl (896px) */}
          <View style={[styles.contentArea, isDesktop && styles.desktopContentArea]}>
            {children}
          </View>

          {/* MOBILE BOTTOM DOCK (< 768px): disembunyikan otomatis saat keyboard muncul agar tombol/form bawah tidak terhalang */}
          {!isDesktop && !hideBottomDock && !isKeyboardVisible && (
            <View
              style={[
                styles.bottomDock,
                { paddingBottom: Math.max(insets.bottom, 10) },
              ]}
            >
              {mobileTabs.map((tab) => {
                const isActive = isItemActive(tab.route, tab.label);
                return (
                  <Pressable
                    key={tab.label}
                    accessibilityRole="tab"
                    accessibilityLabel={tab.label}
                    accessibilityState={{ selected: isActive }}
                    onPress={() => router.push(tab.route as any)}
                    style={({ pressed }) => [styles.dockItem, pressed && styles.pressed]}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <View style={[styles.dockIconPill, isActive && styles.dockIconPillActive]}>
                      <Ionicons
                        name={isActive ? tab.activeIcon : tab.icon}
                        size={20}
                        color={isActive ? colors.primary[800] : colors.neutral.textSecondary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.dockLabel,
                        isActive && styles.dockLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.neutral.canvas,
  },
  sidebar: {
    width: 250,
    backgroundColor: colors.neutral.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.neutral.border,
    paddingHorizontal: 16,
    paddingVertical: 18,
    justifyContent: "space-between",
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  brandCol: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
  },
  brandSubtitle: {
    fontSize: 11,
    color: colors.neutral.textSmall,
    fontWeight: "500",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.canvas,
    borderRadius: radius.card,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary[700],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.neutral.white,
    fontWeight: "700",
    fontSize: 14,
  },
  userCol: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  rolePill: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  roleText: {
    fontSize: 10,
    fontWeight: "600",
  },
  menuHeading: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral.textSmall,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 6,
  },
  navList: {
    flex: 1,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.button,
    marginBottom: 4,
    gap: 12,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  navItemActive: {
    backgroundColor: colors.primary[100],
    borderLeftColor: colors.primary[700],
  },
  navLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.neutral.textSecondary,
  },
  navLabelActive: {
    color: colors.primary[900],
    fontWeight: "700",
  },
  demoSection: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    paddingTop: 10,
    marginBottom: 10,
  },
  demoHeading: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.neutral.textSmall,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  demoBtnRow: {
    flexDirection: "row",
    gap: 6,
  },
  demoBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radius.xs,
    backgroundColor: colors.neutral.canvas,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: "center",
  },
  demoBtnActive: {
    backgroundColor: colors.primary[700],
    borderColor: colors.primary[700],
  },
  demoBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral.textSmall,
  },
  demoBtnTextActive: {
    color: colors.neutral.white,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.button,
    backgroundColor: colors.status.conflictBg,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.status.conflict,
  },
  main: {
    flex: 1,
    backgroundColor: colors.neutral.canvas,
    display: "flex",
    flexDirection: "column",
  },
  contentArea: {
    flex: 1,
    width: "100%",
  },
  desktopContentArea: {
    maxWidth: 896, // max-w-4xl
    alignSelf: "center",
  },
  bottomDock: {
    backgroundColor: colors.neutral.surface,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 6,
    ...shadows.soft,
  },
  dockItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minHeight: 52, // Target sentuh minimal 48dp
    gap: 3,
  },
  dockIconPill: {
    minWidth: 48,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  dockIconPillActive: {
    backgroundColor: colors.primary[100], // #CCFBF1 (Warna latar aktif berbeda - soft primary teal)
  },
  dockLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.neutral.textSecondary,
  },
  dockLabelActive: {
    color: colors.primary[800], // #115E59 (Warna teks aktif berbeda - brand teal tajam)
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.75,
  },
});
