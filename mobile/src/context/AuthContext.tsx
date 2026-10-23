import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { db } from "../db/client";
import { users, pegawai, type User, type Pegawai } from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { verifyPassword, hashPassword, generateUUID, getIsoUtcString } from "../db/crypto";
import { seedInitialDataAsync } from "../db/seeder";

export type RoleType = "super_admin" | "staf_tu" | "guru" | "guest";

export interface AuthContextType {
  user: User | null;
  pegawaiData: Pegawai | null;
  role: RoleType;
  isLoading: boolean;
  loginAsync: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logoutAsync: () => Promise<void>;
  switchRoleDemoAsync: (role: "super_admin" | "staf_tu" | "guru") => Promise<void>;
  reseedDatabaseAsync: () => Promise<void>;
  refreshCurrentUserAsync: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  pegawaiData: null,
  role: "guest",
  isLoading: true,
  loginAsync: async () => ({ success: false, message: "" }),
  logoutAsync: async () => {},
  switchRoleDemoAsync: async () => {},
  reseedDatabaseAsync: async () => {},
  refreshCurrentUserAsync: async () => {},
});

const USER_SESSION_KEY = "mts_rth_user_session_id";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [pegawaiData, setPegawaiData] = useState<Pegawai | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session saat pertama dibuka
  useEffect(() => {
    loadStoredSession();
  }, []);

  const loadStoredSession = async () => {
    try {
      let storedUserId: string | null = null;
      if (Platform.OS === "web") {
        storedUserId = typeof window !== "undefined" ? localStorage.getItem(USER_SESSION_KEY) : null;
      } else {
        storedUserId = await SecureStore.getItemAsync(USER_SESSION_KEY);
      }

      if (storedUserId) {
        const found = await db.select().from(users).where(eq(users.id, storedUserId)).limit(1);
        if (found.length > 0 && found[0]) {
          const activeUser = found[0];
          setUser(activeUser);
          if (activeUser.pegawai_id) {
            const p = await db.select().from(pegawai).where(eq(pegawai.id, activeUser.pegawai_id)).limit(1);
            if (p.length > 0 && p[0]) setPegawaiData(p[0]);
          }
        }
      }
    } catch (e) {
      console.warn("Gagal membaca sesi pengguna:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const reseedDatabaseAsync = async () => {
    await seedInitialDataAsync();
  };

  const loginAsync = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      let matched = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);

      // Jika akun tidak ditemukan di lokal, pastikan seeder sudah berjalan
      if (matched.length === 0) {
        await seedInitialDataAsync();
        matched = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
      }

      // Jika masih belum ada di SQLite lokal, coba hubungi server backend jika tersedia
      if (matched.length === 0) {
        try {
          const backendUrl = process.env.EXPO_PUBLIC_API_URL || "http://10.87.253.15:3000";
          const res = await fetch(`${backendUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: cleanEmail, password }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              // Simpan user dari backend ke SQLite lokal
              const now = getIsoUtcString();
              const pHash = await hashPassword(password);
              const newLocalUser: User = {
                id: data.user.id || generateUUID(),
                created_at: now,
                updated_at: now,
                deleted_at: null,
                sync_status: "synced",
                last_synced_at: now,
                version: 1,
                name: data.user.name,
                email: cleanEmail,
                password_hash: pHash,
                role: data.user.role,
                pegawai_id: data.user.pegawai_id || null,
              };

              await db.insert(users).values(newLocalUser);
              setUser(newLocalUser);
              return { success: true, message: "Login berhasil via Server!" };
            }
          }
        } catch {
          // Abaikan kegagalan jaringan backend
        }

        return {
          success: false,
          message: `Email '${cleanEmail}' tidak terdaftar di database madrasah.\nGunakan akun bawaan:\n• admin@mts-rth.sch.id\n• tu@mts-rth.sch.id\n• guru@mts-rth.sch.id`,
        };
      }

      const activeUser = matched[0]!;
      const valid = await verifyPassword(password, activeUser.password_hash);
      if (!valid) {
        return { success: false, message: "Kata sandi yang Anda masukkan salah." };
      }

      setUser(activeUser);
      if (activeUser.pegawai_id) {
        const p = await db.select().from(pegawai).where(eq(pegawai.id, activeUser.pegawai_id)).limit(1);
        if (p.length > 0 && p[0]) setPegawaiData(p[0]);
      } else {
        setPegawaiData(null);
      }

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") localStorage.setItem(USER_SESSION_KEY, activeUser.id);
      } else {
        await SecureStore.setItemAsync(USER_SESSION_KEY, activeUser.id);
      }

      return { success: true, message: "Login berhasil!" };
    } catch (err: any) {
      return { success: false, message: `Terjadi kesalahan login: ${err?.message || "Unknown error"}` };
    }
  };

  const logoutAsync = async () => {
    setUser(null);
    setPegawaiData(null);
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") localStorage.removeItem(USER_SESSION_KEY);
      } else {
        await SecureStore.deleteItemAsync(USER_SESSION_KEY);
      }
    } catch {}
  };

  const switchRoleDemoAsync = async (targetRole: "super_admin" | "staf_tu" | "guru") => {
    // Pastikan seeder sudah terisi
    await seedInitialDataAsync();

    const matched = await db
      .select()
      .from(users)
      .where(and(eq(users.role, targetRole), isNull(users.deleted_at)))
      .limit(1);
    if (matched.length > 0 && matched[0]) {
      const activeUser = matched[0];
      setUser(activeUser);
      if (activeUser.pegawai_id) {
        const p = await db.select().from(pegawai).where(eq(pegawai.id, activeUser.pegawai_id)).limit(1);
        if (p.length > 0 && p[0]) setPegawaiData(p[0]);
      } else {
        setPegawaiData(null);
      }
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") localStorage.setItem(USER_SESSION_KEY, activeUser.id);
      } else {
        await SecureStore.setItemAsync(USER_SESSION_KEY, activeUser.id);
      }
    }
  };

  const refreshCurrentUserAsync = async () => {
    try {
      if (!user?.id) return;
      const found = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      if (found.length > 0 && found[0]) {
        const activeUser = found[0];
        setUser(activeUser);
        if (activeUser.pegawai_id) {
          const p = await db.select().from(pegawai).where(eq(pegawai.id, activeUser.pegawai_id)).limit(1);
          if (p.length > 0 && p[0]) setPegawaiData(p[0]);
        }
      }
    } catch (err) {
      console.warn("Gagal merefresh sesi pengguna:", err);
    }
  };

  const role: RoleType = (user?.role as RoleType) || "guest";

  return (
    <AuthContext.Provider
      value={{
        user,
        pegawaiData,
        role,
        isLoading,
        loginAsync,
        logoutAsync,
        switchRoleDemoAsync,
        reseedDatabaseAsync,
        refreshCurrentUserAsync,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
