import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
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
  EmptyState,
  Badge,
} from "../../../components/ui";
import { db } from "../../../db/client";
import { siswa, type Siswa } from "../../../db/schema";
import { and, isNull, inArray } from "drizzle-orm";

export default function SiswaAlumniScreen() {
  const { role } = useAuth();
  const isOperator = role === "super_admin" || role === "staf_tu";

  const [alumniList, setAlumniList] = useState<Siswa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAlumni();
  }, []);

  const loadAlumni = async () => {
    try {
      setLoading(true);
      const queryRes = await db
        .select()
        .from(siswa)
        .where(
          and(
            inArray(siswa.status, ["lulus", "pindah", "keluar"]),
            isNull(siswa.deleted_at)
          )
        );

      queryRes.sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));
      setAlumniList(queryRes);
    } catch (e) {
      console.warn("Gagal memuat arsip alumni:", e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlumni();
    setRefreshing(false);
  };

  const filteredList = useMemo(() => {
    return alumniList.filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = s.nama_lengkap.toLowerCase().includes(q);
        const matchNis = s.nis?.toLowerCase().includes(q);
        const matchNisn = s.nisn?.toLowerCase().includes(q);
        if (!matchName && !matchNis && !matchNisn) return false;
      }

      if (filterStatus !== "all" && s.status !== filterStatus) return false;

      return true;
    });
  }, [alumniList, search, filterStatus]);

  const dataTabs = [
    { key: "aktif", label: "Siswa Aktif" },
    { key: "alumni", label: "Alumni & Mutasi", badge: alumniList.length },
    { key: "pegawai", label: "Guru & Tendik" },
  ];

  const handleTabChange = (key: string) => {
    if (key === "aktif") {
      router.push("/(app)/siswa");
    } else if (key === "pegawai") {
      router.push("/(app)/pegawai");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "lulus":
        return <Badge label="LULUS" variant="synced" size="sm" />;
      case "pindah":
        return <Badge label="PINDAH" variant="pending" size="sm" />;
      case "keluar":
        return <Badge label="KELUAR" variant="danger" size="sm" />;
      default:
        return <Badge label={status.toUpperCase()} variant="neutral" size="sm" />;
    }
  };

  return (
    <AppShell
      title="Data Madrasah"
      subtitle="Arsip Alumni & Siswa Mutasi"
      headerChildren={
        <View style={styles.headerSlot}>
          <SegmentedTabs
            tabs={dataTabs}
            activeKey="alumni"
            onChange={handleTabChange}
          />

          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Cari nama, NIS, atau NISN alumni..."
          />

          <FilterChipGroup>
            <FilterChip
              label="Semua Arsip"
              selected={filterStatus === "all"}
              onPress={() => setFilterStatus("all")}
            />
            <FilterChip
              label="Lulus (Alumni)"
              selected={filterStatus === "lulus"}
              onPress={() => setFilterStatus("lulus")}
            />
            <FilterChip
              label="Pindah (Mutasi)"
              selected={filterStatus === "pindah"}
              onPress={() => setFilterStatus("pindah")}
            />
            <FilterChip
              label="Keluar / DO"
              selected={filterStatus === "keluar"}
              onPress={() => setFilterStatus("keluar")}
            />
          </FilterChipGroup>
        </View>
      }
    >
      <FlatList
        data={loading ? [] : filteredList}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 8, marginTop: 8 }}>
              <ListItemCard title="" subtitle="" loading={true} onPress={() => {}} />
              <ListItemCard title="" subtitle="" loading={true} onPress={() => {}} />
            </View>
          ) : search.trim().length > 0 ? (
            <EmptyState
              type="search_empty"
              title="Arsip Tidak Ditemukan"
              message={`Tidak ada arsip alumni yang cocok dengan "${search}".`}
              canPerformAction={false}
            />
          ) : (
            <EmptyState
              type="empty"
              title="Belum Ada Arsip Alumni & Mutasi"
              message="Belum ada riwayat siswa yang lulus atau mutasi."
              canPerformAction={false}
            />
          )
        }
        renderItem={({ item: s }) => {
          const yearDisplay =
            s.status === "lulus"
              ? s.tahun_lulus || "-"
              : s.tanggal_keluar
              ? s.tanggal_keluar.split("-")[0]
              : "-";

          return (
            <ListItemCard
              title={s.nama_lengkap}
              subtitle={`NISN: ${s.nisn || "-"} • Thn: ${yearDisplay}`}
              avatarText={s.nama_lengkap.charAt(0).toUpperCase()}
              rightBadge={getStatusBadge(s.status)}
              onPress={() =>
                router.push({
                  pathname: "/siswa/[id]",
                  params: { id: s.id },
                })
              }
            />
          );
        }}
      />
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
