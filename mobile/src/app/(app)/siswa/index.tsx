import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Image,
} from "react-native";
import { router } from "expo-router";
import { colors, radius, shadows, spacing } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { AppShell } from "../../../components/layout/AppShell";
import {
  ListItemCard,
  SearchBar,
  FilterChip,
  FilterChipGroup,
  SegmentedTabs,
  TabOption,
  EmptyState,
  FAB,
  Badge,
} from "../../../components/ui";
import { db } from "../../../db/client";
import {
  siswa,
  anggotaKelas,
  kelas,
  pengampuKelas,
  tahunAjaran,
  type Siswa,
} from "../../../db/schema";
import { isNull, and, eq, or, inArray } from "drizzle-orm";

interface SiswaWithRombel extends Siswa {
  rombelNama?: string;
  rombelTingkat?: number;
}

export default function SiswaScreen() {
  const { role, pegawaiData } = useAuth();
  const isOperator = role === "super_admin" || role === "staf_tu";

  const [studentList, setStudentList] = useState<SiswaWithRombel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTingkat, setFilterTingkat] = useState<string>("all");
  const [filterJk, setFilterJk] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [activeTaName, setActiveTaName] = useState<string>("2026/2027 Ganjil");

  useEffect(() => {
    if (role === "guru") {
      router.replace("/(app)/kelas");
      return;
    }
    loadStudents();
  }, [role, pegawaiData]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      // 1. Ambil tahun ajaran aktif
      const activeTa = await db
        .select()
        .from(tahunAjaran)
        .where(and(eq(tahunAjaran.is_active, 1), isNull(tahunAjaran.deleted_at)))
        .limit(1);

      const taId = activeTa[0]?.id;
      if (activeTa[0]) {
        setActiveTaName(`${activeTa[0].nama} (${activeTa[0].nama_semester})`);
      }

      // 2. Jika role guru, tentukan kelas yang diampu / diwalikan
      let teacherClassIds: string[] = [];
      if (role === "guru" && pegawaiData?.id) {
        const waliClasses = await db
          .select({ id: kelas.id })
          .from(kelas)
          .where(and(eq(kelas.wali_kelas_id, pegawaiData.id), isNull(kelas.deleted_at)));

        const pengampuClasses = await db
          .select({ id: pengampuKelas.kelas_id })
          .from(pengampuKelas)
          .where(and(eq(pengampuKelas.pegawai_id, pegawaiData.id), isNull(pengampuKelas.deleted_at)));

        const cIdSet = new Set<string>();
        waliClasses.forEach((c) => cIdSet.add(c.id));
        pengampuClasses.forEach((c) => cIdSet.add(c.id));
        teacherClassIds = Array.from(cIdSet);
      }

      // 3. Mapping data siswa aktif ke rombel semester ini
      let rombelMap = new Map<string, { nama: string; tingkat: number }>();
      if (taId) {
        const rombelEntries = await db
          .select({
            siswaId: anggotaKelas.siswa_id,
            kelasNama: kelas.nama,
            tingkat: kelas.tingkat,
            kelasId: kelas.id,
          })
          .from(anggotaKelas)
          .innerJoin(kelas, eq(anggotaKelas.kelas_id, kelas.id))
          .where(
            and(
              eq(anggotaKelas.tahun_ajaran_id, taId),
              isNull(anggotaKelas.deleted_at),
              isNull(kelas.deleted_at)
            )
          );

        rombelEntries.forEach((r) => {
          rombelMap.set(r.siswaId, { nama: r.kelasNama, tingkat: r.tingkat });
        });
      }

      // 4. Query siswa aktif
      const rawStudents = await db
        .select()
        .from(siswa)
        .where(and(eq(siswa.status, "aktif"), isNull(siswa.deleted_at)));

      // 5. Gabungkan info rombel
      let enriched: SiswaWithRombel[] = rawStudents.map((s) => {
        const r = rombelMap.get(s.id);
        return {
          ...s,
          rombelNama: r?.nama,
          rombelTingkat: r?.tingkat,
        };
      });

      // 6. Jika guru, batasi hanya ke rombel yang dibimbing/diampu
      if (role === "guru") {
        if (teacherClassIds.length === 0) {
          enriched = [];
        } else {
          const enrolledStudents = await db
            .select({ siswaId: anggotaKelas.siswa_id })
            .from(anggotaKelas)
            .where(
              and(
                inArray(anggotaKelas.kelas_id, teacherClassIds),
                isNull(anggotaKelas.deleted_at)
              )
            );
          const enrolledSet = new Set(enrolledStudents.map((e) => e.siswaId));
          enriched = enriched.filter((s) => enrolledSet.has(s.id));
        }
      }

      enriched.sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));
      setStudentList(enriched);
    } catch (e) {
      console.warn("Gagal memuat siswa:", e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStudents();
    setRefreshing(false);
  };

  // Client-side filtering
  const filteredStudents = useMemo(() => {
    return studentList.filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = s.nama_lengkap.toLowerCase().includes(q);
        const matchNis = s.nis?.toLowerCase().includes(q);
        const matchNisn = s.nisn?.toLowerCase().includes(q);
        if (!matchName && !matchNis && !matchNisn) return false;
      }

      if (filterTingkat === "7" && s.rombelTingkat !== 7) return false;
      if (filterTingkat === "8" && s.rombelTingkat !== 8) return false;
      if (filterTingkat === "9" && s.rombelTingkat !== 9) return false;
      if (filterTingkat === "none" && s.rombelNama) return false;

      if (filterJk !== "all" && s.jenis_kelamin !== filterJk) return false;

      return true;
    });
  }, [studentList, search, filterTingkat, filterJk]);

  // Segmented Tabs: Siswa Aktif | Alumni & Mutasi | Guru & Tendik
  const dataTabs: TabOption[] = useMemo(() => {
    const tabs: TabOption[] = [{ key: "aktif", label: "Siswa Aktif", badge: studentList.length }];
    if (isOperator) {
      tabs.push({ key: "alumni", label: "Alumni & Mutasi", badge: undefined });
    }
    tabs.push({ key: "pegawai", label: "Guru & Tendik", badge: undefined });
    return tabs;
  }, [isOperator, studentList.length]);

  const handleTabChange = (key: string) => {
    if (key === "alumni") {
      router.push("/(app)/siswa/alumni");
    } else if (key === "pegawai") {
      router.push("/(app)/pegawai");
    }
  };

  if (role === "guru") {
    return null;
  }

  return (
    <AppShell
      title="Data Madrasah"
      subtitle={activeTaName}
      onAdd={isOperator ? () => router.push("/(app)/siswa/form") : undefined}
      addLabel="Tambah Siswa"
      headerChildren={
        <View style={styles.headerSlot}>
          {/* Segmented Control di bawah header */}
          <SegmentedTabs
            tabs={dataTabs}
            activeKey="aktif"
            onChange={handleTabChange}
          />

          {/* Kolom Pencarian */}
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Cari nama, NIS, atau NISN..."
          />

          {/* Chip filter horizontal (kelas, status) */}
          <FilterChipGroup>
            <FilterChip
              label="Semua Rombel"
              selected={filterTingkat === "all"}
              onPress={() => setFilterTingkat("all")}
            />
            <FilterChip
              label="Kelas 7"
              selected={filterTingkat === "7"}
              onPress={() => setFilterTingkat("7")}
            />
            <FilterChip
              label="Kelas 8"
              selected={filterTingkat === "8"}
              onPress={() => setFilterTingkat("8")}
            />
            <FilterChip
              label="Kelas 9"
              selected={filterTingkat === "9"}
              onPress={() => setFilterTingkat("9")}
            />
            <FilterChip
              label="Non-Rombel"
              selected={filterTingkat === "none"}
              onPress={() => setFilterTingkat("none")}
            />
            <FilterChip
              label="Laki-Laki"
              selected={filterJk === "L"}
              onPress={() => setFilterJk(filterJk === "L" ? "all" : "L")}
            />
            <FilterChip
              label="Perempuan"
              selected={filterJk === "P"}
              onPress={() => setFilterJk(filterJk === "P" ? "all" : "P")}
            />
          </FilterChipGroup>
        </View>
      }
    >
      {/* FlatList sebagai satu-satunya scroller layar vertikal (Aturan Bagian 12) */}
      <FlatList
        data={loading ? [] : filteredStudents}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 8, marginTop: 8 }}>
              <ListItemCard title="" subtitle="" loading={true} onPress={() => {}} />
              <ListItemCard title="" subtitle="" loading={true} onPress={() => {}} />
              <ListItemCard title="" subtitle="" loading={true} onPress={() => {}} />
            </View>
          ) : search.trim().length > 0 ? (
            <EmptyState
              type="search_empty"
              title="Siswa Tidak Ditemukan"
              message={`Tidak ada siswa yang sesuai dengan pencarian "${search}".`}
              canPerformAction={false}
            />
          ) : (
            <EmptyState
              type="empty"
              title="Belum Ada Data Siswa Aktif"
              message="Klik tombol Tambah Siswa untuk mendaftarkan siswa baru ke madrasah."
              actionLabel="Tambah Siswa Baru"
              canPerformAction={isOperator}
              onAction={() => router.push("/(app)/siswa/form")}
            />
          )
        }
        renderItem={({ item: s }) => (
          <ListItemCard
            title={s.nama_lengkap}
            subtitle={`NISN: ${s.nisn || "-"} • ${s.rombelNama ? `Kelas ${s.rombelNama}` : "Non-Rombel"}`}
            avatarText={s.nama_lengkap.charAt(0).toUpperCase()}
            rightBadge={
              <Badge
                label={s.jenis_kelamin === "L" ? "L" : "P"}
                variant={s.jenis_kelamin === "L" ? "primary" : "gold"}
                size="sm"
              />
            }
            onPress={() =>
              router.push({
                pathname: "/siswa/[id]",
                params: { id: s.id },
              })
            }
          />
        )}
      />

      {/* FAB Tambah Siswa (Hanya tampil di HP < 768px untuk Admin / Staf TU) */}
      {isOperator && (
        <FAB
          onPress={() => router.push("/(app)/siswa/form")}
          accessibilityLabel="Tambah Siswa Baru"
        />
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  headerSlot: {
    gap: 8,
    paddingTop: 4,
  },
  listContent: {
    padding: spacing.screen,
    paddingBottom: 80,
  },
});
