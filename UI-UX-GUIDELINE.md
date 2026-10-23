# UI/UX GUIDELINE (WAJIB DIIKUTI)

Aplikasi: Sistem Database & Manajemen Sekolah MTs Roudhotut Thowalib (React Native + Expo Router + NativeWind v4, kompatibel Expo Go).

Tujuan: aplikasi terasa seperti aplikasi mobile modern. Mudah dipakai satu tangan, bersih, dan estetik.

Cara pakai: tempel seluruh isi file ini di bawah master prompt pada `CLAUDE.md` (atau `.cursorrules`) di root proyek.

---

## 1. Prinsip Utama

- Mobile-first. Layar HP adalah prioritas, layar laptop/web adalah adaptasi.
- Navigasi utama di BAWAH (zona jempol), konten di TENGAH, status/info di ATAS.
- Di HP, JANGAN gunakan drawer atau hamburger sebagai navigasi utama.
- Layar lebar (>= 768px, gunakan `useWindowDimensions`): ganti bottom tab menjadi sidebar tetap.
- Menu yang tidak boleh diakses peran tertentu DISEMBUNYIKAN (bukan diabu-abukan). Di Expo Router gunakan `href: null` pada tab.

---

## 2. Bottom Tab Bar (maks. 5 item, ikon + label)

- Super Admin / Staf TU: Beranda · Data · Kelas · Surat · Lainnya
- Guru: Beranda · Kelas Saya · Siswa · Profil Saya
- Publik (tanpa login): Beranda · Berita · Pengumuman · Login

Isi tab:

- **Data**: segmented control di bawah header berisi Siswa Aktif | Alumni & Mutasi | Guru & Tendik. (Alumni & Mutasi hanya untuk Super Admin dan Staf TU.)
- **Lainnya**: daftar menu bergrup (section title kecil):
  - Manajemen: Tahun Ajaran, Mata Pelajaran
  - Konten: Berita, Pengumuman
  - Sistem: Pengguna, Log Eksport, Pengaturan & Backup (grup Sistem hanya tampil untuk Super Admin)

---

## 3. Pembagian Zona Layar

- **ATAS (header)**: judul di kiri. Di kanan ada ikon sinkronisasi (SyncChip, dengan badge jumlah `pending_push`), lalu avatar. Di bawah header ada kolom pencarian dan chip filter horizontal (kelas, status).
- **TENGAH**: konten berupa kartu atau list.
- **BAWAH**: tab bar dan tombol aksi utama.

Aturan tombol aksi utama (+ Tambah):

- Mobile (< 768px): FAB di kanan-bawah dengan `bottom: 16`. Area konten Expo Router Tabs sudah berhenti di atas tab bar, jadi JANGAN menambahkan tinggi tab bar lagi. Gunakan `useBottomTabBarHeight()` HANYA jika tab bar dibuat transparan/absolute.
- Layar tanpa tab bar (form, detail): padding bawah footer = `insets.bottom` (`useSafeAreaInsets`) + 12.
- Layar lebar (>= 768px): FAB TIDAK ditampilkan. Gantinya tombol "+ Tambah ..." (ikon + label) di kanan atas header konten.

---

## 4. Urutan Dashboard (atas ke bawah)

1. Sapaan + nama + periode aktif (mis. "2026/2027 - Semester 1 Ganjil").
2. Kartu Sinkronisasi (SyncCard): waktu terakhir sinkron, jumlah data belum diunggah, tombol Tarik Data. Tombol Upload hanya berwarna menonjol saat `pending_push > 0`.
3. Kartu statistik, grid 2 kolom (Siswa Aktif, Alumni, Guru, Tendik, Kelas). Untuk Guru: kartu Kelas Saya.
4. Aksi cepat: grid 4 ikon. Admin/TU: Tambah Siswa, Surat Keluar, Cetak, Absensi. Guru: Kelas Saya, Absensi Kosong, Profil Saya.
5. Pengumuman terbaru (maks. 3 kartu).

---

## 5. Pola Layar

