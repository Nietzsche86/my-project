# Roadmap Pengembangan Sistem Database & Manajemen Sekolah MTs Roudhotut Thowalib
## Versi React Native Local-First (Aesthetic & Modern Edition)

Dokumen ini melacak progres pengerjaan fitur bertahap (*Step-by-Step Vibe Coding*) berdasarkan dokumen spesifikasi [PRD](prd.md) dan pedoman [CLAUDE.md](CLAUDE.md).

---

## Ringkasan Progres Keseluruhan

| Tahap | Fokus Utama | Status | Target Deliverable |
| :---: | :--- | :---: | :--- |
| **Tahap 1** | Fondasi Monorepo, Engine Local-First (`expo-sqlite` + Drizzle), Skema 19 Tabel, Auth Multi-Role Offline, UI/UX Shell Modern | **SELESAI (100%)** | Login 3 peran offline di HP (Expo Go); skema 19 tabel tervalidasi; UI aesthetic |
| **Tahap 2** | Modul Tahun Ajaran (2 Semester), Master Mata Pelajaran, & Rombel Kelas | **SELESAI (100%)** | Transaksi tunggal semester aktif; master mapel dinamis; rombel terikat TA; layar detail kelas |
| **Tahap 3** | Pegawai/Guru, Relasi `guru_mapel`, Penugasan `pengampu_kelas`, & Profil Mandiri | **SELESAI (100%)** | Filter mapel dinamis per guru; cetak PDF biodata resmi; form pegawai lengkap; edit profil mandiri |
| **Tahap 4** | Siswa Aktif, Mutasi/Alumni, Naik Kelas Massal, Biodata & Form Absensi PDF | **SELESAI (100%)** | Siswa terkunci dari edit guru; riwayat kelas aman; cetak PDF offline |
| **Tahap 5** | Administrasi Surat Masuk, Surat Keluar (Metode 1), & Cetak Surat Keterangan PDF | **SELESAI (100%)** | Eksklusif Admin/TU; penomoran berurut per tahun tanpa hapus; PDF offline |
| **Tahap 6** | CMS Publik (Landing Page, Berita, Pengumuman), Import/Eksport Excel & Log | **SELESAI (100%)** | Berita offline; import/eksport Excel di HP; pencatatan audit log eksport |
| **Tahap 7** | Mesin Sinkronisasi Manual (Wi-Fi LAN Push/Pull) & GitHub Actions Cloud Build APK | **BERIKUTNYA (0%)** | Sinkronisasi HP ⇄ Laptop; resolusi konflik LWW; workflow CI/CD APK |

---

## Rincian Per Tahap & Ceklis Eksekusi

### [x] Tahap 1: Fondasi Monorepo, Local-First Drizzle SQLite & Shell UI Aesthetic
- [x] **Konfigurasi Workspace & Expo SDK 57**:
  - [x] Konfigurasi entry point `expo-router/entry` pada `mobile/package.json`.
  - [x] Konfigurasi identitas madrasah, skema `mts-rth`, dan plugin di `mobile/app.json`.
  - [x] Pemasangan dependensi resmi Expo: `@expo/vector-icons`, `expo-font`, `expo-constants`, `expo-linking`, `react-native-safe-area-context`.
- [x] **Mesin Database Local-First (Drizzle ORM + SQLite)**:
  - [x] Pembuatan skema 19 tabel lengkap di `mobile/src/db/schema.ts` (`users`, `tahun_ajaran`, `mata_pelajaran`, `pegawai`, `guru_mapel`, `riwayat_pendidikan`, `kelas`, `pengampu_kelas`, `siswa`, `wali_siswa`, `anggota_kelas`, `dokumen_pendukung`, `surat_masuk`, `surat_keluar`, `berita`, `pengumuman`, `log_eksport`, `pengaturan`, `sync_metadata`).
  - [x] Penerapan 7 kolom standar sinkronisasi wajib pada 18 tabel operasional (`id` UUID v4, `created_at`, `updated_at`, `deleted_at`, `sync_status`, `last_synced_at`, `version`).
  - [x] Pengaktifan `PRAGMA foreign_keys = ON;` dan WAL mode secara synchronous di `mobile/src/db/client.ts`.
  - [x] Eksekusi DDL inisialisasi tabel otomatis (*idempotent*) saat aplikasi pertama dibuka.
