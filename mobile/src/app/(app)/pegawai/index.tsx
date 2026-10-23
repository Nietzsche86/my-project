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
import { useSync } from "../../../context/SyncContext";
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
  ConfirmDialog,
  useToast,
} from "../../../components/ui";
import { db } from "../../../db/client";
import { pegawai, guruMapel, type Pegawai } from "../../../db/schema";
import { isNull, and, sql, eq } from "drizzle-orm";
import { getIsoUtcString } from "../../../db/crypto";

interface PegawaiWithMeta extends Pegawai {
  totalMapel: number;
}

export default function PegawaiScreen() {
  const { role } = useAuth();
  const { refreshPendingCountAsync } = useSync();
  const { showToast } = useToast();
  const isOperator = role === "super_admin" || role === "staf_tu";

  const [pegawaiList, setPegawaiList] = useState<PegawaiWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterJenis, setFilterJenis] = useState<"all" | "guru" | "tendik">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPegawai();
  }, []);

  const loadPegawai = async () => {
    try {
      setLoading(true);
      const res = await db.select().from(pegawai).where(isNull(pegawai.deleted_at));

      const results: PegawaiWithMeta[] = [];
      for (const p of res) {
        let totalMapel = 0;
        if (p.jenis === "guru") {
          const gmRes = await db
            .select({ count: sql<number>`count(*)` })
            .from(guruMapel)
            .where(and(eq(guruMapel.pegawai_id, p.id), isNull(guruMapel.deleted_at)));
          totalMapel = Number(gmRes[0]?.count || 0);
        }
        results.push({ ...p, totalMapel });
      }

      results.sort((a, b) => {
        if (a.jenis !== b.jenis) {
          return a.jenis === "guru" ? -1 : 1;
        }
        return a.nama_lengkap.localeCompare(b.nama_lengkap);
      });

      setPegawaiList(results);
    } catch (e) {
      console.warn("Gagal memuat pegawai:", e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPegawai();
    setRefreshing(false);
  };

  const filteredList = useMemo(() => {
    return pegawaiList.filter((p) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = p.nama_lengkap.toLowerCase().includes(q);
        const matchNip = p.nip?.toLowerCase().includes(q);
        const matchNik = p.nik?.toLowerCase().includes(q);
        if (!matchName && !matchNip && !matchNik) return false;
      }

      if (filterJenis !== "all" && p.jenis !== filterJenis) return false;
      if (filterStatus !== "all" && p.status_aktif !== filterStatus) return false;

      return true;
    });
  }, [pegawaiList, search, filterJenis, filterStatus]);

  const dataTabs: TabOption[] = useMemo(() => {
    const tabs: TabOption[] = [{ key: "aktif", label: "Siswa Aktif" }];
    if (isOperator) {
      tabs.push({ key: "alumni", label: "Alumni & Mutasi" });
    }
    tabs.push({ key: "pegawai", label: "Guru & Tendik", badge: pegawaiList.length });
    return tabs;
  }, [isOperator, pegawaiList.length]);

  const handleTabChange = (key: string) => {
    if (key === "aktif") {
      router.push("/(app)/siswa");
    } else if (key === "alumni") {
      router.push("/(app)/siswa/alumni");
    }
  };

  return (
    <AppShell
      title="Data Madrasah"
      subtitle="Guru Pendidik & Tenaga Kependidikan"
      onAdd={isOperator ? () => router.push("/(app)/pegawai/form") : undefined}
      addLabel="Tambah Pegawai"
      headerChildren={
        <View style={styles.headerSlot}>
          <SegmentedTabs
            tabs={dataTabs}
            activeKey="pegawai"
            onChange={handleTabChange}
          />

          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Cari nama, NIP, atau NIK pegawai..."
          />

          <FilterChipGroup>
            <FilterChip
              label="Semua PTK"
              selected={filterJenis === "all"}
              onPress={() => setFilterJenis("all")}
            />
            <FilterChip
              label="Guru Pengajar"
              selected={filterJenis === "guru"}
              onPress={() => setFilterJenis("guru")}
            />
            <FilterChip
              label="Tenaga Kependidikan"
              selected={filterJenis === "tendik"}
              onPress={() => setFilterJenis("tendik")}
            />
            <FilterChip
              label="Status Aktif"
              selected={filterStatus === "aktif"}
              onPress={() => setFilterStatus(filterStatus === "aktif" ? "all" : "aktif")}
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
              title="Pegawai Tidak Ditemukan"
              message={`Tidak ada guru atau tendik yang cocok dengan "${search}".`}
              canPerformAction={false}
            />
          ) : (
            <EmptyState
              type="empty"
              title="Belum Ada Data Pegawai"
              message="Tambahkan tenaga pendidik dan kependidikan ke sistem madrasah."
              actionLabel="Tambah Pegawai Baru"
              canPerformAction={isOperator}
              onAction={() => router.push("/(app)/pegawai/form")}
            />
          )
        }
        renderItem={({ item: p }) => (
          <ListItemCard
            title={p.nama_lengkap}
            subtitle={`${p.jenis === "guru" ? "Guru Pengajar" : "Tenaga Kependidikan"} • NIP: ${p.nip || "-"}`}
            avatarText={p.nama_lengkap.charAt(0).toUpperCase()}
            avatarBg={p.jenis === "guru" ? colors.primary[50] : colors.accent.goldLight}
            avatarTextColor={p.jenis === "guru" ? colors.primary[800] : colors.neutral.textPrimary}
            rightBadge={
              <Badge
                label={p.jenis === "guru" ? `${p.totalMapel} Mapel` : "Tendik"}
                variant={p.jenis === "guru" ? "primary" : "neutral"}
                size="sm"
              />
            }
            onPress={() =>
              router.push({
                pathname: "/pegawai/[id]",
                params: { id: p.id },
              })
            }
          />
        )}
      />

      {isOperator && (
        <FAB
          onPress={() => router.push("/(app)/pegawai/form")}
          accessibilityLabel="Tambah Pegawai Baru"
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
