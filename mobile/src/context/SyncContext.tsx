import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import * as Network from "expo-network";
import { db } from "../db/client";
import {
  syncMetadata,
  siswa,
  pegawai,
  suratMasuk,
  suratKeluar,
  berita,
  pengumuman,
  kelas,
  tahunAjaran,
  mataPelajaran,
} from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { getIsoUtcString } from "../db/crypto";

export interface SyncContextType {
  pendingCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
  apiUrl: string;
  isSyncing: boolean;
  isOffline: boolean;
  lastSyncError: string | null;
  refreshPendingCountAsync: () => Promise<void>;
  updateApiUrlAsync: (newUrl: string) => Promise<void>;
  triggerPullAsync: () => Promise<{ success: boolean; message: string }>;
  triggerPushAsync: () => Promise<{ success: boolean; message: string }>;
  triggerFullSyncAsync: () => Promise<{ success: boolean; message: string }>;
}

// URL default server backend (Otomatis sesuaikan dengan platform)
export const DEFAULT_API_URL =
  Platform.OS === "web" ? "http://localhost:3000" : "http://192.168.0.109:3000";

const SyncContext = createContext<SyncContextType>({
  pendingCount: 0,
  conflictCount: 0,
  lastSyncedAt: null,
  apiUrl: DEFAULT_API_URL,
  isSyncing: false,
  isOffline: false,
  lastSyncError: null,
  refreshPendingCountAsync: async () => {},
  updateApiUrlAsync: async () => {},
  triggerPullAsync: async () => ({ success: false, message: "" }),
  triggerPushAsync: async () => ({ success: false, message: "" }),
  triggerFullSyncAsync: async () => ({ success: false, message: "" }),
});

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string>(DEFAULT_API_URL);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const checkNetworkAsync = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      const connected = !!(state.isConnected && (state.isInternetReachable ?? true));
      setIsOffline(!connected);
      return connected;
    } catch {
      // Anggap online jika gagal mengecek
      setIsOffline(false);
      return true;
    }
  }, []);

  const refreshPendingCountAsync = useCallback(async () => {
    try {
      let pending = 0;
      let conflicts = 0;
      const tables = [
        siswa,
        pegawai,
        suratMasuk,
        suratKeluar,
        berita,
        pengumuman,
        kelas,
        tahunAjaran,
        mataPelajaran,
      ];

      for (const t of tables) {
        const pRes = await db
          .select({ count: sql<number>`count(*)` })
          .from(t as any)
          .where(eq((t as any).sync_status, "pending_push"));
        pending += Number(pRes[0]?.count || 0);

        const cRes = await db
          .select({ count: sql<number>`count(*)` })
          .from(t as any)
          .where(eq((t as any).sync_status, "conflict"));
        conflicts += Number(cRes[0]?.count || 0);
      }

      setPendingCount(pending);
      setConflictCount(conflicts);
    } catch {
      // Abaikan error sebelum tabel terinisialisasi penuh
    }
  }, []);

  useEffect(() => {
    loadSyncMetadata();
    checkNetworkAsync();
    refreshPendingCountAsync();

    // Cek koneksi berkala setiap 30 detik
    const interval = setInterval(() => {
      checkNetworkAsync();
    }, 30000);

    return () => clearInterval(interval);
  }, [checkNetworkAsync, refreshPendingCountAsync]);

  const loadSyncMetadata = async () => {
    try {
      const records = await db.select().from(syncMetadata);
      let latestTimestamp: string | null = null;
      let loadedUrl: string | null = null;

      for (const r of records) {
        if (
          r.key === "last_pull_timestamp" ||
          r.key === "last_push_timestamp" ||
          r.key === "last_synced_at"
        ) {
          // Abaikan timestamp default 1970
          if (r.value && !r.value.startsWith("1970")) {
            if (!latestTimestamp || new Date(r.value).getTime() > new Date(latestTimestamp).getTime()) {
              latestTimestamp = r.value;
            }
          }
        }
        if (r.key === "api_url" && r.value) {
          loadedUrl = r.value;
        }
      }

      if (latestTimestamp) {
        setLastSyncedAt(latestTimestamp);
      }

      // Migrasikan jika URL masih tersimpan IP lama yang tidak aktif (10.87.253.15)
      if (loadedUrl) {
        if (loadedUrl.includes("10.87.253.15")) {
          const corrected = DEFAULT_API_URL;
          setApiUrl(corrected);
          await db
            .insert(syncMetadata)
            .values({ key: "api_url", value: corrected })
            .onConflictDoUpdate({ target: syncMetadata.key, set: { value: corrected } });
        } else {
          setApiUrl(loadedUrl);
        }
      } else {
        setApiUrl(DEFAULT_API_URL);
      }
    } catch (e) {
      console.warn("Gagal membaca sync metadata:", e);
    }
  };

  const updateApiUrlAsync = async (newUrl: string) => {
    const clean = newUrl.trim();
    setApiUrl(clean);
    await db
      .insert(syncMetadata)
      .values({ key: "api_url", value: clean })
      .onConflictDoUpdate({ target: syncMetadata.key, set: { value: clean } });
  };

  // Helper untuk menyimpan jam sinkronisasi ke DB & State
  const persistSyncTimestamp = async (timestamp: string) => {
    try {
      await db
        .insert(syncMetadata)
        .values({ key: "last_synced_at", value: timestamp })
        .onConflictDoUpdate({ target: syncMetadata.key, set: { value: timestamp } });

      await db
        .insert(syncMetadata)
        .values({ key: "last_pull_timestamp", value: timestamp })
        .onConflictDoUpdate({ target: syncMetadata.key, set: { value: timestamp } });

      await db
        .insert(syncMetadata)
        .values({ key: "last_push_timestamp", value: timestamp })
        .onConflictDoUpdate({ target: syncMetadata.key, set: { value: timestamp } });

      setLastSyncedAt(timestamp);
    } catch (e) {
      console.warn("Gagal menyimpan timestamp sinkronisasi:", e);
    }
  };

  const triggerPullAsync = async (): Promise<{ success: boolean; message: string }> => {
    const online = await checkNetworkAsync();
    if (!online) {
      const msg = "Perangkat sedang offline. Butuh koneksi internet.";
      setLastSyncError(msg);
      return { success: false, message: msg };
    }

    setIsSyncing(true);
    setLastSyncError(null);
    const cleanUrl = apiUrl.replace(/\/+$/, "");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const sinceParam = encodeURIComponent(
        lastSyncedAt && !lastSyncedAt.startsWith("1970")
          ? lastSyncedAt
          : "1970-01-01T00:00:00.000Z"
      );
      const targetEndpoint = `${cleanUrl}/api/sync/pull?since=${sinceParam}`;

      let res: Response;
      try {
        res = await fetch(targetEndpoint, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });
      } catch (fetchErr) {
        // Fallback pintar: jika cleanUrl gagal, coba host alternatif (localhost vs LAN IP)
        const fallbackUrl =
          cleanUrl.includes("localhost") || cleanUrl.includes("127.0.0.1")
            ? "http://192.168.0.109:3000"
            : Platform.OS === "web"
            ? "http://localhost:3000"
            : null;

        if (fallbackUrl && fallbackUrl !== cleanUrl) {
          const fallbackEndpoint = `${fallbackUrl}/api/sync/pull?since=${sinceParam}`;
          res = await fetch(fallbackEndpoint, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
          });
          setApiUrl(fallbackUrl);
          await updateApiUrlAsync(fallbackUrl);
        } else {
          throw fetchErr;
        }
      }

      clearTimeout(timeoutId);

      if (res.status === 401) {
        throw new Error("Sesi habis, silakan login ulang.");
      }

      if (!res.ok) {
        throw new Error(`Server merespon dengan status HTTP ${res.status}`);
      }

      const data = await res.json();
      const serverTimestamp = data.server_timestamp || getIsoUtcString();

      // Perbarui jam sinkronisasi ke DB dan React State
      await persistSyncTimestamp(serverTimestamp);
      await refreshPendingCountAsync();

      const timeFormatted = new Date(serverTimestamp).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      return {
        success: true,
        message: `Koneksi ke server backend sukses! (Pukul ${timeFormatted})`,
      };
    } catch (err: any) {
      const errorMsg =
        err?.message || `Server tidak dapat dihubungi di ${cleanUrl}. Periksa URL Server di Pengaturan.`;
      setLastSyncError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerPushAsync = async (): Promise<{ success: boolean; message: string }> => {
    const online = await checkNetworkAsync();
    if (!online) {
      const msg = "Perangkat sedang offline. Butuh koneksi internet.";
      setLastSyncError(msg);
      return { success: false, message: msg };
    }

    setIsSyncing(true);
    setLastSyncError(null);
    const cleanUrl = apiUrl.replace(/\/+$/, "");

    try {
      const now = getIsoUtcString();
      const tables = [
        siswa,
        pegawai,
        suratMasuk,
        suratKeluar,
        berita,
        pengumuman,
        kelas,
        tahunAjaran,
        mataPelajaran,
      ];

      const changesList: any[] = [];
      for (const t of tables) {
        const rows = await db
          .select()
          .from(t as any)
          .where(eq((t as any).sync_status, "pending_push"));
        changesList.push(...rows);
      }

      // Jika tidak ada mutasi pending, verifikasi server dan perbarui jam sinkronisasi
      if (changesList.length === 0) {
        const pingRes = await fetch(`${cleanUrl}/api/health`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }).catch(() => null);

        if (pingRes && pingRes.ok) {
          const healthData = await pingRes.json().catch(() => null);
          const syncTimestamp = healthData?.timestamp || now;

          await persistSyncTimestamp(syncTimestamp);

          const timeFormatted = new Date(syncTimestamp).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          return {
            success: true,
            message: `Database lokal mutakhir & tersinkron! (Pukul ${timeFormatted})`,
          };
        }

        return {
          success: true,
          message: "Database lokal sudah mutakhir. Tidak ada data pending.",
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let res: Response;
      try {
        res = await fetch(`${cleanUrl}/api/sync/push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_timestamp: now,
            changes: changesList,
          }),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        // Fallback jika perlu
        const fallbackUrl =
          cleanUrl.includes("localhost") || cleanUrl.includes("127.0.0.1")
            ? "http://192.168.0.109:3000"
            : Platform.OS === "web"
            ? "http://localhost:3000"
            : null;

        if (fallbackUrl && fallbackUrl !== cleanUrl) {
          res = await fetch(`${fallbackUrl}/api/sync/push`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_timestamp: now,
              changes: changesList,
            }),
            signal: controller.signal,
          });
          setApiUrl(fallbackUrl);
          await updateApiUrlAsync(fallbackUrl);
        } else {
          throw fetchErr;
        }
      }

      clearTimeout(timeoutId);

      if (res.status === 401) {
        throw new Error("Sesi habis, silakan login ulang.");
      }

      if (res.status === 409) {
        throw new Error("Ada konflik data yang perlu ditinjau.");
      }

      if (!res.ok) {
        throw new Error(`Server menolak upload dengan status HTTP ${res.status}`);
      }

      const pushData = await res.json().catch(() => null);
      const serverTimestamp = pushData?.server_timestamp || now;

      // Update status data lokal menjadi 'synced'
      for (const t of tables) {
        await db
          .update(t as any)
          .set({ sync_status: "synced", last_synced_at: serverTimestamp })
          .where(eq((t as any).sync_status, "pending_push"));
      }

      // PERBARUI TIMESTAMP SINKRONISASI DI METADATA & STATE
      await persistSyncTimestamp(serverTimestamp);
      await refreshPendingCountAsync();

      const timeFormatted = new Date(serverTimestamp).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      return {
        success: true,
        message: `Berhasil mengunggah ${changesList.length} perubahan ke server! (Pukul ${timeFormatted})`,
      };
    } catch (err: any) {
      const errorMsg = err?.message || "Gagal mengunggah pembaruan ke server.";
      setLastSyncError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerFullSyncAsync = async (): Promise<{ success: boolean; message: string }> => {
    if (pendingCount > 0) {
      const pushRes = await triggerPushAsync();
      if (!pushRes.success) return pushRes;
    }
    return await triggerPullAsync();
  };

  return (
    <SyncContext.Provider
      value={{
        pendingCount,
        conflictCount,
        lastSyncedAt,
        apiUrl,
        isSyncing,
        isOffline,
        lastSyncError,
        refreshPendingCountAsync,
        updateApiUrlAsync,
        triggerPullAsync,
        triggerPushAsync,
        triggerFullSyncAsync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => useContext(SyncContext);