- **List**: kartu dengan avatar/inisial, 2 baris teks (nama + info sekunder), dan chevron. Tambahkan pull-to-refresh.
- **Detail Siswa (4 tab)**: tab di bagian atas (SegmentedTabs yang bisa digeser), bukan di bawah. Pola scroll: lihat Bagian 12.
- **Form**: field dikelompokkan per section dengan judul. Tombol Simpan menempel di bawah layar (sticky footer). Aksi Hapus disembunyikan di menu titik tiga pada header, selalu dengan dialog konfirmasi. Penanganan keyboard: lihat Bagian 10.
- **Dropdown Mapel/Guru**: gunakan bottom sheet (bukan dropdown kecil) dengan pencarian. Kolom pencarian fokus hanya saat diketuk, agar keyboard tidak langsung menutupi daftar.
- **Empty state**: ikon + teks singkat + tombol aksi (hanya jika peran berhak). Bedakan "data kosong" dan "pencarian tidak ditemukan".
- **Loading**: skeleton, bukan spinner penuh layar.
- **Feedback**: toast "Berhasil disimpan". Untuk error sinkronisasi, ikuti Bagian 13.
- Maksimal SATU tombol primer per layar.

---

## 6. Design Tokens (NativeWind v4, daftarkan di `tailwind.config.js`)

**Warna**

- Primary: `#0F766E` (teal tua). Primary soft: `#CCFBF1`.
- Aksen: `#D4A24C` (emas lembut). HANYA untuk elemen NON-TEKS (border highlight, latar badge, ikon dekoratif). Jangan dipakai sebagai warna teks. Teks di atas latar emas memakai `#1F2937`.
- Background: `#F8FAF9`. Surface/kartu: `#FFFFFF`.
- Teks utama: `#1F2937`.
- Teks sekunder: `#4B5563` untuk ukuran < 14 (mis. label 12). `#6B7280` hanya untuk teks ukuran >= 14.
- Border: `#E5E7EB`.
- Success `#16A34A`, Warning `#F59E0B`, Danger `#DC2626`.

**Bentuk dan jarak**

- Spacing: kelipatan 8 (padding layar 16, jarak antar kartu 12).
- Radius: kartu 16, tombol 12, chip penuh (pill).
- Shadow tipis dan lembut (hindari border tebal).

**Tipografi dan ikon**

- Satu font saja (Inter atau Plus Jakarta Sans via `@expo-google-fonts`). Body 14-16, judul layar 20-24 semibold, label kecil 12 (gunakan `font-medium`).
- Satu set ikon konsisten: `@expo/vector-icons` (Ionicons), karena sudah terbundel di Expo Go.
- Target sentuh minimal 48dp.

---

## 7. Komponen Reusable

Buat dulu di folder `components/ui` SEBELUM membuat layar fitur:

Screen, AppHeader, SyncChip, SyncCard, StatCard, QuickAction, ListItemCard, SearchBar, FilterChip, SegmentedTabs, FAB (varian mobile), HeaderAddButton (varian layar lebar), FormSection, StickyFooterButton, BottomSheetPicker, ConfirmDialog, EmptyState, Skeleton, Toast.

Semua layar WAJIB memakai komponen ini agar tampilan konsisten. Dilarang menulis style ad-hoc berulang di tiap layar.

---

## 8. Larangan

- Dilarang menambah library UI native yang butuh prebuild (tetap kompatibel Expo Go).
- Dilarang lebih dari 5 item bottom tab.
- Dilarang menaruh tombol aksi penting di pojok kiri-atas.
- Dilarang memakai lebih dari 1 font atau campuran banyak warna di luar token.
- Dilarang menampilkan menu Surat, tambah/edit Siswa, atau Sistem kepada peran yang tidak berhak.
- Dilarang menampilkan FAB di layar >= 768px.
- Dilarang memakai warna emas sebagai warna teks.
- Dilarang menaruh `FlatList`/`ScrollView` vertikal di dalam `ScrollView` lain.
- Dilarang memasang banner offline global (lihat Bagian 13).
- Dilarang memakai pesan error generik ("Gagal, coba lagi") untuk error sinkronisasi.
- Dilarang menjalankan Upload Data tanpa dialog konfirmasi.

---

## 9. Gaya Kerja UI