- [x] **Keamanan & Kriptografi**:
  - [x] Enkripsi AES-256 untuk kolom sensitif (`nik`, `no_kk`, `npwp`, `no_rekening`).
  - [x] Blind Indexing HMAC-SHA256 untuk kolom `nik_hash`.
  - [x] Parser Base64 murni TypeScript (`bytesToBase64`, `base64ToBytes`) tanpa ketergantungan `btoa/atob` browser untuk kompatibilitas Hermes Android.
  - [x] Salted hash untuk password lokal (`mobile/src/db/crypto.ts`).
- [x] **Seeder Data Awal Otomatis** (`mobile/src/db/seeder.ts`):
  - [x] Profil madrasah MTs Roudhotut Thowalib (NSM, NPSN, akreditasi A, Kepala Madrasah, alamat, visi-misi).
  - [x] 2 Semester Tahun Ajaran 2026/2027 (Semester 1 Ganjil berstatus aktif).
  - [x] Master 14 mata pelajaran pokok (PAI, Umum, Mulok).
  - [x] 3 Akun Pengujian Offline:
    - Super Admin: `admin@mts-rth.sch.id` (`admin123`)
    - Staf TU: `tu@mts-rth.sch.id` (`tu12345`)
    - Guru: `guru@mts-rth.sch.id` (`guru12345`)
  - [x] Data rombel awal (7A, 7B, 8A, 9A) dan data siswa contoh.
  - [x] Penanganan *idempotent* seeder (pengecekan sebelum insert untuk mencegah error duplikasi constraint).
- [x] **State Management & Sesi**:
  - [x] `AuthContext.tsx`: Pengelolaan sesi offline multi-peran dengan `expo-secure-store` dan fitur switch role demo.
  - [x] `SyncContext.tsx`: Penghitung mutasi lokal berstatus `pending_push` dan pengaturan dinamis host API LAN.
- [x] **Tema Desain UI/UX Aesthetic & Modern**:
  - [x] Desain sistem warna Madrasah Emerald (`#047857`), Champagne Gold (`#D97706`), dan Porcelain Slate (`#F8FAFC`).
  - [x] Komponen UI: `ModernCard` (*rounded-2xl* + micro-border 1px), `ModernButton`, `StatCard`, `Badge`, `SyncStatusWidget`.
  - [x] `AppShell.tsx`: Navigasi adaptif responsif (*Permanent Modern Sidebar* di layar laptop/web dan *Floating Bottom Dock* di layar HP).
- [x] **Rute Layar Aplikasi (Expo Router)**:
  - [x] `/(public)/index.tsx`: Landing page madrasah membaca data berita & pengumuman offline dari SQLite.
  - [x] `/(public)/login.tsx`: Halaman login aesthetic dengan fitur **1-Tap Quick Login** kartu demo.
  - [x] `/(app)/dashboard.tsx`: Dashboard eksekutif multi-peran dengan panel kontrol sinkronisasi dan kartu metrik.
  - [x] `/(app)/profil-saya.tsx`: Fitur edit mandiri profil guru dengan pencatatan status `pending_push`.
  - [x] `/(app)/siswa/index.tsx`: Direktori siswa aktif dengan pencarian nama/NIS/NISN.
  - [x] `/(app)/pegawai/index.tsx`: Direktori guru & tendik dengan pencarian nama/NIP.
  - [x] `/(app)/surat/index.tsx`: Modul surat buku agenda terkunci mutlak dari role Guru & Publik.
  - [x] `/(app)/tahun-ajaran/index.tsx`, `mata-pelajaran/index.tsx`, `kelas/index.tsx`, `pengaturan/index.tsx`.
- [x] **Backend Server Sinkronisasi Ringan**:
  - [x] Server Node.js + Hono di `backend/src/index.ts` ter-bind ke host `0.0.0.0:3000`.
  - [x] Endpoint `GET /api/health`, `GET /api/sync/pull`, `POST /api/sync/push`.
  - [x] Endpoint `POST /api/auth/login` untuk autentikasi hibrida (offline SQLite + fallback server).
