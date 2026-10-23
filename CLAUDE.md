# MTs Roudhotut Thowalib — AI Development Guidelines (CLAUDE.md)

Dokumen ini adalah instruksi operasional wajib untuk AI Assistant (Claude Code, Cursor, Windsurf, dll.) dalam mengembangkan **Sistem Database & Manajemen Sekolah MTs Roudhotut Thowalib** berbasis monorepo React Native *Local-First*.

---

## 1. Profil Proyek & Arsitektur Utama

- **Basis Sistem**: *Local-First Architecture* (100% fungsional secara *offline* di SQLite lokal perangkat; sinkronisasi manual *Push/Pull* ke server *shared hosting*).
- **Struktur Repositori**: Monorepo berbasis `pnpm workspaces`:
  - `/mobile`: React Native (Expo SDK 52+), Expo Router, NativeWind v4 (Tailwind CSS), `expo-sqlite`, Drizzle ORM (`drizzle-orm/expo-sqlite`), `expo-crypto`, `expo-print`, `expo-file-system`.
  - `/backend`: Node.js LTS, Hono / Express.js, TypeScript, Drizzle ORM, database SQLite (`better-sqlite3`) / MySQL.
  - `/packages`: (Opsional) Shared types, Zod schemas, dan DTO serializer.

---

## 2. Batasan Lingkungan & Perangkat Keras (CRITICAL)

Lingkungan pengembangan berjalan pada **Laptop dengan spesifikasi RAM terbatas**:

1. **DILARANG MENGGUNAKAN ANDROID STUDIO & EMULATOR**:
   - Jangan menyuruh pengguna menjalankan emulator Android (AVD) atau menginstal Android Studio.
   - Jangan menjalankan perintah kompilasi native lokal seperti `npx expo run:android` atau `./gradlew assemble...` di terminal laptop.
2. **WAJIB 100% KOMPATIBEL DENGAN EXPO GO**:
   - Seluruh pengujian mobile dilakukan langsung di HP fisik pengguna melalui aplikasi **Expo Go** via jaringan Wi-Fi lokal / LAN (`pnpm --filter mobile start --lan`).
   - **Dilarang keras** memasang library pihak ketiga yang memerlukan *native module linking* kustom di luar API resmi Expo SDK. Seluruh modul native wajib menggunakan modul standar Expo Go (`expo-sqlite`, `expo-router`, `expo-crypto`, `expo-print`, `expo-sharing`, `expo-document-picker`, `expo-image-picker`, `expo-file-system`, `expo-secure-store`).
3. **JARINGAN WI-FI LAN & DYNAMIC API URL**:
   - Server backend (`/backend`) wajib di-bind ke host `0.0.0.0` (bukan hanya `127.0.0.1` atau `localhost`) agar HP di jaringan Wi-Fi yang sama dapat mengakses API sinkronisasi.
   - Sediakan konfigurasi `EXPO_PUBLIC_API_URL=http://<IP_LAN_LAPTOP>:3000` di `/mobile/.env`, dan sertakan pengaturan di antarmuka aplikasi untuk mengubah alamat host API secara manual jika IP Wi-Fi berganti.
4. **COMPILATION & RELEASE HANYA DI GITHUB ACTIONS**:
   - Kompilasi APK produksi (`.apk` / `.aab`) didelegasikan 100% ke GitHub Actions runner (`ubuntu-latest`). Jangan melakukan build lokal.

---

## 3. Standar Database & Skema Sinkronisasi (Drizzle ORM)

### 3.1 Kolom Standar Sinkronisasi (Wajib pada 18 Tabel Operasional)
Setiap tabel operasional **wajib** menyertakan 7 kolom sinkronisasi berikut:
```typescript
id: text("id").primaryKey(), // UUID v4 via expo-crypto di client
created_at: text("created_at").notNull(), // ISO-8601 UTC string
updated_at: text("updated_at").notNull(), // ISO-8601 UTC string
deleted_at: text("deleted_at"), // ISO-8601 UTC string (NULL jika aktif)
sync_status: text("sync_status").notNull().default("pending_push"), // 'synced' | 'pending_push' | 'conflict'
last_synced_at: text("last_synced_at"), // ISO-8601 UTC string
version: integer("version").notNull().default(1),
```

