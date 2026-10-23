import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, radius, shadows, spacing } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { ModernButton } from "../../components/ui/ModernButton";
import { useDoubleBackToExit } from "../../hooks";
import { db } from "../../db/client";
import { users } from "../../db/schema";
import { isNull } from "drizzle-orm";

export default function LoginScreen() {
  useDoubleBackToExit({ alwaysIntercept: false });

  const [email, setEmail] = useState("admin@mts-rth.sch.id");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [demoAccounts, setDemoAccounts] = useState({
    admin: { email: "admin@mts-rth.sch.id", pass: "admin123" },
    tu: { email: "tu@mts-rth.sch.id", pass: "tu12345" },
    guru: { email: "guru@mts-rth.sch.id", pass: "guru12345" },
  });

  const { loginAsync, reseedDatabaseAsync } = useAuth();

  useEffect(() => {
    loadLatestUserEmails();
  }, []);

  const loadLatestUserEmails = async () => {
    try {
      const activeUsers = await db
        .select()
        .from(users)
        .where(isNull(users.deleted_at));

      if (activeUsers.length > 0) {
        setDemoAccounts((prev) => {
          const next = { ...prev };
          const uAdmin = activeUsers.find((u) => u.role === "super_admin");
          const uTu = activeUsers.find((u) => u.role === "staf_tu");
          const uGuru = activeUsers.find((u) => u.role === "guru");

          if (uAdmin) next.admin = { ...next.admin, email: uAdmin.email };
          if (uTu) next.tu = { ...next.tu, email: uTu.email };
          if (uGuru) next.guru = { ...next.guru, email: uGuru.email };
          return next;
        });
      }
    } catch {
      // Abaikan jika DB belum terinisialisasi
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg("Mohon masukkan email dan password");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await loginAsync(email, password);
    setLoading(false);

    if (res.success) {
      router.replace("/(app)/dashboard");
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg(null);
    setLoading(true);

    const res = await loginAsync(demoEmail, demoPass);
    setLoading(false);

    if (res.success) {
      router.replace("/(app)/dashboard");
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleResetDb = async () => {
    setLoading(true);
    try {
      await reseedDatabaseAsync();
      setErrorMsg(null);
      Alert.alert("Sukses", "Database lokal berhasil diisi ulang dengan data bawaan MTs RTH!");
    } catch (e: any) {
      Alert.alert("Peringatan", e?.message || "Gagal mengisi data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* BACK BUTTON */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali ke Beranda"
            onPress={() => router.replace("/(public)")}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.neutral.textSecondary} />
            <Text style={styles.backText}>Kembali ke Beranda</Text>
          </Pressable>

          {/* MAIN LOGIN CARD */}
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={styles.logoBadge}>
                <Ionicons name="shield-checkmark" size={32} color={colors.primary[700]} />
              </View>
              <Text style={styles.title}>Masuk ke Sistem</Text>
              <Text style={styles.subtitle}>
                Akses Database Madrasah MTs Roudhotut Thowalib (Offline-First)
              </Text>
            </View>

            {/* Error Message */}
            {errorMsg && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.status.conflict} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Form Fields */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Alamat Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color={colors.neutral.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    setErrorMsg(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="admin@mts-rth.sch.id"
                  placeholderTextColor={colors.neutral.textSubtle}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Kata Sandi</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.neutral.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    setErrorMsg(null);
                  }}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={colors.neutral.textSubtle}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Submit Button */}
            <ModernButton
              title="Masuk Sekarang"
              onPress={handleLogin}
              loading={loading}
              size="lg"
              variant="primary"
              style={styles.submitBtn}
            />

            {/* DEMO ACCOUNTS QUICK LOGIN (1-TAP LOGIN) */}
            <View style={styles.demoSection}>
              <Text style={styles.demoTitle}>KLIK AKUN DI BAWAH UNTUK MASUK LANGSUNG (1-TAP):</Text>
              <View style={styles.demoRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Masuk sebagai Super Admin"
                  onPress={() => handleQuickLogin(demoAccounts.admin.email, demoAccounts.admin.pass)}
                  style={({ pressed }) => [
                    styles.demoPill,
                    email === demoAccounts.admin.email && styles.demoPillActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="shield" size={16} color={colors.primary[800]} style={{ marginBottom: 4 }} />
                  <Text style={styles.demoPillRole}>Super Admin</Text>
                  <Text style={styles.demoPillEmail} numberOfLines={1}>
                    {demoAccounts.admin.email.length > 14
                      ? `${demoAccounts.admin.email.substring(0, 11)}...`
                      : demoAccounts.admin.email}
                  </Text>
                  <View style={styles.tapBadge}>
                    <Text style={styles.tapBadgeText}>Masuk ➔</Text>
                  </View>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Masuk sebagai Staf TU"
                  onPress={() => handleQuickLogin(demoAccounts.tu.email, demoAccounts.tu.pass)}
                  style={({ pressed }) => [
                    styles.demoPill,
                    email === demoAccounts.tu.email && styles.demoPillActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="briefcase" size={16} color={colors.accent.teal} style={{ marginBottom: 4 }} />
                  <Text style={styles.demoPillRole}>Staf TU</Text>
                  <Text style={styles.demoPillEmail} numberOfLines={1}>
                    {demoAccounts.tu.email.length > 14
                      ? `${demoAccounts.tu.email.substring(0, 11)}...`
                      : demoAccounts.tu.email}
                  </Text>
                  <View style={styles.tapBadge}>
                    <Text style={styles.tapBadgeText}>Masuk ➔</Text>
                  </View>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Masuk sebagai Guru"
                  onPress={() => handleQuickLogin(demoAccounts.guru.email, demoAccounts.guru.pass)}
                  style={({ pressed }) => [
                    styles.demoPill,
                    email === demoAccounts.guru.email && styles.demoPillActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="school" size={16} color={colors.accent.gold} style={{ marginBottom: 4 }} />
                  <Text style={styles.demoPillRole}>Guru</Text>
                  <Text style={styles.demoPillEmail} numberOfLines={1}>
                    {demoAccounts.guru.email.length > 14
                      ? `${demoAccounts.guru.email.substring(0, 11)}...`
                      : demoAccounts.guru.email}
                  </Text>
                  <View style={styles.tapBadge}>
                    <Text style={styles.tapBadgeText}>Masuk ➔</Text>
                  </View>
                </Pressable>
              </View>

              {/* Tombol Inisialisasi Ulang jika data kosong */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Muat Ulang Data Akun Bawaan"
                onPress={handleResetDb}
                style={({ pressed }) => [styles.reseedBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="refresh-circle-outline" size={16} color={colors.neutral.textMuted} />
                <Text style={styles.reseedText}>Muat Ulang Data Akun Bawaan (Reset Seeder)</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral.canvas,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 14,
    color: colors.neutral.textSecondary,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.xl,
    borderCurve: "continuous",
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    ...shadows.medium,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  cardHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: radius.xl,
    borderCurve: "continuous",
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.neutral.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.neutral.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.status.conflictBg,
    padding: 12,
    borderRadius: radius.md,
    borderCurve: "continuous",
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: colors.status.conflict,
    fontWeight: "600",
    flex: 1,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.neutral.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.neutral.textPrimary,
  },
  submitBtn: {
    marginTop: 8,
  },
  demoSection: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral.border,
  },
  demoTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.neutral.textMuted,
    textAlign: "center",
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  demoRow: {
    flexDirection: "row",
    gap: 8,
  },
  demoPill: {
    flex: 1,
    backgroundColor: colors.neutral.canvas,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.neutral.border,
    alignItems: "center",
  },
  demoPillActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[400],
  },
  demoPillRole: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary[900],
    marginBottom: 2,
  },
  demoPillEmail: {
    fontSize: 10,
    color: colors.neutral.textMuted,
    marginBottom: 6,
  },
  tapBadge: {
    backgroundColor: colors.primary[700],
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  tapBadgeText: {
    color: colors.neutral.white,
    fontSize: 10,
    fontWeight: "700",
  },
  reseedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 6,
  },
  reseedText: {
    fontSize: 11,
    color: colors.neutral.textMuted,
    fontWeight: "600",
  },
});