- [x] **Penyelesaian Bug & Kompatibilitas**:
  - [x] Migrasi `SafeAreaView` ke `react-native-safe-area-context` dan pembungkusan root layout dengan `SafeAreaProvider`.
  - [x] Penanganan dev server warning WebSocket Metro CLI.
  - [x] Typecheck TypeScript (`tsc --noEmit`) 100% lulus 0 error di mobile dan backend.

---

### [x] Tahap 2: Modul Tahun Ajaran (2 Semester), Master Mata Pelajaran, & Manajemen Kelas/Rombel
- [x] **Modul Tahun Ajaran (2 Semester)** (`mobile/src/app/(app)/tahun-ajaran/index.tsx`):
  - [x] Formulir tambah/edit tahun ajaran (nama, semester: 1 = Ganjil, 2 = Genap, tanggal mulai, tanggal selesai).
  - [x] Transaksi atomik pengaktifan periode semester (`is_active = 1` hanya untuk satu baris, baris lain otomatis `0`).
  - [x] Fitur **Salin Rombel Antar Semester** (menyalin struktur kelas, wali kelas, pengampu, dan siswa dari semester ganjil ke genap).
  - [x] Validasi larangan hapus tahun ajaran yang telah memiliki relasi kelas atau surat.
- [x] **Modul Master Mata Pelajaran** (`mobile/src/app/(app)/mata-pelajaran/index.tsx`):
  - [x] CRUD Master Mapel dinamis (Kode Mapel, Nama Mapel, Kelompok: PAI / Umum / Mulok, Status Aktif).
  - [x] Pencarian dan filter mapel per kelompok kurikulum (Semua, PAI, Umum, Mulok) dengan penghitung badge.
  - [x] Toggle instan status pembelajaran (Aktif Diajarkan / Nonaktif) dengan sinkronisasi lokal `pending_push`.
  - [x] Validasi larangan hapus mata pelajaran yang masih terikat dengan `guru_mapel` atau `pengampu_kelas`.
- [x] **Modul Kelas & Rombel** (`mobile/src/app/(app)/kelas/index.tsx`):
  - [x] Selector dan banner periode aktif dengan kemampuan switch periode untuk melihat arsip rombel lampau.
  - [x] Filter tingkat kelas (Semua, Kelas 7, Kelas 8, Kelas 9) dan pencarian nama rombel / wali kelas.
  - [x] CRUD Rombel Kelas terikat periode tahun ajaran aktif dengan validasi keunikan nama rombel.
  - [x] Pemilihan Wali Kelas dari daftar pegawai berstatus guru aktif.
  - [x] Navigasi 1-tap ke layar detail kelas (`/kelas/[id]`).
- [x] **Layar Detail Rombel Lengkap** (`mobile/src/app/(app)/kelas/[id].tsx`):
  - [x] Header identitas rombel: Tingkat badge, nama kelas, periode tahun ajaran, nama wali kelas & NIP, serta total siswa & pengampu.
  - [x] **Tab 1: Anggota Siswa**:
    - [x] Tampilan daftar siswa terdaftar beserta nomor urut, NIS, NISN, dan gender badge.
    - [x] Modal Tambah Siswa: Memfilter otomatis hanya siswa aktif yang belum ditempatkan pada rombel manapun di semester aktif bersangkutan.
    - [x] Tombol Keluarkan Siswa dari rombel dengan dialog konfirmasi dan soft-delete.
  - [x] **Tab 2: Guru Pengampu & Mata Pelajaran**:
    - [x] Tampilan daftar penugasan guru beserta kode mapel, nama mapel, kelompok kurikulum, dan identitas pengajar.
    - [x] Modal Penugasan: Memilih guru pengajar dan mata pelajaran aktif dengan validasi keunikan relasi.
    - [x] Tombol Hapus Penugasan dengan dialog konfirmasi.
  - [x] Pendaftaran rute dinamis `kelas/[id]` di `mobile/src/app/(app)/_layout.tsx`.

---