### 3.2 Daftar 19 Tabel
1. `users` (super_admin, staf_tu, guru)
2. `tahun_ajaran` (2 semester: `1` = Ganjil, `2` = Genap; `UNIQUE(nama, semester)`)
3. `mata_pelajaran` (Master mapel dinamis: kelompok PAI, Umum, Mulok)
4. `pegawai` (Guru & Tendik, atribut EMIS Kemenag, data sensitif terenkripsi, `nik_hash`)
5. `guru_mapel` (Pemetaan kompetensi mata pelajaran guru)
6. `riwayat_pendidikan` (Riwayat pendidikan pegawai)
7. `kelas` (Tingkat 7, 8, 9; terikat ke `tahun_ajaran_id`; wali kelas)
8. `pengampu_kelas` (Penugasan guru mengajar mapel di kelas tertentu; mapel harus terdaftar di `guru_mapel`)
9. `siswa` (Biodata lengkap, atribut EMIS/NISM, foto, data sensitif terenkripsi, `nik_hash`)
10. `wali_siswa` (Data ayah, ibu, wali)
11. `anggota_kelas` (Penempatan siswa di kelas; `UNIQUE(siswa_id, tahun_ajaran_id)`)
12. `dokumen_pendukung` (Arsip scan berkas siswa & pegawai)
13. `surat_masuk` (Administrasi persuratan — Eksklusif Admin & TU)
14. `surat_keluar` (Metode 1: Tanpa hapus / `deleted_at` selalu NULL, penomoran urut otomatis per tahun, status `aktif` / `dibatalkan` + `alasan_batal`)
15. `berita` (CMS Publik: draft/terbit, slug, sanitasi konten)
16. `pengumuman` (CMS Publik: rentang tanggal aktif)
17. `log_eksport` (Audit log riwayat eksport Excel)
18. `pengaturan` (Profil madrasah, kop surat, NSM, NPSN, nama & NIP Kepala Madrasah)
19. `sync_metadata` (Khusus lokal: `last_pull_timestamp`, `device_id`)

### 3.3 Aturan Kriptografi & Enkripsi
- Enkripsi AES-256-GCM menggunakan `APP_KEY` untuk kolom sensitif: `nik`, `no_kk`, `npwp`, `no_rekening`.
- Setiap pengisian/perubahan `nik` wajib menghasilkan `nik_hash` menggunakan HMAC-SHA256 untuk indeks pencarian unik dan pencegahan duplikasi tanpa mendekripsi seluruh database.

---

## 4. Kebijakan Sinkronisasi (Push & Pull)

### 4.1 Aturan Upload / Push (`POST /api/sync/push`)
- **Publik**: Ditolak (`401 Unauthorized`).
- **Role Guru (`guru`)**:
  - Hanya diizinkan mengirim payload untuk:
    1. `pegawai` (wajib `id === req.user.pegawai_id`).
    2. `riwayat_pendidikan` (wajib `pegawai_id === req.user.pegawai_id`).
    3. `dokumen_pendukung` (wajib `documentable_type === 'pegawai'` dan `documentable_id === req.user.pegawai_id`).
  - Jika akun Guru mengirim data tabel lain (siswa, kelas, surat, berita, dll.), server **wajib menolak seluruh transaksi dengan 403 Forbidden**.
  - Kolom struktural kepegawaian (`jenis`, `jabatan`, `status_aktif`) diabaikan oleh server saat update dari Guru.
- **Role Super Admin & Staf TU**: Diizinkan mengirim seluruh tabel operasional sesuai matriks RBAC.
- **Resolusi Konflik**: *Last-Write-Wins* berdasarkan `updated_at`. Jika terjadi bentrok nomor urut surat keluar saat upload offline simultan, server otomatis menetapkan `nomor_urut = MAX(nomor_urut) + 1`.

### 4.2 Aturan Download / Pull (`GET /api/sync/pull?since=...`)
- Mengambil delta perubahan di server (`updated_at > since`).
- **Publik**: Hanya menerima tabel `pengaturan`, `berita` (berstatus terbit), dan `pengumuman` (berstatus aktif).
- **Guru**: Menerima data publik + master akademik (`tahun_ajaran`, `mata_pelajaran`, `guru_mapel`, `kelas`, `pengampu_kelas`) + data diri lengkap miliknya + daftar ringkas rekan kerja + **data siswa hanya di kelas yang diampu/diwalikan pada semester aktif** (kolom sensitif NIK & KK dibuang). **TIDAK PERNAH menerima tabel `surat_masuk`, `surat_keluar`, maupun berkas siswa**.
- **Admin & Staf TU**: Menerima pembaruan seluruh tabel.

---

## 5. Aturan Bisnis & Logika Khusus

