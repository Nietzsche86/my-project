import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { colors, radius, shadows, spacing } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import { useSync } from "../../context/SyncContext";
import { AppShell } from "../../components/layout/AppShell";
import {
  SyncCard,
  StatCard,
  QuickAction,
  ModernCard,
  Badge,
  useToast,
  FAB,
} from "../../components/ui";
import { db } from "../../db/client";
import {
  siswa,
  pegawai,
  tahunAjaran,
  pengumuman,
  kelas,
  anggotaKelas,
  type Pengumuman,
} from "../../db/schema";
import { eq, isNull, sql, and } from "drizzle-orm";
import { Ionicons } from "@expo/vector-icons";
import { useDoubleBackToExit } from "../../hooks";

export default function DashboardScreen() {
  useDoubleBackToExit();

  const { user, role, pegawaiData } = useAuth();
  const { refreshPendingCountAsync } = useSync();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [refreshing, setRefreshing] = useState(false);
  const [activeTa, setActiveTa] = useState<string>("2026/2027 - Semester 1 Ganjil");
  const [totalSiswa, setTotalSiswa] = useState<number>(0);
  const [totalAlumni, setTotalAlumni] = useState<number>(0);
  const [totalGuru, setTotalGuru] = useState<number>(0);
  const [totalTendik, setTotalTendik] = useState<number>(0);
  const [totalKelas, setTotalKelas] = useState<number>(0);

  // Guru specific state
  const [guruClasses, setGuruClasses] = useState<{ id: string; nama: string; totalSiswa: number }[]>([]);
  const [announcements, setAnnouncements] = useState<Pengumuman[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [role, pegawaiData]);

  const loadDashboardData = async () => {
    try {
      // 1. Tahun Ajaran & Semester Aktif
      const taList = await db
        .select()
        .from(tahunAjaran)
        .where(and(eq(tahunAjaran.is_active, 1), isNull(tahunAjaran.deleted_at)))
        .limit(1);
      if (taList.length > 0 && taList[0]) {
        setActiveTa(`${taList[0].nama} - Semester ${taList[0].nama_semester}`);
      }

      // 2. Total Siswa Aktif
      const sCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(siswa)
        .where(and(eq(siswa.status, "aktif"), isNull(siswa.deleted_at)));
      setTotalSiswa(Number(sCount[0]?.count || 0));

      // 3. Total Alumni & Mutasi
      const alCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(siswa)
        .where(and(eq(siswa.status, "lulus"), isNull(siswa.deleted_at)));
      setTotalAlumni(Number(alCount[0]?.count || 0));

      // 4. Guru & Tendik (Pendidik vs Tenaga Kependidikan)
      const gCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(pegawai)
        .where(and(eq(pegawai.jenis, "guru"), eq(pegawai.status_aktif, "aktif"), isNull(pegawai.deleted_at)));
      setTotalGuru(Number(gCount[0]?.count || 0));

      const tCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(pegawai)
        .where(and(eq(pegawai.jenis, "tendik"), eq(pegawai.status_aktif, "aktif"), isNull(pegawai.deleted_at)));
      setTotalTendik(Number(tCount[0]?.count || 0));

      // 5. Total Rombel Kelas
      const kCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(kelas)
        .where(isNull(kelas.deleted_at));
      setTotalKelas(Number(kCount[0]?.count || 0));

      // 6. Guru Data: Kelas yang diampu / diwalikan
      if (role === "guru" && pegawaiData?.id) {
        const myWaliClasses = await db
          .select()
          .from(kelas)
          .where(and(eq(kelas.wali_kelas_id, pegawaiData.id), isNull(kelas.deleted_at)));

        const classResults = [];
        for (const c of myWaliClasses) {
          const count = await db
            .select({ count: sql<number>`count(*)` })
            .from(anggotaKelas)
            .where(and(eq(anggotaKelas.kelas_id, c.id), isNull(anggotaKelas.deleted_at)));
          classResults.push({
            id: c.id,
            nama: c.nama,
            totalSiswa: Number(count[0]?.count || 0),
          });
        }
        setGuruClasses(classResults);
      }

      // 7. Pengumuman Aktif (maks. 3 kartu per Bagian 4)
      const ann = await db
        .select()
        .from(pengumuman)
        .where(and(eq(pengumuman.status, "aktif"), isNull(pengumuman.deleted_at)))
        .limit(3);
      setAnnouncements(ann);

      await refreshPendingCountAsync();
    } catch (e) {
      console.warn("Gagal membaca data dashboard:", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Quick Action Items per Role (Bagian 4)
  const quickActions =
    role === "guru"
      ? [
          {
            id: "qa-1",
            label: "Kelas Saya",
            icon: "school-outline" as const,
            onPress: () => router.push("/(app)/kelas"),
          },
          {
            id: "qa-2",
            label: "Profil Saya",
            icon: "person-outline" as const,
            onPress: () => router.push("/(app)/profil-saya"),
          },
        ]
      : [
          {
            id: "qa-1",
            label: "Tambah Siswa",
            icon: "person-add-outline" as const,
            onPress: () => router.push("/(app)/siswa/form"),
          },
          {
            id: "qa-2",
            label: "Surat Keluar",
            icon: "mail-outline" as const,
            onPress: () => router.push("/(app)/surat"),
          },
          {
            id: "qa-3",
            label: "Cetak Data",
            icon: "print-outline" as const,
            onPress: () => router.push("/(app)/data-io"),
          },
          {
            id: "qa-4",
            label: "Absensi",
            icon: "clipboard-outline" as const,
            onPress: () => router.push("/(app)/siswa"),
          },
        ];

  return (
    <AppShell
      title="Dashboard"
      subtitle={activeTa}
      onAdd={
        role === "super_admin" || role === "staf_tu"
          ? () => router.push("/(app)/siswa/form")
          : undefined
      }
      addLabel="Tambah Siswa"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 1. Sapaan + nama + periode aktif */}
        <View style={[styles.greetingCard, shadows.soft]}>
          <View style={styles.greetingLeft}>
            <Text style={styles.greetingTitle}>
              Assalamu'alaikum, {user?.name?.split(" ")[0] || "Ustadz"}! 👋
            </Text>
            <Text style={styles.greetingPeriod}>
              Periode Aktif: <Text style={styles.greetingPeriodBold}>{activeTa}</Text>
            </Text>
          </View>
          <View>
            <Badge
              label={
                role === "super_admin"
                  ? "SUPER ADMIN"
                  : role === "staf_tu"
                  ? "STAF TU"
                  : "GURU"
              }
              variant={role === "guru" ? "gold" : "primary"}
              size="md"
            />
          </View>
        </View>

        {/* 2. Kartu Sinkronisasi (SyncCard) */}
        <SyncCard
          onSuccessMessage={(m) => showToast(m)}
          onErrorMessage={(m) => showToast(m, { type: "error" })}
        />

        {/* 3. Kartu statistik, grid 2 kolom */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Statistik Madrasah</Text>
        </View>

        <View style={styles.statsGrid}>
          {role === "guru" ? (
            <>
              <StatCard
                title="Kelas Saya"
                value={guruClasses.length > 0 ? guruClasses.map((g) => g.nama).join(", ") : "Kelas 7A"}
                subtitle="Wali & Pengampu Mapel"
                icon={<Ionicons name="school" size={18} color={colors.primary[700]} />}
                onPress={() => router.push("/(app)/kelas")}
              />
              <StatCard
                title="Siswa di Kelas"
                value={
                  guruClasses.length > 0
                    ? guruClasses.reduce((acc, curr) => acc + curr.totalSiswa, 0)
                    : totalSiswa
                }
                subtitle="Rombel Bimbingan"
                icon={<Ionicons name="people" size={18} color={colors.primary[700]} />}
                onPress={() => router.push("/(app)/kelas")}
              />
            </>
          ) : (
            <>
              <StatCard
                title="Siswa Aktif"
                value={totalSiswa}
                subtitle="Seluruh Rombel"
                icon={<Ionicons name="people" size={18} color={colors.primary[700]} />}
                onPress={() => router.push("/(app)/siswa")}
              />
              <StatCard
                title="Alumni & Mutasi"
                value={totalAlumni}
                subtitle="Lulus & Pindah"
                icon={<Ionicons name="ribbon" size={18} color={colors.primary[700]} />}
                onPress={() => router.push("/(app)/siswa/alumni")}
              />
              <StatCard
                title="Guru Pendidik"
                value={totalGuru}
                subtitle="Tenaga Pengajar"
                icon={<Ionicons name="person" size={18} color={colors.primary[700]} />}
                onPress={() => router.push("/(app)/pegawai")}
              />
              <StatCard
                title="Tenaga Kependidikan"
                value={totalTendik}
                subtitle="Staf & Tata Usaha"
                icon={<Ionicons name="briefcase" size={18} color={colors.primary[700]} />}
                onPress={() => router.push("/(app)/pegawai")}
              />
              <StatCard
                title="Rombel Kelas"
                value={totalKelas}
                subtitle="Tingkat 7, 8, dan 9"
                icon={<Ionicons name="school" size={18} color={colors.primary[700]} />}
                onPress={() => router.push("/(app)/kelas")}
              />
            </>
          )}
        </View>

        {/* 4. Aksi cepat: grid 4 ikon */}
        <View style={[styles.sectionHeaderRow, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Aksi Cepat</Text>
        </View>
        <QuickAction items={quickActions} />

        {/* 5. Pengumuman terbaru (maks. 3 kartu) */}
        {announcements.length > 0 && (
          <View style={styles.announcementSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconTitle}>
                <Ionicons name="megaphone-outline" size={18} color={colors.primary[700]} />
                <Text style={styles.sectionTitle}>Pengumuman Terbaru</Text>
              </View>
            </View>

            {announcements.map((a) => (
              <ModernCard key={a.id} style={styles.announcementCard}>
                <Text style={styles.announcementTitle}>{a.judul}</Text>
                <Text style={styles.announcementBody}>{a.isi}</Text>
                <Text style={styles.announcementMeta}>
                  Masa tayang: {a.tanggal_mulai} s.d. {a.tanggal_selesai}
                </Text>
              </ModernCard>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB Tambah Siswa (Mobile only, untuk Admin/TU) */}
      {(role === "super_admin" || role === "staf_tu") && (
        <FAB
          onPress={() => router.push("/(app)/siswa/form")}
          accessibilityLabel="Tambah Siswa Baru"
        />
      )}
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
  greetingCard: {
    backgroundColor: colors.neutral.surface,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.cardGap,
  },
  greetingLeft: {
    flex: 1,
    marginRight: 10,
  },
  greetingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.neutral.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  greetingPeriod: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.neutral.textSmall,
  },
  greetingPeriodBold: {
    color: colors.primary[700],
    fontWeight: "600",
  },
  sectionHeaderRow: {
    marginBottom: 8,
  },
  sectionIconTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.neutral.textPrimary,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: spacing.cardGap,
  },
  announcementSection: {
    marginTop: 4,
  },
  announcementCard: {
    marginBottom: 10,
    borderRadius: radius.card,
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary[800],
    marginBottom: 4,
  },
  announcementBody: {
    fontSize: 13,
    color: colors.neutral.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  announcementMeta: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.neutral.textSmall,
  },
});