### [x] Tahap 3: Modul Guru/Tendik, Relasi `guru_mapel`, Penugasan `pengampu_kelas`, & Fitur Edit Mandiri "Profil Saya"
- [x] **Manajemen Pegawai Lengkap (Admin & TU)** (`mobile/src/app/(app)/pegawai/`):
  - [x] Layar direktori pegawai (`pegawai/index.tsx`) dengan filter jenis (Semua/Guru/Tendik), filter status kepegawaian (PNS/PPPK/GTY/GTT/Honorer), dan pencarian real-time.
  - [x] Layar formulir tambah/edit pegawai (`pegawai/form.tsx`) dengan atribut EMIS Kemenag lengkap (NIP, NUPTK, NPK, PegID, NRG, TMT, SK Pengangkatan).
  - [x] Pemilihan foto profil pegawai lokal via `expo-image-picker`.
  - [x] Enkripsi AES-256 untuk kolom data sensitif (NIK, NPWP, No Rekening) dan blind indexing HMAC-SHA256 pada `nik_hash`.
  - [x] Layar detail pegawai terpadu (`pegawai/[id].tsx`) dengan 4 tab navigasi (Biodata, Mapel Keahlian, Riwayat Pendidikan, dan Berkas Dokumen).
  - [x] Pengelolaan riwayat pendidikan formal multi-jenjang (`riwayat_pendidikan`).
  - [x] Pengunggahan dokumen digital SK Pengangkatan/KTP/Sertifikat via `expo-document-picker`.
- [x] **Relasi Kompetensi Guru (`guru_mapel`)**:
  - [x] Antarmuka pemilihan mata pelajaran keahlian yang diampu masing-masing guru dari Master Mapel pada tab detail pegawai.
- [x] **Penugasan Mengajar Spesifik per Rombel (`pengampu_kelas`)**:
  - [x] **Filter Dinamis Mapel**: Saat memilih Guru di modal penugasan kelas (`kelas/[id].tsx`), daftar mata pelajaran yang muncul difilter otomatis hanya mapel yang ada di `guru_mapel` milik guru tersebut.
  - [x] Dukungan fleksibel: Guru dapat mengampu di satu rombel tanpa terikat di rombel lainnya.
- [x] **Penyempurnaan Edit Mandiri "Profil Saya" (Untuk Guru)** (`mobile/src/app/(app)/profil-saya.tsx`):
  - [x] Fitur edit mandiri biodata pribadi, nomor WhatsApp, email, alamat, pasfoto, dan riwayat pendidikan.
  - [x] Penguncian mutlak atribut struktural madrasah (Jabatan, Status Kepegawaian, TMT, NIP) berstatus *read-only* bagi Guru.
  - [x] Tombol **"Upload Pembaruan Profil"** yang mengirimkan payload mutasi lokal ke endpoint server backend.
- [x] **Generator PDF Biodata Resmi Pegawai** (`mobile/src/utils/pdfGenerator.ts`):
  - [x] Penghasil dokumen PDF kop resmi madrasah MTs Roudhotut Thowalib (Emerald-Gold Kop, data pribadi, EMIS, riwayat pendidikan, mapel diampu, dan tanda tangan legalisasi) via `expo-print` dan `expo-sharing`.

---

### [x] Tahap 4: Modul Siswa Aktif, Mutasi/Alumni, Kenaikan Kelas, Wali Siswa, Cetak PDF Biodata & Form Absensi Kosong
- [x] **Manajemen Siswa Aktif (CRUD Eksklusif Super Admin & Staf TU)**:
  - [x] Form input biodata siswa lengkap (NIS, NISN, NISM, NPSN Asal Sekolah, atribut EMIS) di `mobile/src/app/(app)/siswa/form.tsx`.
  - [x] Validasi keunikan NIK otomatis menggunakan blind index `nik_hash`.
  - [x] Upload foto profil siswa lokal via `expo-image-picker`.
  - [x] Form data orang tua/wali (ayah, ibu, wali opsional; fitur otomatis *"Sama dengan alamat siswa"* jika alamat dikosongkan).
  - [x] Tab berkas dokumen pendukung siswa (scan KK, Akta Kelahiran, Ijazah SD/MI, KIP/PKH via `expo-document-picker`).
