import { useCallback, useRef } from "react";
import { BackHandler, Platform, ToastAndroid } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useToast } from "../components/ui/Toast";

export interface UseDoubleBackToExitOptions {
  /**
   * Pesan toast yang ditampilkan saat tombol kembali ditekan pertama kali.
   * Default: "Tekan sekali lagi untuk keluar dari aplikasi"
   */
  message?: string;
  /**
   * Jeda waktu maksimal antara tombol kembali pertama dan kedua (dalam milidetik).
   * Default: 2000 (2 detik)
   */
  delay?: number;
  /**
   * Jika true, hook akan selalu mencegat tombol kembali untuk keluar aplikasi terlepas dari status stack riwayat navigasi.
   * Jika false, hook hanya akan mencegat tombol kembali jika stack riwayat navigasi sudah berada di akar (router.canGoBack() === false).
   * Default: true
   */
  alwaysIntercept?: boolean;
}

/**
 * Hook untuk menangani proteksi keluar aplikasi dengan penekanan tombol back 2 kali pada Android.
 * Menggunakan useFocusEffect agar listener hanya aktif ketika halaman sedang dalam fokus (foreground),
 * dan otomatis dibersihkan saat berpindah ke sub-halaman sehingga navigasi balik sub-halaman tetap berjalan normal.
 */
export function useDoubleBackToExit(options: UseDoubleBackToExitOptions = {}) {
  const {
    message = "Tekan sekali lagi untuk keluar dari aplikasi",
    delay = 2000,
    alwaysIntercept = true,
  } = options;

  const lastBackPressTime = useRef<number>(0);
  const { showToast } = useToast();

  useFocusEffect(
    useCallback(() => {
      // Tombol hardware back hanya ada pada perangkat Android
      if (Platform.OS !== "android") {
        return;
      }

      const onBackPress = () => {
        // Jika alwaysIntercept bernilai false dan masih ada riwayat navigasi balik, biarkan default router.back()
        if (!alwaysIntercept && router.canGoBack()) {
          return false;
        }

        const now = Date.now();
        if (now - lastBackPressTime.current < delay) {
          // Penekanan kedua dalam rentang delay -> keluar dari aplikasi
          BackHandler.exitApp();
          return true;
        }

        // Penekanan pertama -> catat timestamp dan tampilkan notifikasi toast
        lastBackPressTime.current = now;

        try {
          ToastAndroid.show(message, ToastAndroid.SHORT);
        } catch {
          // Fallback ke Toast in-app jika ToastAndroid tidak tersedia
          showToast(message, { type: "info" });
        }

        // Return true untuk membatalkan aksi default (mencegah langsung keluar)
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );

      return () => {
        subscription.remove();
      };
    }, [message, delay, alwaysIntercept, showToast])
  );
}