- Tahap 1: buat design tokens, komponen reusable, dan layout tab per peran lebih dulu, baru layar fitur.
- Buat satu halaman uji `/dev/components` yang menampilkan semua state pada tabel Bagian 14, supaya komponen bisa dicek sekali jalan di Expo Go tanpa menunggu layar fitur jadi.
- Setiap selesai layar, berikan perintah ringan untuk mengecek tampilan di Expo Go (HP) dan di browser laptop (web).

---

## 10. Form & Keyboard

- Setiap form dibungkus `KeyboardAvoidingView` dengan `keyboardVerticalOffset` sesuai tinggi header, dan `ScrollView` memakai `keyboardShouldPersistTaps="handled"`.
- Perilaku keyboard berbeda antara Android dan iOS. Jangan hardcode satu nilai `behavior`. WAJIB diuji di HP Android fisik lewat Expo Go.
- Sticky footer (tombol Simpan) harus ikut naik di atas keyboard dan tidak boleh tertutup.

---

## 11. Responsif >= 768px (Laptop/Web)

- Navigasi berubah menjadi sidebar tetap.
- Konten form, list, dan tabel dibatasi `max-w-4xl` dan diletakkan di tengah.
- Sticky footer mengikuti lebar konten, bukan 100% lebar layar.
- Tombol aksi utama pindah ke header konten (lihat Bagian 3).

---

## 12. Aturan Scroll

- DILARANG menaruh `FlatList` atau `ScrollView` vertikal di dalam `ScrollView` lain.
- Layar list panjang (daftar siswa, surat, berita): `FlatList` menjadi satu-satunya scroller layar.
- Detail Siswa: satu `ScrollView`. Header siswa dan SegmentedTabs ikut ter-scroll, isi tiap tab berupa `View` biasa (bukan list bersarang).

---

## 13. UX Sinkronisasi

- Offline adalah kondisi NORMAL (aplikasi local-first), jadi JANGAN pasang banner offline global. Status ditampilkan di SyncChip (header) dan SyncCard (dashboard).
- Deteksi koneksi memakai `expo-network` (paket resmi Expo). Tombol Tarik Data dan Upload Data disabled saat offline atau sedang syncing, dengan teks "Butuh koneksi internet".
- Terhubung internet tidak berarti server terjangkau. Pesan error harus spesifik, contoh:
  - "Server tidak dapat dihubungi. Periksa URL Server di Pengaturan."
  - "Sesi habis, silakan login ulang."
  - "Ada N data konflik yang perlu ditinjau."
- Upload Data WAJIB lewat dialog konfirmasi: "Unggah N perubahan ke server? Data di server akan diperbarui." dengan tombol Batal / Unggah.
- Status `conflict`: tampilkan badge pada SyncChip dan pada item terkait, plus layar daftar item konflik (minimal). Detail aksi penyelesaian ditentukan saat mengerjakan tahap sinkronisasi.
- Layar **Profil Saya** (Guru): tombol "Sinkronkan Profil Saya ke Server" ada di sticky footer layar ini (bukan hanya di dashboard), aktif hanya jika ada `pending_push` pada data profil sendiri.

---

## 14. Checksheet Komponen

WAJIB dipenuhi sebelum sebuah komponen dianggap selesai.

| Komponen | State wajib | Perilaku khusus |
|---|---|---|
| ListItemCard | Default, Pressed, Loading (skeleton) | `accessibilityRole="button"` dan `accessibilityLabel` yang jelas |
| BottomSheetPicker | Open, Close, Search aktif, Hasil kosong | Kolom pencarian fokus hanya saat diketuk. Tutup via swipe atau tap backdrop |
| SyncCard | Idle, Syncing, Error, Offline, Conflict | Tombol disabled saat Syncing/Offline. Upload butuh konfirmasi |
| EmptyState | Data kosong, Pencarian nihil | Ikon dan teks berbeda untuk dua kondisi. Tombol tambah hanya muncul jika peran berhak |
| StickyFooterButton | Normal, Disabled, Loading | Naik di atas keyboard. Safe area bawah diperhitungkan |
| FAB / HeaderAddButton | Mobile (FAB), Layar lebar (tombol header) | FAB hanya tampil di < 768px |