- [x] **Pembatasan Hak Akses Siswa**:
  - [x] Penguncian total akses edit/hapus siswa dari akun Guru (*Guru hanya memiliki akses Read-Only*).
  - [x] Pemfilteran otomatis: Guru hanya dapat melihat daftar siswa di rombel yang ia ampu atau walikan pada semester aktif.
  - [x] Penyembunyian kolom sensitif (NIK, KK, penghasilan orang tua) dari tampilan antarmuka Guru.
- [x] **Kenaikan Kelas, Pindah Rombel & Kelulusan Massal** (`mobile/src/app/(app)/kelas/[id].tsx`):
  - [x] Fitur pindah rombel pada periode berjalan (misal 7A ke 7B).
  - [x] Fitur naik kelas massal dengan checklist multi-select siswa dari periode lama ke periode baru tanpa menghapus data riwayat lama.
  - [x] Aksi kelulusan massal siswa kelas 9 (otomatis mengisi `tahun_lulus` dan mengubah status ke `lulus`).
- [x] **Direktori Alumni & Mutasi** (`mobile/src/app/(app)/siswa/alumni.tsx`):
  - [x] Layar tersendiri khusus siswa berstatus lulus, pindah, atau keluar dengan quick stats dan filter badge.
  - [x] Form modal pencatatan tanggal keluar dan catatan mutasi (alasan / sekolah tujuan).
- [x] **Cetak Dokumen PDF Offline** (`mobile/src/utils/pdfGenerator.ts`):
  - [x] **Cetak Buku Induk / Biodata Siswa (PDF)**: Lembar resmi biodata lengkap siswa dengan kop madrasah via `expo-print`.
  - [x] **Cetak Form Absensi Kelas Kosong (PDF)**: Lembar presensi fisik per kelas (landscape) berisi nomor urut, nama & NIS siswa serta 12 kolom pertemuan kosong via `expo-print` dan `expo-sharing`.

---

### [x] Tahap 5: Modul Administrasi Surat Masuk, Surat Keluar (Metode 1), & Generator Surat Keterangan PDF
- [x] **Akses Eksklusif Persuratan**:
  - [x] Seluruh menu dan rute surat dikunci mutlak dari akun Guru dan Publik (baik di navigasi maupun API).
- [x] **Manajemen Surat Masuk** (`mobile/src/app/(app)/surat/index.tsx`):
  - [x] CRUD Surat Masuk (nomor surat, tanggal surat, tanggal diterima, pengirim, perihal, kategori, sifat, lampiran dokumen via `expo-document-picker`).
  - [x] Lampiran file PDF / foto disimpan di direktori dokumen lokal perangkat.
  - [x] Pencarian dan filter surat masuk per kategori, sifat surat (biasa, penting, rahasia), dan tanggal.
- [x] **Manajemen Surat Keluar (Metode 1 - Tanpa Hapus)** (`mobile/src/app/(app)/surat/index.tsx`):
  - [x] Penomoran urut otomatis per tahun kalender (nomor urut kembali ke 1 di awal tahun baru).
  - [x] Penerapan aturan tanpa hapus (*soft delete* maupun *hard delete* dinonaktifkan mutlak).
  - [x] Fitur **Pembatalan Surat**: Mengubah status dari `aktif` ke `dibatalkan` disertai input wajib `alasan_batal` dan penandaan visual pada buku agenda.
  - [x] Buku Agenda Surat Keluar fisik/tabel rapi dengan metrik statistik cepat.
- [x] **Generator Otomatis Surat Keterangan Siswa Aktif (PDF)** (`mobile/src/utils/pdfGenerator.ts`):
  - [x] Form pembuatan surat: Admin/TU memilih siswa aktif dan mengisi tujuan surat (PIP/KIP, beasiswa, bank, lomba) dengan template cepat.
  - [x] Sistem otomatis membuat baris surat keluar baru (mengambil nomor urut agenda berikutnya secara atomik).
  - [x] Menghasilkan dokumen resmi PDF Surat Keterangan lengkap dengan Kop Surat Madrasah (Emerald-Gold), data santri, dan legalisasi ttd Kepala Madrasah via `expo-print` dan `expo-sharing` secara offline.