1. **Kemandirian Profil Guru**: Tidak ada sistem tiket pengajuan perbaikan data. Guru mengedit data dirinya langsung di tab "Profil Saya" dan menekan tombol "Upload Pembaruan Profil".
2. **Kunci Akses Siswa**: Data siswa hanya dapat diubah/dihapus oleh Admin dan Staf TU. Guru hanya memiliki akses baca (*read-only*) untuk siswa di rombel kelasnya.
3. **Surat Menyurat Eksklusif TU & Admin**: Modul surat dan cetak surat keterangan siswa aktif sama sekali tidak boleh dapat diakses oleh Guru atau Publik, baik di antarmuka mobile maupun di respons API.
4. **Tahun Ajaran 2 Semester**: Hanya ada satu kombinasi tahun ajaran dan semester yang aktif (`is_active = 1`) dalam satu waktu. Pengaktifan satu periode wajib menonaktifkan periode lainnya dalam transaksi database tunggal.
5. **Relasi Pengampu Kelas**: Saat memilih guru di menu penugasan kelas, pilihan mata pelajaran wajib difilter hanya menampilkan mapel yang tercatat pada `guru_mapel` guru yang bersangkutan.

---

## 6. Roadmap Pengerjaan Bertahap (Step-by-Step Vibe Coding)

Kerjakan **hanya satu tahap pada satu waktu**. Jangan melanjutkan ke tahap berikutnya sebelum deliverable tahap berjalan stabil dan diuji di HP via Expo Go / Browser Web.

| Tahap | Fokus Pekerjaan | Verifikasi & Deliverable |
| :--- | :--- | :--- |
| **Tahap 1** | Monorepo Setup, Local-First Engine (`expo-sqlite` + Drizzle), Skema 19 Tabel, Seeder Dummy, & Auth Lokal Multi-Role. | Login 3 peran berjalan offline di HP (Expo Go); data tersimpan di SQLite lokal; skema 19 tabel tervalidasi. |
| **Tahap 2** | Modul Tahun Ajaran (2 Semester), Master Mata Pelajaran, & Manajemen Kelas/Rombel. | Pengaktifan periode semester berjalan secara atomik; master mapel dinamis; kelas terikat ke periode aktif. |
| **Tahap 3** | Modul Guru/Tendik, Relasi `guru_mapel`, Penugasan `pengampu_kelas`, & Fitur Edit Mandiri "Profil Saya". | Filter mapel per guru berfungsi pada rombel kelas; Guru berhasil mengedit data dirinya sendiri di HP. |
| **Tahap 4** | Modul Siswa Aktif, Mutasi/Alumni, Kenaikan Kelas, Wali Siswa, Cetak PDF Biodata & Form Absensi Kosong. | Data siswa terkunci dari edit oleh Guru; riwayat kelas per semester aman; cetak PDF bekerja secara offline via `expo-print`. |
| **Tahap 5** | Modul Administrasi Surat Masuk, Surat Keluar (Metode 1 - Tanpa Hapus), & Generator Surat Keterangan PDF. | Fitur persuratan hanya bisa dibuka Admin/TU; penomoran urut otomatis; pembatalan surat mengubah status ke dibatalkan. |
| **Tahap 6** | CMS Publik (Landing Page, Berita, Pengumuman), Import/Eksport Excel, & Pencatatan Log Eksport. | Halaman berita/pengumuman tampil dari SQLite; eksport Excel berjalan di HP; aktivitas eksport tercatat di audit log. |
| **Tahap 7** | Mesin Sinkronisasi Manual (`POST /push` & `GET /pull` via Wi-Fi LAN), Pengujian Konflik, & Setup GitHub Actions CI/CD. | Sinkronisasi HP $\to$ Laptop via IP Wi-Fi sukses; workflow `.github/workflows/build-apk.yml` siap meng-compile APK di cloud. |

---

## 7. Standar Kode & Konvensi

1. **TypeScript Strict Mode**: Hindari tipe `any`. Definisikan interface/type untuk setiap DTO, entity database, dan response API.
2. **Responsif Multi-Platform (NativeWind v4)**:
   - Gunakan layout responsif: Sidebar permanen di layar laptop/web desktop (`md:flex` / `lg:flex`) dan Bottom Tab / Drawer di layar HP Android.
3. **Penanganan Error**:
   - Selalu bungkus query SQLite dan pemanggilan API dengan blok `try...catch` yang ramah pengguna (tampilkan *toast* atau dialog peringatan, jangan biarkan aplikasi *crash* tanpa pesan).
4. **Perintah Menjalankan Aplikasi Ringan**:
   ```bash
   # Menjalankan Backend (bind 0.0.0.0)
   pnpm --filter backend dev

   # Menjalankan Mobile untuk Expo Go di Wi-Fi yang sama
   pnpm --filter mobile start --lan

   # Memeriksa Skema Database Lokal (Drizzle Studio)
   pnpm --filter backend db:studio
   ```

---

# UI/UX GUIDELINE (WAJIB DIIKUTI)

Aplikasi: Sistem Database & Manajemen Sekolah MTs Roudhotut Thowalib (React Native + Expo Router + NativeWind v4, kompatibel Expo Go).

Tujuan: aplikasi terasa seperti aplikasi mobile modern. Mudah dipakai satu tangan, bersih, dan estetik.

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
