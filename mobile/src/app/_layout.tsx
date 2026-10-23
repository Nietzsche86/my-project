import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, LogBox } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initDatabaseAsync } from "../db/client";
import { seedInitialDataAsync } from "../db/seeder";
import { AuthProvider } from "../context/AuthContext";
import { SyncProvider } from "../context/SyncContext";
import { AlertProvider } from "../context/AlertContext";
import { ToastProvider } from "../components/ui/Toast";
import { colors } from "../theme/colors";

// Mengabaikan peringatan dev-server websocket agar tidak mengganggu antarmuka pengguna
LogBox.ignoreLogs([
  "Cannot connect to Expo CLI",
  "Disconnected from Metro",
]);

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    async function setupDb() {
      try {
        await initDatabaseAsync();
        await seedInitialDataAsync();
        setDbReady(true);
      } catch (err: any) {
        console.error("Gagal startup database:", err);
        setDbError(err?.message || "Gagal menginisialisasi SQLite");
      }
    }
    setupDb();
  }, []);

  if (!dbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[700]} />
        <Text style={styles.loadingText}>Memuat Database MTs RTH...</Text>
        {dbError && <Text style={styles.errorText}>{dbError}</Text>}
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SyncProvider>
          <AlertProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(public)" />
                <Stack.Screen name="(app)" />
              </Stack>
            </ToastProvider>
          </AlertProvider>
        </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.neutral.canvas,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary[900],
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.status.conflict,
    textAlign: "center",
  },
});