---

### [x] Tahap 6: CMS Publik (Landing Page, Berita, Pengumuman), Import/Eksport Excel, & Pencatatan Log Eksport
- [x] **Penyempurnaan CMS Berita & Pengumuman**:
  - [x] CRUD Berita madrasah oleh Admin/TU (judul, auto-slug, ringkasan, isi, status: draft/terbit, thumbnail foto).
  - [x] Sanitasi konten berita untuk mencegah serangan injeksi/XSS.
  - [x] CRUD Pengumuman madrasah (rentang tanggal tayang, status aktif/nonaktif).
  - [x] Filter otomatis di layar publik: Hanya menampilkan berita `terbit` dan pengumuman yang berada dalam rentang tanggal aktif.
- [x] **Modul Eksport Data ke Excel (.xlsx) Offline**:
  - [x] Eksport data siswa aktif, pegawai, dan surat menyurat ke format `.xlsx` menggunakan `exceljs / xlsx`.
  - [x] Pembatasan eksport guru: Hanya siswa di kelasnya tanpa kolom sensitif terenkripsi.
- [x] **Pencatatan Log Eksport Otomatis**:
  - [x] Setiap aksi eksport otomatis mencatat entri ke tabel `log_eksport` (user, waktu, jenis data, filter, jumlah baris, nama file) dengan `sync_status = 'pending_push'`.
  - [x] Layar audit Log Eksport khusus Super Admin (*read-only*).
- [x] **Modul Import Data Excel**:
  - [x] Template resmi file Excel untuk import siswa dan pegawai.
  - [x] Pemilihan file via `expo-document-picker`.
  - [x] Validasi baris per baris terhadap database SQLite lokal (pencocokan NISN/NIP/nik_hash) dengan opsi lewati atau perbarui.

---

### [ ] Tahap 7: Mesin Sinkronisasi Manual (Wi-Fi LAN & Server) + Workflow GitHub Actions APK
- [ ] **Penyempurnaan Endpoint Sinkronisasi di Backend (`/backend`)**:
  - [ ] `POST /api/sync/push`:
    - Validasi token JWT & RBAC: Role guru ditolak 403 jika mengirim tabel selain data dirinya sendiri (`pegawai`, `riwayat_pendidikan`, `dokumen_pendukung`).
    - Resolusi konflik *Last-Write-Wins* berbasis `updated_at`.
    - Auto-resolusi nomor urut surat keluar jika terjadi bentrok offline simultan (`nomor_urut = MAX + 1`).
  - [ ] `GET /api/sync/pull?since=...`:
    - Pengiriman data delta (`updated_at > since`).
    - *DTO Serializer* ketat: Membuang kolom NIK/KK dan tabel surat jika pemanggil adalah akun Guru atau Publik.
  - [ ] `POST /api/sync/upload-file`: Endpoint upload berkas fisik (foto, scan PDF lampiran) ke direktori server privat.
- [ ] **Pengujian Sinkronisasi Wi-Fi LAN**:
  - [ ] Pengujian upload mutasi dari HP fisik ke laptop via IP LAN Wi-Fi (`http://10.87.253.15:3000`).
  - [ ] Pengujian download pembaruan berita & pengumuman dari server ke HP fisik.
  - [ ] Verifikasi transaksi SQLite `db.withTransactionAsync` saat rekonsiliasi data masuk di HP.
- [ ] **Workflow GitHub Actions untuk Kompilasi APK Otomatis** (`.github/workflows/build-apk.yml`):
  - [ ] Setup workflow runner Ubuntu di GitHub Actions untuk build Android release `.apk`.
  - [ ] Menjalankan `npx expo prebuild --platform android` dan `./gradlew assembleRelease` di cloud server.
  - [ ] Otomatis mengunggah hasil file `.apk` ke GitHub Artifacts / GitHub Releases.
  - [ ] **Nol beban RAM di laptop** (pengguna tinggal mengunduh file `.apk` siap pasang).
