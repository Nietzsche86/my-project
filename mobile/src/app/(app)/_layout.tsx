import React from "react";
import { Stack, Redirect } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function AppLayout() {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  // Jika belum login, redirect ke halaman login
  if (role === "guest") {
    return <Redirect href="/(public)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="profil-saya" />
      <Stack.Screen name="siswa/index" />
      <Stack.Screen name="siswa/[id]" />
      <Stack.Screen name="siswa/form" />
      <Stack.Screen name="siswa/alumni" />
      <Stack.Screen name="pegawai/index" />
      <Stack.Screen name="pegawai/[id]" />
      <Stack.Screen name="pegawai/form" />
      <Stack.Screen name="tahun-ajaran/index" />
      <Stack.Screen name="mata-pelajaran/index" />
      <Stack.Screen name="kelas/index" />
      <Stack.Screen name="kelas/[id]" />
      <Stack.Screen name="surat/index" />
      <Stack.Screen name="cms/index" />
      <Stack.Screen name="data-io/index" />
      <Stack.Screen name="pengguna/index" />
      <Stack.Screen name="pengaturan/index" />
      <Stack.Screen name="dev/components" />
    </Stack>
  );
}
