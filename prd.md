w# PRD: Sistem Database & Manajemen Sekolah MTs Roudhotut Thowalib (Versi React Native Local-First — Lightweight Laptop + Expo Go Wi-Fi + GitHub Actions Edition)

## 1\. Ringkasan

Aplikasi lintas platform (**Android & Web**) berbasis **React Native (Expo Router)** dengan pendekatan arsitektur **Local-First (Full Offline)** menggunakan database **SQLite lokal (expo-sqlite)** langsung di perangkat pengguna. Aplikasi ini mengelola data siswa (termasuk alumni dan mutasi), guru, tendik, master mata pelajaran, kelas, tahun ajaran (2 semester), arsip dokumen digital, cetak surat keterangan otomatis, surat masuk dan keluar, serta halaman publik (_landing page_, berita, pengumuman).

Seluruh operasional harian—termasuk membaca berita dan pengumuman—berjalan 100% secara _offline_ menggunakan database SQLite di perangkat, dilengkapi fitur tombol manual **Upload Data (Push)** dan **Tarik Data (Pull/Download)** ke server backend **Node.js (Hono/Express)** di _shared hosting_. Hak **Upload Data** dikunci khusus untuk **Admin (Super Admin & Staf TU)** untuk seluruh data operasional serta **Guru** terbatas hanya untuk pembaruan data profil pribadinya sendiri ("Profil Saya"), sedangkan **Client (Guru untuk data akademik & Pengunjung Publik)** hanya melakukan **Tarik Data (Download)** dari server.

Mengingat pengembangan dilakukan pada **Laptop dengan spesifikasi RAM terbatas**, alur kerja dirancang **100% bebas Android Studio dan bebas Emulator**: pengujian harian dilakukan secara ringan melalui **HP Fisik menggunakan aplikasi Expo Go di jaringan Wi-Fi yang sama (LAN)** serta **Browser Laptop (Web)**, sedangkan kompilasi file .apk / .aab setelah aplikasi selesai dilakukan sepenuhnya di _cloud_ menggunakan **GitHub Actions**.

## 2\. Tujuan dan Indikator Keberhasilan

**Tujuan**

- Memusatkan data madrasah sesuai standar kebutuhan administrasi dan EMIS Kemenag dalam satu sistem yang rapi, cepat, dan dapat dioperasikan secara _full offline_ di perangkat pengguna (HP maupun Web/Laptop).
- Menyediakan mekanisme sinkronisasi manual (**Upload Data** & **Tarik Data**) ke server _shared hosting_ dengan rekonsiliasi data terstruktur berbasis UUID, _timestamp_, _soft delete_, dan status sinkronisasi.
- Menyimpan riwayat kelas siswa per tahun ajaran dan semester (Semester 1 Ganjil & Semester 2 Genap) serta riwayat kelulusan/mutasi tanpa kehilangan data lama.
- Mengelola master mata pelajaran secara dinamis serta memetakan kompetensi mata pelajaran guru dan penugasan mengajar secara spesifik per rombel/kelas (misal: mengajar di 7A tetapi tidak di 7B).
- Mengarsipkan surat masuk, surat keluar, dan berkas dokumen pendukung secara tertib khusus untuk pihak administrasi (Super Admin & Staf TU).
- Menyediakan fitur cetak cepat secara _offline_ (Surat Keterangan Siswa Aktif, Buku Induk/Biodata PDF, dan Form Absensi Kelas Kosong).
- Melindungi data pribadi siswa dan pegawai dengan pembatasan akses per peran dan per _field_, enkripsi data sensitif, serta _blind indexing_ untuk mencegah duplikasi.
- Memberikan kemandirian kepada Guru untuk mengedit dan menyinkronkan data profil pribadinya sendiri ("Profil Saya") ke server tanpa fitur pengajuan tiket perbaikan data, sementara pengeditan data siswa dikunci khusus untuk Admin dan Staf TU.
- Menyediakan wajah publik madrasah (profil, berita, pengumuman) yang bekerja secara _offline-first_ dan diperbarui melalui tombol **Tarik Data**.

**Indikator Keberhasilan**

- Aplikasi beroperasi penuh secara _offline_ dengan SQLite lokal untuk seluruh fitur tampilan, CRUD, eksport, dan cetak PDF, serta berjalan mulus di dalam **Expo Go** tanpa membutuhkan _custom native module_ di luar ekosistem standar Expo SDK.
- Guru dapat mengedit data profil pribadinya sendiri dan melakukan **Upload Data** khusus untuk profilnya ke server, namun tidak dapat mengedit data siswa maupun mengunggah perubahan tabel lain ke server.
- Data siswa hanya dapat ditambah, diedit, atau dihapus oleh Super Admin dan Staf TU.
- Guru tidak dapat melihat atau mengeksport siswa di luar kelas yang diampu/diwalikan pada tahun ajaran dan semester aktif.
- Fitur Surat Masuk, Surat Keluar, dan Cetak Surat Keterangan hanya tersedia dan hanya dapat diakses oleh Super Admin dan Staf TU (tidak muncul dan tidak disinkronkan ke perangkat Guru maupun Publik).
- Saat menugaskan guru di suatu kelas (misal 7A), _dropdown_ pilihan mata pelajaran hanya menampilkan mata pelajaran yang dimiliki guru tersebut pada daftar mapel guru.
- Berita dan pengumuman terbaru dari server berhasil tampil di perangkat _client_ setelah pengguna menekan tombol **Tarik Data**.
- Penomoran surat keluar berurut otomatis, bebas konflik _unique constraint_ melalui sistem status (aktif/dibatalkan).
- Setiap eksport data tercatat otomatis di log eksport.

## 3\. Di Luar Lingkup (Tahap Ini)

Input absensi harian digital, pengolahan nilai/e-Rapor, manajemen keuangan (SPP/syahriyah), penyusunan jadwal pelajaran per jam, dan sinkronisasi otomatis _real-time_ di latar belakang dicatat untuk pengembangan tahap berikutnya. _(Catatan: Cetak lembar form absensi fisik/kosong tetap disediakan sebagai alat bantu kelas, dan aplikasi sudah berbentuk universal mobile & web lewat React Native Expo)_.

## 4\. Pengguna dan Hak Akses

### 4.1 Peran

- **Super Admin**: Mengelola seluruh data operasional di lokal dan server, manajemen akun pengguna, pengaturan sistem madrasah, memiliki hak penuh **Upload Data (Push)** dan **Tarik Data (Pull)** untuk seluruh tabel, melihat log eksport, penghapusan permanen (_force delete_), dan unduh _backup_ sistem.
- **Staf TU (Operator)**: Mengelola seluruh data operasional harian (siswa, pegawai, master mata pelajaran, kelas, tahun ajaran & semester, surat masuk/keluar, cetak dokumen, import/eksport, berita, dan pengumuman) serta melakukan sinkronisasi data operasional ke server, tetapi tidak dapat mengelola akun pengguna Admin lain, melihat log eksport sistem, atau mengubah pengaturan inti sistem.
- **Guru (Client)**:
  - Melihat (_read-only_) data siswa sesuai batasan kelas yang diampu/diwalikan pada tahun ajaran & semester aktif.
  - Mengunduh/mencetak form absensi kosong untuk kelasnya.
  - Mengedit data profil dan dokumen pribadinya sendiri pada menu **"Profil Saya"** dan melakukan **Upload Data** khusus untuk pembaruan data dirinya sendiri ke server.
  - Melakukan **Tarik Data (Download)** dari server untuk mendapatkan pembaruan data kelas, siswa, berita, dan pengumuman terbaru.
  - Tidak memiliki akses ke fitur surat-menyurat dan tidak dapat mengedit data siswa.
- **Publik (Client Tanpa Login)**: Mengakses layar/halaman _landing page_, berita, dan pengumuman secara _offline_ dari SQLite lokal, serta menggunakan tombol **Tarik Data** untuk mengunduh berita dan pengumuman terbaru dari server.

### 4.2 Matriks Akses Fitur

| Fitur                                                          | Super Admin     | Staf TU (Operator)          | Guru (Client)                                             | Publik (Client)                                |
| -------------------------------------------------------------- | --------------- | --------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| **Sinkronisasi: Upload Data ke Server (Push)**                 | **Semua tabel** | **Semua tabel operasional** | **Hanya data "Profil Saya" sendiri**                      | **Tidak**                                      |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| **Sinkronisasi: Tarik Data dari Server (Pull/Download)**       | **Semua data**  | **Semua data**              | **Data kelasnya, profil, berita & pengumuman**            | **Hanya berita, pengumuman & profil madrasah** |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Lihat siswa & alumni                                           | Semua siswa     | Semua siswa                 | Hanya siswa kelas yang diampu/diwalikan (semester aktif)  | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| **Tambah, ubah, hapus (_soft delete_) data siswa**             | **Ya**          | **Ya**                      | **Tidak (Read-Only)**                                     | **Tidak**                                      |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Lihat daftar guru/tendik lain                                  | Data lengkap    | Data lengkap                | Data ringkas                                              | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| **Lihat & Edit "Profil Saya" (data lengkap diri sendiri)**     | **Ya**          | **Ya**                      | **Ya (Bisa Edit & Upload ke Server)**                     | **Tidak**                                      |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Kelola Master Mata Pelajaran & Mapel Keahlian Guru             | Ya              | Ya                          | Tidak                                                     | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Lihat kelas, tahun ajaran & semester                           | Ya              | Ya                          | Ya                                                        | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Atur guru pengampu per kelas, anggota kelas, naik/pindah kelas | Ya              | Ya                          | Tidak                                                     | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| **Lihat & Kelola Surat Masuk / Surat Keluar**                  | **Ya (Semua)**  | **Ya (Semua)**              | **Tidak Tersedia**                                        | **Tidak Tersedia**                             |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| **Pembatalan surat keluar (ubah status ke dibatalkan)**        | **Ya**          | **Ya**                      | **Tidak Tersedia**                                        | **Tidak Tersedia**                             |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| **Cetak Surat Keterangan, Buku Induk, Biodata**                | **Ya**          | **Ya**                      | **Tidak Tersedia**                                        | **Tidak Tersedia**                             |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Cetak Form Absensi Kosong per Kelas                            | Ya              | Ya                          | Ya (khusus kelasnya)                                      | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Tambah, ubah, hapus (_soft delete_) data operasional madrasah  | Ya              | Ya                          | Tidak                                                     | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Hapus permanen (_force delete_)                                | Ya              | Tidak                       | Tidak                                                     | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Eksport data (Excel)                                           | Semua data      | Semua data                  | Sesuai batasan lihat (tanpa surat & tanpa kolom sensitif) | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Import data (siswa & pegawai)                                  | Ya              | Ya                          | Tidak                                                     | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Lihat Log Eksport                                              | Ya              | Tidak                       | Tidak                                                     | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Kelola berita dan pengumuman (CRUD)                            | Ya              | Ya                          | Tidak                                                     | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Baca berita dan pengumuman (via Tarik Data)                    | Ya              | Ya                          | Ya                                                        | Ya                                             |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Kelola akun pengguna                                           | Ya              | Tidak                       | Tidak                                                     | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |
| Pengaturan madrasah & Unduh Backup Data                        | Ya              | Tidak                       | Tidak                                                     | Tidak                                          |
| ---                                                            | ---             | ---                         | ---                                                       | ---                                            |

### 4.3 Akses per Field

| Data                                                                                                                             | Super Admin & Staf TU | Guru (Client)                                           | Publik (Client)          |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------- | ------------------------ |
| Pegawai lain: nama, jenis, jabatan, mata pelajaran yang diampu, no HP, email, foto, status aktif                                 | Ya                    | Ya (_Read-only_)                                        | Tidak                    |
| ---                                                                                                                              | ---                   | ---                                                     | ---                      |
| Pegawai lain: NIK, NUPTK, PegID, NPK, NRG, NIP, NPWP, rekening, SK, riwayat pendidikan, dokumen pendukung, alamat, tanggal lahir | Ya                    | Tidak                                                   | Tidak                    |
| ---                                                                                                                              | ---                   | ---                                                     | ---                      |
| **Pegawai (Milik Sendiri / Profil Saya): seluruh _field_, riwayat pendidikan & dokumen pendukung milik sendiri**                 | **Ya**                | **Ya (Dapat Melihat, Mengedit & Mengunggah ke Server)** | **Tidak**                |
| ---                                                                                                                              | ---                   | ---                                                     | ---                      |
| Siswa: biodata umum (NIS, NISN, NISM, TTL, jenis kelamin), alamat, kontak, asal sekolah, status                                  | Ya (CRUD)             | Ya (_Read-only_, hanya siswa di kelasnya)               | Tidak                    |
| ---                                                                                                                              | ---                   | ---                                                     | ---                      |
| Siswa: NIK, no KK, dokumen pendukung (scan KK/Akta/Ijazah/KIP)                                                                   | Ya (CRUD)             | Tidak                                                   | Tidak                    |
| ---                                                                                                                              | ---                   | ---                                                     | ---                      |
| Orang tua/wali: nama, status, pekerjaan, pendidikan, alamat, no HP                                                               | Ya (CRUD)             | Ya (_Read-only_, hanya siswa di kelasnya)               | Tidak                    |
| ---                                                                                                                              | ---                   | ---                                                     | ---                      |
| Orang tua/wali: NIK, penghasilan, kartu bantuan                                                                                  | Ya (CRUD)             | Tidak                                                   | Tidak                    |
| ---                                                                                                                              | ---                   | ---                                                     | ---                      |
| **Seluruh Data Surat Masuk & Surat Keluar**                                                                                      | **Ya (CRUD)**         | **Tidak Memiliki Akses**                                | **Tidak Memiliki Akses** |
| ---                                                                                                                              | ---                   | ---                                                     | ---                      |
| Berita (Terbit), Pengumuman (Aktif), Pengaturan Identitas Madrasah                                                               | Ya (CRUD)             | Ya (_Read-only_)                                        | Ya (_Read-only_)         |
| ---                                                                                                                              | ---                   | ---                                                     | ---                      |

_Catatan Penting:_ Aturan ini wajib diterapkan baik pada query SQLite lokal maupun di sisi server backend sinkronisasi (melalui _Middleware RBAC_, _query filter_, dan eksplisit memilih kolom pada _response serializer/DTO_ saat proses **Tarik Data** dan **Upload Data**), sehingga data surat atau kolom sensitif siswa tidak pernah dikirim ke SQLite lokal milik Guru ataupun Publik.

## 5\. Struktur Navigasi (Expo Router — Responsif Mobile & Layar Lebar Laptop/Web)

**Layar Publik (public)**:

- **Beranda (_Landing Page_)**, **Berita** (daftar, detail), **Pengumuman**, **Login**.
- Dilengkapi tombol **"Sinkronisasi / Tarik Data Terbaru"** di bagian atas layar untuk mengunduh berita, pengumuman, dan profil madrasah terbaru dari server.

**Layar Setelah Login (app) (Sidebar Tetap di Layar Lebar Laptop / Drawer & Tab di Layar Mobile)**

- **Dashboard** (Dilengkapi **Panel Sinkronisasi**: Tombol **Tarik Data** untuk semua peran, dan tombol **Upload Data** untuk Admin serta upload profil mandiri untuk Guru).
- **Profil Saya** (Bisa dilihat dan **diedit langsung** oleh pengguna bersangkutan, dilengkapi tombol **Sinkronkan Profil Saya ke Server** bagi Guru).
- **Database**:
  - **Siswa Aktif** (Admin/TU: CRUD penuh; Guru: _Read-only_ khusus kelasnya)
  - **Alumni & Mutasi** _(Khusus Super Admin & Staf TU)_
  - **Guru & Tendik**
- **Manajemen Madrasah**:
  - **Tahun Ajaran & Semester** (2 Semester: Ganjil & Genap)
  - **Mata Pelajaran** _(Master Mapel)_
  - **Kelas & Rombel** (Wali Kelas, Guru Pengampu per Mapel, Anggota Kelas)
- **Administrasi Surat** _(Khusus Super Admin & Staf TU)_:
  - **Surat Masuk**
  - **Surat Keluar & Cetak Surat Keterangan**
- **Layanan & Konten** _(CRUD Khusus Super Admin & Staf TU)_:
  - **Berita**
  - **Pengumuman**
- **Sistem & Keamanan** _(Khusus Super Admin)_:
  - **Pengguna**
  - **Log Eksport**
  - **Pengaturan Madrasah & Backup Data**

## 6\. Kebutuhan Fungsional

### 6.1 Autentikasi Lokal & Pengguna

- Login menggunakan email dan password; sesi autentikasi dan token JWT disimpan aman di expo-secure-store pada Android / httpOnly cookie atau penyimpanan lokal terenkripsi pada Web agar aplikasi dapat dibuka kembali dan digunakan secara _full offline_.
- Pembatasan percobaan login (_rate limiting_) pada API login dan kunci sementara di sisi lokal untuk mencegah _brute force_.
- Registrasi publik dinonaktifkan sepenuhnya; akun hanya dapat dibuat oleh Super Admin.
- Super Admin membuat akun (super_admin, staf_tu, atau guru), menghubungkannya ke data pegawai (users.pegawai_id), dan dapat mereset password.
- Satu akun terhubung ke maksimal satu data pegawai (users.pegawai_id), dan jika akun guru belum terhubung ke data pegawai, layar "Profil Saya" serta "Kelas Saya" menampilkan pesan instruksi untuk menghubungi admin.
- **Kriteria Penerimaan**: Guru yang mencoba mengakses rute khusus Admin/TU (seperti menu Surat atau tambah/edit Siswa) ditolak baik di navigasi lokal maupun di server (403 Forbidden).

### 6.2 Dashboard & Panel Kontrol Sinkronisasi

- **Panel Sinkronisasi Manual**:
  - Menampilkan waktu sinkronisasi terakhir (last_synced_at) dan jumlah perubahan lokal yang belum diunggah (pending_push count).
  - **Super Admin & Staf TU**: Memiliki tombol **\[Upload Data ke Server\]** dan **\[Tarik Data dari Server\]**.
  - **Guru**: Memiliki tombol **\[Tarik Data Terbaru\]** untuk memperbarui data kelas, berita, dan pengumuman, serta tombol **\[Upload Pembaruan Profil Saya\]** yang aktif apabila Guru melakukan perubahan pada data pribadinya.
- **Kartu Ringkasan Super Admin & Staf TU**: Jumlah siswa aktif, alumni, guru, tendik, jumlah kelas pada tahun ajaran & semester aktif, daftar surat terbaru, serta pengumuman aktif.
- **Kartu Ringkasan Guru**: Daftar "Kelas Saya" (kelas yang diampu/diwalikan pada tahun ajaran & semester aktif beserta mata pelajaran dan jumlah siswa) serta pengumuman aktif.

### 6.3 Tahun Ajaran dan 2 Semester

- Setiap tahun ajaran memiliki 2 semester: **Semester 1 (Ganjil)** dan **Semester 2 (Genap)**.
- CRUD (Super Admin & Staf TU): nama tahun ajaran (mis. 2026/2027), semester (1 = Ganjil, 2 = Genap), tanggal mulai, tanggal selesai, dan status aktif (is_active).
- Kombinasi (nama, semester) bersifat unik (contoh: 2026/2027 - Semester 1 (Ganjil) dan 2026/2027 - Semester 2 (Genap)).
- Hanya boleh ada satu periode (Tahun Ajaran + Semester) berstatus aktif (is_active = 1) pada satu waktu; pengaktifan satu periode otomatis menonaktifkan periode lainnya di dalam satu transaksi database SQLite (db.transaction).
- **Fitur Salin Rombel Antar Semester**: Saat berpindah dari Semester 1 ke Semester 2 di tahun ajaran yang sama, Admin/TU dapat menyalin struktur kelas, wali kelas, guru pengampu, dan anggota kelas secara otomatis.
- **Kriteria Penerimaan**: Tahun ajaran/semester yang sudah memiliki relasi kelas atau surat tidak dapat dihapus.

### 6.4 Master Mata Pelajaran & Penugasan Guru per Kelas

- **Master Mata Pelajaran (CRUD oleh Super Admin & Staf TU)**:
  - Menambahkan, mengubah, dan menonaktifkan mata pelajaran sesuai kebutuhan madrasah: Kode Mapel (mis. QH, AA, FIQ, SKI, BING, MTK), Nama Mata Pelajaran, Kelompok (PAI, Umum, Muatan Lokal), dan Status Aktif.
- **Penugasan Kompetensi Mapel pada Guru (guru_mapel)**:
  - Saat menambah atau mengedit data Pegawai berjenis guru, Admin/TU memilih mata pelajaran apa saja yang diampu oleh guru tersebut dari daftar Master Mata Pelajaran.
  - Satu guru dapat memiliki satu atau beberapa mata pelajaran keahlian.
- **Penugasan Mengajar Spesifik per Kelas (pengampu_kelas)**:
  - Ketika Admin/TU mengatur guru pengampu di sebuah kelas (misal Kelas 7A), saat memilih seorang Guru, **pilihan mata pelajaran yang muncul hanya mata pelajaran yang terdaftar pada guru tersebut** di tabel guru_mapel.
  - Penugasan bersifat independen per kelas/rombel: Guru A dapat ditugaskan mengajar Matematika di kelas 7A, tetapi tidak mengajar di kelas 7B (di mana kelas 7B dapat diajar oleh Guru B).
  - Satu guru dapat mengajar lebih dari satu mata pelajaran di kelas yang sama (selama mata pelajaran tersebut ada di daftar kompetensi guru yang bersangkutan).

### 6.5 Kelas, Kenaikan Kelas, dan Perpindahan Rombel

- Kelas terikat ke satu periode tahun ajaran & semester (tahun_ajaran_id), memiliki tingkat (7, 8, atau 9), nama kelas (7A, 7B, dst.), satu wali kelas, dan banyak guru pengampu beserta mata pelajarannya.
- Layar detail kelas menampilkan: informasi wali kelas, daftar guru pengampu beserta mata pelajaran yang diajarkan di kelas tersebut, dan daftar siswa.
- **Pengelolaan Anggota & Pengampu** (Super Admin & Staf TU):
  - **Atur Guru Pengampu**: Memilih guru dan mata pelajaran (terfilter sesuai mapel guru tersebut) untuk kelas bersangkutan.
  - **Tambah Siswa**: Memasukkan siswa yang belum memiliki kelas di periode tahun ajaran/semester tersebut.
  - **Pindah Kelas (Periode Aktif)**: Memindahkan siswa dari satu kelas ke kelas lain pada periode yang sama (misal: dari 7A ke 7B) dengan melakukan _update_ pada kolom kelas_id di tabel anggota_kelas.
  - **Naik Kelas & Kelulusan Massal**: Memilih kelas asal (tahun ajaran lama) dan kelas tujuan (tahun ajaran baru), memilih daftar siswa (_multi-select checkbox_), lalu sistem membuat baris anggota_kelas baru tanpa menghapus riwayat di kelas lama; untuk kelas 9 tersedia aksi meluluskan siswa yang otomatis mengubah status siswa menjadi lulus dan mengisi tahun_lulus.
- **Cetak Form Absensi Kosong**: Tombol pada layar detail kelas untuk mencetak/membagikan lembar daftar hadir fisik (PDF menggunakan expo-print / expo-sharing atau Excel) secara _offline_ berisi daftar nama & NIS siswa beserta kolom tanggal/pertemuan kosong, yang dapat diakses oleh Super Admin, Staf TU, serta Guru wali/pengampu kelas tersebut.
- **Kriteria Penerimaan**: Satu siswa tidak dapat terdaftar di dua kelas berbeda pada periode tahun ajaran dan semester yang sama.

### 6.6 Siswa, Alumni & Mutasi, serta Dokumen Siswa (Hanya Edit oleh Admin & TU)

- **Daftar Siswa Aktif**: Menampilkan siswa berstatus aktif dengan pencarian (nama, NIS, NISN), filter (kelas, jenis kelamin), dan _pagination_ dari SQLite lokal.
- **Direktori Alumni & Mutasi** _(Khusus Admin & TU)_: Submenu/tab terpisah untuk menampilkan siswa berstatus lulus, pindah, atau keluar, dilengkapi pencarian nama/NISN dan filter berdasarkan status serta tahun lulus/keluar.
- **CRUD & Validasi Duplikasi (Eksklusif Super Admin & Staf TU)**:
  - **Hanya Super Admin dan Staf TU yang dapat menambah, mengedit, atau menghapus (_soft delete_) data siswa**, termasuk unggah foto profil menggunakan expo-image-picker.
  - Validasi keunikan NIK dilakukan otomatis menggunakan nik_hash (_Blind Indexing_) sehingga sistem menolak input jika NIK sudah terdaftar pada siswa lain.
  - Perubahan status ke pindah atau keluar mewajibkan pengisian tanggal_keluar dan catatan_mutasi (alasan/sekolah tujuan).
- **Layar Detail Siswa** terbagi menjadi 4 tab:
  1. **Data Diri** (termasuk NISN, NIS, NISM, dan NPSN Sekolah Asal).
  2. **Data Ayah, Ibu, dan Wali (opsional)**: Jika kolom alamat orang tua/wali dikosongkan, antarmuka otomatis menampilkan keterangan _"Sama dengan alamat siswa"_.
  3. **Riwayat Kelas**: Daftar kelas siswa dari tahun ajaran/semester ke tahun ajaran/semester berikutnya.
  4. **Dokumen Pendukung** _(Hanya tampil untuk Super Admin & Staf TU)_: Unggah (expo-document-picker) dan lihat berkas digital siswa (Scan KK, Akta Kelahiran, Ijazah SD/MI, KIP/PKH).
- **Cetak Buku Induk / Biodata Siswa (PDF)**: Tombol khusus bagi Super Admin & Staf TU untuk mencetak/membagikan lembar biodata lengkap siswa berformat PDF resmi secara _offline_.
- **Kriteria Penerimaan**: Guru hanya dapat melihat (_read-only_) siswa yang berada di kelas yang ia ampu/walikan pada periode aktif; tidak ada fitur edit siswa maupun pengajuan perbaikan data siswa bagi Guru.

### 6.7 Guru, Tendik, dan Edit Mandiri "Profil Saya"

- Satu entitas pegawai dengan pembeda jenis (guru atau tendik) dan status_kepegawaian (PNS, PPPK, GTY, GTT, Honorer).
- Mencakup atribut Kemenag: NPK (Nomor Pendidik Kemenag), PegID, NUPTK, dan NRG (Nomor Registrasi Guru).
- Daftar pegawai dilengkapi pencarian (nama, NUPTK, PegID, NIP) dan filter (jenis, status kepegawaian, mata pelajaran, status aktif).
- **Super Admin & Staf TU**: CRUD penuh (_soft delete_), penentuan mata pelajaran guru (guru_mapel), pengelolaan riwayat pendidikan, data SK, NPWP, rekening, unggah berkas dokumen pendukung pegawai, serta tombol **Cetak Biodata Pegawai (PDF)**.
- **Guru (Saat Melihat Rekan Sejawat)**: Hanya dapat melihat data ringkas (nama, jenis, jabatan, mata pelajaran yang diampu, no HP, email, foto, status aktif).
- **Fitur Edit Mandiri & Sinkronisasi "Profil Saya" (Untuk Guru)**:
  - Fitur pengajuan perbaikan data dihilangkan; sebagai gantinya, pada menu **Profil Saya**, Guru dapat melihat **dan mengedit sendiri secara langsung** data pribadinya (biodata diri, NIK, alamat, kontak, foto profil, NPWP, rekening, menambah/mengubah baris riwayat_pendidikan, serta mengunggah dokumen_pendukung pribadinya seperti KTP, KK, SK, dan Sertifikat Pendidik).
  - Kolom penugasan struktural madrasah (seperti jenis, status_aktif, jabatan, daftar guru_mapel, dan daftar pengampu_kelas) tetap dikunci (_read-only_ bagi Guru) dan hanya dapat diubah oleh Admin/TU.
  - Setiap perubahan yang disimpan Guru pada menu **Profil Saya** akan mengubah sync_status = 'pending_push' di SQLite lokal perangkat Guru, dan Guru dapat menekan tombol **Upload Pembaruan Profil** untuk menyinkronkan pembaruan data dirinya tersebut langsung ke server.

### 6.8 Surat Masuk, Surat Keluar (Metode 1), dan Generator Cetak Surat (Khusus Admin & TU)

- **Akses Eksklusif**: Seluruh fitur Surat Masuk, Surat Keluar, dan Generator Cetak Surat Keterangan **hanya tersedia untuk Super Admin dan Staf TU**. Guru dan Publik tidak memiliki akses sama sekali ke menu maupun data surat.
- **Pencarian & Filter**: Nomor surat, perihal, pengirim/tujuan, rentang tanggal, kategori, sifat surat, dan status surat, dilengkapi _pagination_.
- **Aturan Khusus Surat Keluar (Metode 1 - Tanpa Hapus)**:
  - Nomor urut surat keluar di-generate otomatis per tahun dan kembali ke 1 pada pergantian tahun baru (UNIQUE (tahun, nomor_urut)), namun nomor surat lengkap tetap dapat disesuaikan manual jika diperlukan.
  - **Data Surat Keluar tidak dapat dihapus** (tidak menggunakan _soft delete_ maupun _hard delete_) demi menjaga keutuhan nomor urut dan menghindari bentrok _unique constraint_.
  - Jika surat keluar batal digunakan atau salah input, Admin/TU mengubah status surat dari aktif menjadi dibatalkan dan wajib mengisi alasan_batal, sehingga nomor urut tetap tercatat dalam sejarah penomoran sebagai surat batal.
- **Generator Cetak Surat Keterangan Siswa Aktif (PDF)**:
  - Admin/TU memilih siswa aktif dan mengisi keperluan surat (misal: persyaratan PIP/KIP, lomba, atau administrasi bank), lalu sistem otomatis mencatat baris baru di surat_keluar (mengambil nomor urut berikutnya) dan menghasilkan file PDF Surat Keterangan lengkap dengan Kop Madrasah dan tanda tangan Kepala Madrasah secara _offline_ menggunakan expo-print.
- **Lampiran Surat**: Unggahan lampiran (PDF maksimal 5 MB atau gambar maksimal 2 MB) disimpan di direktori dokumen lokal aplikasi dan diunggah ke _private storage_ server saat Admin menekan tombol **Upload Data**.

### 6.9 Berita, Pengumuman, dan Landing Page (Offline-First dengan Sinkronisasi)

- **Berita (CRUD oleh Super Admin & Staf TU)**: judul, slug otomatis, ringkasan, isi (_rich text_ / Markdown editor), thumbnail, status (draft/terbit), tanggal terbit. Isi berita disanitasi untuk mencegah XSS.
- **Pengumuman (CRUD oleh Super Admin & Staf TU)**: judul, isi, tanggal mulai tayang, tanggal berakhir, status aktif.
- **Landing Page**: Menampilkan Hero (nama, NSM/NPSN, dan logo madrasah), profil singkat, visi-misi, berita terbaru berstatus terbit, pengumuman aktif yang berada dalam rentang tanggal tayang, serta kontak dan alamat lengkap yang ditarik dinamis dari tabel pengaturan di SQLite lokal.
- **Mekanisme Update Berita & Pengumuman**:
  - Admin membuat/mengedit berita dan pengumuman secara lokal lalu menekan tombol **Upload Data** untuk mempublikasikannya ke server _shared hosting_.
  - Pengguna _client_ (Guru & Pengunjung Publik) membaca berita dan pengumuman langsung dari SQLite lokal perangkatnya. **Jika ingin mengetahui berita dan pengumuman terbaru**, pengguna harus menekan tombol **Tarik Data (Sinkronisasi Download)** terlebih dahulu agar aplikasi mengunduh konten terbaru dari server ke SQLite lokal.

### 6.10 Import, Eksport, dan Log Eksport

- **Eksport (Excel .xlsx secara Offline)**:
  - Tersedia untuk data siswa, pegawai, surat masuk, dan surat keluar (surat hanya untuk Admin/TU) sesuai filter pencarian yang sedang aktif di SQLite lokal.
  - Khusus Guru: Eksport hanya tersedia untuk daftar siswa di kelasnya pada semester aktif tanpa menyertakan kolom sensitif/terenkripsi.
- **Log Eksport**:
  - Setiap aktivitas eksport wajib tercatat otomatis ke tabel log_eksport lokal (berisi pengguna, waktu, jenis data, filter JSON, jumlah baris, nama file) dengan sync_status = 'pending_push' untuk disinkronkan ke server.
  - Layar Log Eksport hanya dapat dilihat oleh Super Admin (_read-only_).
- **Import Data Siswa & Pegawai (Super Admin & Staf TU)**:
  - Alur: Unduh template resmi Excel \\to isi data \\to pilih file lewat expo-document-picker \\to validasi per baris terhadap SQLite lokal \\to simpan dengan sync_status = 'pending_push' \\to tampilkan laporan hasil (jumlah berhasil ditambahkan/diperbarui, serta daftar baris gagal).
  - Kunci pencocokan siswa: nisn (cadangan: nis, atau nik_hash).
  - Kunci pencocokan pegawai: nuptk, lalu pegid, lalu nik_hash.
  - Tersedia opsi penanganan data yang sudah ada: **Lewati** atau **Perbarui**.

### 6.11 Pengaturan Madrasah dan Backup Data Terpadu

- **Pengaturan Madrasah (Khusus Super Admin)**: Mengelola nama madrasah, NSM, NPSN, akreditasi, logo, kop surat, nama & NIP/PegID Kepala Madrasah, alamat, telepon, email, visi, dan misi.
- **Unduh Backup Data Lokal & Server (Khusus Super Admin)**:
  - Mencadangkan file database SQLite beserta seluruh folder dokumen dan foto lokal ke dalam satu arsip .zip bertanggal yang dapat disimpan di memori perangkat/laptop atau dibagikan via expo-sharing, serta fitur unduh _backup_ langsung dari server _shared hosting_.

## 7\. Model Data Local-First (SQLite + Drizzle ORM)

### 7.1 Kolom Standar Sinkronisasi (Wajib di Semua Tabel)

Agar sistem dapat beroperasi _full offline_ di perangkat masing-masing dan melakukan rekonsiliasi ke server _shared hosting_ tanpa bentrok ID, seluruh tabel operasional **wajib menggunakan UUID sebagai Primary Key** dan menyertakan 7 kolom standar berikut:

| Nama Kolom     | Tipe Data (SQLite) | Deskripsi & Aturan                                                                                                                                                      |
| -------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id             | TEXT PRIMARY KEY   | **UUID v4** yang di-generate secara lokal di perangkat (expo-crypto / crypto.randomUUID()) saat baris dibuat.                                                           |
| ---            | ---                | ---                                                                                                                                                                     |
| created_at     | TEXT NOT NULL      | Timestamp pembuatan baris dalam format **ISO-8601 UTC** (YYYY-MM-DDTHH:mm:ss.sssZ).                                                                                     |
| ---            | ---                | ---                                                                                                                                                                     |
| updated_at     | TEXT NOT NULL      | Timestamp perubahan terakhir dalam format **ISO-8601 UTC**. Menjadi acuan utama saat rekonsiliasi konflik (_Last-Write-Wins_).                                          |
| ---            | ---                | ---                                                                                                                                                                     |
| deleted_at     | TEXT NULL          | Timestamp _Soft Delete_ (ISO-8601 UTC). Bernilai NULL jika data aktif; berisi timestamp jika data dihapus (_kecuali tabel surat_keluar yang tidak boleh dihapus_).      |
| ---            | ---                | ---                                                                                                                                                                     |
| sync_status    | TEXT NOT NULL      | Status sinkronisasi di perangkat lokal: 'synced' (sudah sama dengan server), 'pending_push' (baru dibuat/diubah/dihapus di lokal dan belum di-upload), atau 'conflict'. |
| ---            | ---                | ---                                                                                                                                                                     |
| last_synced_at | TEXT NULL          | Timestamp ISO-8601 UTC terakhir kali baris ini berhasil disinkronkan dengan server.                                                                                     |
| ---            | ---                | ---                                                                                                                                                                     |
| version        | INTEGER DEFAULT 1  | Nomor versi baris data (bertambah +1 setiap kali terjadi perubahan).                                                                                                    |
| ---            | ---                | ---                                                                                                                                                                     |

### 7.2 Skema Lengkap 19 Tabel Database

_(Keterangan: Seluruh tabel nomor 1 s.d. 18 di bawah ini memiliki 7 kolom standar sinkronisasi pada Bagian 7.1)._

- **(E)**: Dienkripsi menggunakan AES-256-GCM dengan APP_KEY sebelum disimpan.
- **(BI)**: _Blind Index_ berisi hash HMAC-SHA256 dari nilai asli menggunakan APP_KEY untuk pencarian eksak dan validasi unik.

1. **users**:
   - name (TEXT), email (TEXT UNIQUE), password_hash (TEXT), role ('super_admin' / 'staf_tu' / 'guru'), pegawai_id (TEXT NULLABLE UNIQUE, FK ke pegawai.id).
2. **tahun_ajaran** _(Mendukung 2 Semester)_:
   - nama (TEXT, mis. '2026/2027'), semester (INTEGER: 1 atau 2), nama_semester (TEXT: 'Ganjil' atau 'Genap'), tanggal_mulai (TEXT), tanggal_selesai (TEXT), is_active (INTEGER BOOLEAN: 0 atau 1).
   - _Constraint_: UNIQUE (nama, semester).
3. **mata_pelajaran** _(Master Mata Pelajaran)_:
   - kode_mapel (TEXT UNIQUE, mis. 'MTK', 'FIQ', 'BING'), nama_mapel (TEXT), kelompok (TEXT: 'PAI' / 'Umum' / 'Mulok'), is_active (INTEGER BOOLEAN: 0 atau 1).
4. **pegawai**:
   - jenis ('guru' / 'tendik'), status_kepegawaian ('PNS' / 'PPPK' / 'GTY' / 'GTT' / 'Honorer'), status_aktif ('aktif' / 'nonaktif' / 'pensiun'), nama_lengkap, jenis_kelamin ('L' / 'P'), tempat_lahir, tanggal_lahir, foto_local_path, foto_remote_url, nik (E), nik_hash (BI, UNIQUE, NULLABLE), nuptk, pegid, npk, nrg, nip (NULLABLE & UNIQUE), no_hp, email, alamat_jalan, rt, rw, desa, kecamatan, kabupaten, provinsi, kode_pos, jabatan, tugas_tambahan, tmt, sk_pengangkatan_nomor, sk_pengangkatan_tanggal, sk_pengangkatan_local_path, sk_pengangkatan_remote_url, npwp (E, NULLABLE), nama_bank, no_rekening (E, NULLABLE), atas_nama_rekening.
5. **guru_mapel** _(Daftar Mapel yang Diampu Guru)_:
   - pegawai_id (TEXT, FK ke pegawai.id, CASCADE), mata_pelajaran_id (TEXT, FK ke mata_pelajaran.id, RESTRICT).
   - _Constraint_: UNIQUE (pegawai_id, mata_pelajaran_id).
6. **riwayat_pendidikan**:
   - pegawai_id (TEXT, FK ke pegawai.id, CASCADE), jenjang, institusi, jurusan, tahun_lulus.
7. **kelas**:
   - tahun_ajaran_id (TEXT, FK ke tahun_ajaran.id, RESTRICT), nama (TEXT, mis. '7A', '7B'), tingkat (INTEGER: 7 / 8 / 9), wali_kelas_id (TEXT NULLABLE, FK ke pegawai.id, SET NULL).
   - _Constraint_: UNIQUE (tahun_ajaran_id, nama).
8. **pengampu_kelas** _(Penugasan Guru Mengajar Mapel di Kelas Spesifik)_:
   - kelas_id (TEXT, FK ke kelas.id, CASCADE), pegawai_id (TEXT, FK ke pegawai.id, CASCADE), mata_pelajaran_id (TEXT, FK ke mata_pelajaran.id, RESTRICT).
   - _Constraint_: UNIQUE (kelas_id, pegawai_id, mata_pelajaran_id).
   - _Aturan Relasi_: Kombinasi (pegawai_id, mata_pelajaran_id) wajib ada di tabel guru_mapel. Memungkinkan seorang guru mengajar di kelas 7A tetapi tidak mengajar di 7B.
9. **siswa**:
   - nis (TEXT UNIQUE, NULLABLE), nisn (TEXT UNIQUE, NULLABLE), nism (TEXT UNIQUE, NULLABLE), nama_lengkap, jenis_kelamin ('L' / 'P'), tempat_lahir, tanggal_lahir, agama, anak_ke, jumlah_saudara, no_hp, email, nik (E, NULLABLE), nik_hash (BI, UNIQUE, NULLABLE), no_kk (E, NULLABLE), alamat_jalan, rt, rw, desa, kecamatan, kabupaten, provinsi, kode_pos, tinggal_bersama, asal_sekolah, npsn_sekolah_asal (NULLABLE), tahun_masuk, foto_local_path, foto_remote_url, status ('aktif' / 'lulus' / 'pindah' / 'keluar'), tahun_lulus (NULLABLE), tanggal_keluar (NULLABLE), catatan_mutasi (TEXT, NULLABLE).
10. **wali_siswa**:
    - siswa_id (TEXT, FK ke siswa.id, CASCADE), hubungan ('ayah' / 'ibu' / 'wali'), keterangan_hubungan, nama_lengkap, status ('hidup' / 'cerai' / 'meninggal'), nik (E, NULLABLE), nik_hash (BI, INDEX, NULLABLE), tempat_lahir, tanggal_lahir, pendidikan_terakhir, pekerjaan, alamat (kosong berarti sama dengan alamat siswa), no_hp, penghasilan, kartu_bantuan.
    - _Constraint_: UNIQUE (siswa_id, hubungan).
11. **anggota_kelas**:
    - siswa_id (TEXT, FK ke siswa.id, RESTRICT), kelas_id (TEXT, FK ke kelas.id, RESTRICT), tahun_ajaran_id (TEXT, FK ke tahun_ajaran.id, RESTRICT; wajib konsisten dengan kelas.tahun_ajaran_id).
    - _Constraint_: UNIQUE (siswa_id, tahun_ajaran_id).
12. **dokumen_pendukung**:
    - documentable_type ('siswa' atau 'pegawai'), documentable_id (TEXT), jenis_dokumen ('KK', 'Akta Kelahiran', 'Ijazah', 'KIP', 'SK', 'Sertifikat', 'KTP', 'Lainnya'), nama_dokumen, local_file_path (NULLABLE), remote_file_url (NULLABLE), ukuran_file, uploaded_by (TEXT, FK ke users.id).
13. **surat_masuk** _(Eksklusif Admin & TU)_:
    - tahun_ajaran_id (TEXT, FK, RESTRICT), nomor_surat, tanggal_surat, tanggal_diterima, pengirim, perihal, kategori, sifat ('biasa' / 'penting' / 'rahasia', default 'biasa'), lampiran_local_path (NULLABLE), lampiran_remote_url (NULLABLE), keterangan (NULLABLE), created_by (TEXT, FK ke users.id).
14. **surat_keluar** _(Eksklusif Admin & TU — Tanpa Soft Delete / Metode 1)_:
    - tahun_ajaran_id (TEXT, FK, RESTRICT), tahun (INTEGER), nomor_urut (INTEGER), nomor_surat (TEXT), tanggal_surat, tujuan, perihal, kategori, sifat ('biasa' / 'penting' / 'rahasia', default 'biasa'), status ('aktif' / 'dibatalkan', default 'aktif'), alasan_batal (TEXT, NULLABLE), lampiran_local_path (NULLABLE), lampiran_remote_url (NULLABLE), keterangan (NULLABLE), created_by (TEXT, FK ke users.id).
    - _Constraint_: UNIQUE (tahun, nomor_urut). Kolom deleted_at selalu NULL.
15. **berita**:
    - user_id (TEXT, FK), judul, slug (UNIQUE), ringkasan, isi, thumbnail_local_path, thumbnail_remote_url, status ('draft' / 'terbit'), published_at.
16. **pengumuman**:
    - user_id (TEXT, FK), judul, isi, tanggal_mulai, tanggal_selesai, status ('aktif' / 'nonaktif').
17. **log_eksport**:
    - user_id (TEXT, FK), jenis_data ('siswa' / 'pegawai' / 'surat_masuk' / 'surat_keluar'), filter (JSON), jumlah_baris, nama_file, ip_address (NULLABLE).
18. **pengaturan**:
    - key (TEXT UNIQUE), value (TEXT: nama_sekolah, nsm, npsn, akreditasi, nama_kepala_madrasah, nip_kepala_madrasah, logo, kop_surat, alamat, telepon, email, visi, misi).
19. **sync_metadata** _(Tabel Khusus Lokal di Perangkat Client)_:
    - key (TEXT PRIMARY KEY: 'last_pull_timestamp', 'last_push_timestamp', 'device_id'), value (TEXT).

_Catatan Database_: Relasi penting memakai ON DELETE RESTRICT, dan koneksi SQLite wajib mengeksekusi PRAGMA foreign_keys = ON; setiap kali inisialisasi.

## 8\. Alur Rekonsiliasi & Sinkronisasi Data (Local-First ke Shared Hosting)

```
[Perangkat ADMIN / TU] <=== (1) Push & Pull Seluruh 18 Tabel Operasional ===> [SERVER SHARED HOSTING]
                                                                                     ^         |
[Perangkat GURU]       --- (2) Push HANYA Data Diri ("Profil Saya") -----------------+         |
[Perangkat GURU]       <-- (3) Pull Data Kelasnya, Berita, Pengumuman & Profil ----------------+
                                                                                               |
[Perangkat PUBLIK]     <-- (4) Pull HANYA Berita, Pengumuman & Pengaturan Madrasah ------------+
```

### 8.1 Pencatatan Mutasi Data di Lokal (Saat Offline)

1. **Saat Tambah Data (INSERT)**:
   - Generate id menggunakan UUID v4 secara lokal (expo-crypto).
   - Isi created_at dan updated_at dengan waktu UTC sekarang, deleted_at = NULL, version = 1, dan sync_status = 'pending_push'.
2. **Saat Ubah Data (UPDATE)**:
   - Perbarui kolom yang diubah, perbarui updated_at ke waktu UTC sekarang, tambah version = version + 1, dan atur sync_status = 'pending_push'.
3. **Saat Hapus Data (SOFT DELETE)**:
   - Dilarang menjalankan perintah DELETE FROM secara langsung untuk data operasional (kecuali _Force Delete_ oleh Super Admin).
   - Isi deleted_at dan updated_at dengan waktu UTC sekarang, tambah version = version + 1, dan atur sync_status = 'pending_push'.
   - Seluruh query pembacaan data di layar aplikasi lokal wajib memfilter WHERE deleted_at IS NULL.

### 8.2 Alur Tombol "Upload Data" (POST /api/sync/push — Client \\to Server)

1. **Pengecekan Hak Akses di Server**:
   - **Publik (Tanpa Login)**: Ditolak sepenuhnya (401 Unauthorized).
   - **Guru (role == 'guru')**:
     - Server **hanya mengizinkan** payload perubahan untuk 3 tabel milik guru itu sendiri:
       1. pegawai (wajib id === req.user.pegawai_id).
       2. riwayat_pendidikan (wajib pegawai_id === req.user.pegawai_id).
       3. dokumen_pendukung (wajib documentable_type === 'pegawai' dan documentable_id === req.user.pegawai_id).
     - Jika payload dari akun Guru menyertakan tabel lain (misalnya siswa, kelas, berita, atau surat_\*) atau pegawai_id milik orang lain, server langsung menolak transaksi dengan status 403 Forbidden.
     - Saat meng-update baris pegawai milik Guru, server mengabaikan kolom struktural (jenis, status_aktif, jabatan, tugas_tambahan) agar tidak bisa dimanipulasi dari klien.
   - **Admin (super_admin & staf_tu)**:
     - Diizinkan mengunggah perubahan pada seluruh tabel operasional sesuai matriks aksesnya.
2. **Pengiriman Berurutan Sesuai Hierarki Foreign Key**:
   - Aplikasi mengambil seluruh baris lokal dengan sync_status = 'pending_push' dan mengirimkannya dalam urutan induk ke anak: pengaturan \\to tahun_ajaran \\to mata_pelajaran \\to pegawai \\to users \\to guru_mapel \\to riwayat_pendidikan \\to siswa \\to wali_siswa \\to kelas \\to pengampu_kelas \\to anggota_kelas \\to dokumen_pendukung \\to surat_masuk \\to surat_keluar \\to berita \\to pengumuman \\to log_eksport.
3. **Unggah Berkas Fisik Terkait**:
   - Jika ada baris yang memiliki file lokal baru (local_file_path terisi namun remote_file_url masih kosong), aplikasi mengunggah file tersebut ke /api/sync/upload-file terlebih dahulu untuk mendapatkan remote_file_url.
4. **Resolusi Konflik di Server (_Upsert + Last-Write-Wins_)**:
   - Untuk setiap baris data yang masuk ke server:
     - **Jika id (UUID) belum ada di Server**: Lakukan INSERT.
     - **Jika id (UUID) sudah ada di Server**: Bandingkan incoming.updated_at dengan server.updated_at.
       - Jika incoming.updated_at >= server.updated_at, server melakukan UPDATE (termasuk menyalin nilai deleted_at jika baris tersebut di-_soft-delete_ di lokal).
       - Jika incoming.updated_at < server.updated_at (data di server lebih baru), server mempertahankan data server dan memasukkan baris server tersebut ke dalam respons server_overrides agar perangkat pengirim ikut diperbarui.
   - **Penanganan Khusus Nomor Urut surat_keluar**: Jika dua staf TU membuat surat keluar secara _offline_ di waktu berdekatan dan terjadi bentrok (tahun, nomor_urut) saat di-upload, server otomatis memberikan nomor_urut tertinggi berikutnya (MAX(nomor_urut) + 1) dan mengembalikan nomor baru tersebut ke perangkat pengirim.
5. **Penyelesaian di Lokal**:
   - Setelah server mengembalikan respons 200 OK, aplikasi mengubah seluruh baris yang berhasil diunggah menjadi sync_status = 'synced' dan mengisi last_synced_at dengan waktu server.

### 8.3 Alur Tombol "Tarik Data" (GET /api/sync/pull?since=... — Server \\to Client)

1. **Pengiriman Pointer Waktu (since)**:
   - Aplikasi membaca last_pull_timestamp dari tabel lokal sync_metadata (default 1970-01-01T00:00:00.000Z jika belum pernah sinkron) dan memanggil GET /api/sync/pull?since=&lt;last_pull_timestamp&gt;.
2. **Pemfilteran Data Delta di Server (updated_at > since) Berdasarkan Peran**:
   - **Untuk Pengunjung Publik (Tanpa Token)**:
     - Server hanya mengirimkan baris yang berubah (updated_at > since, termasuk baris yang baru di-_soft-delete_) dari 3 tabel:
       1. pengaturan (identitas madrasah, logo, visi-misi, kontak).
       2. berita (berita berstatus terbit atau yang baru dihapus/di-draft).
       3. pengumuman (pengumuman berstatus aktif atau yang baru dinonaktifkan/dihapus).
   - **Untuk Guru (role == 'guru')**:
     - Server mengirimkan 3 tabel publik di atas, ditambah:
       - tahun_ajaran, mata_pelajaran, guru_mapel, kelas, pengampu_kelas.
       - pegawai: seluruh rekan kerja (hanya kolom ringkas) dan data diri guru itu sendiri (id == req.user.pegawai_id, seluruh kolom lengkap) beserta riwayat_pendidikan dan dokumen_pendukung miliknya.
       - siswa, wali_siswa, anggota_kelas: **hanya siswa yang berada di kelas yang diampu/diwalikan oleh guru tersebut** pada tahun ajaran/semester aktif, dengan kolom sensitif (nik, no_kk, penghasilan, kartu_bantuan) dikosongkan/dihilangkan oleh DTO Serializer.
       - **Tidak pernah mengirimkan** tabel surat_masuk, surat_keluar, dokumen_pendukung siswa, maupun log_eksport.
   - **Untuk Super Admin & Staf TU**:
     - Server mengirimkan seluruh baris yang berubah (updated_at > since) dari ke-18 tabel operasional secara utuh.
3. **Penerapan Data di SQLite Lokal (Rekonsiliasi di Perangkat)**:
   - Di dalam satu transaksi database db.withTransactionAsync(...):
     - Untuk setiap baris yang diterima dari server:
       - **Jika id belum ada di SQLite lokal**: Lakukan INSERT dengan sync_status = 'synced'.
       - **Jika id sudah ada dan local.sync_status === 'synced'**: Lakukan UPDATE menimpa data lokal dengan data server (termasuk menyalin deleted_at agar data yang dihapus di server otomatis hilang dari tampilan lokal).
       - **Jika id sudah ada tetapi local.sync_status === 'pending_push'** (misal Guru sedang mengedit "Profil Saya" namun belum menekan tombol Upload):
         - Bandingkan server.updated_at vs local.updated_at. Jika local.updated_at > server.updated_at, pertahankan versi lokal (pending_push) agar perubahan lokal tidak hilang.
   - Setelah seluruh tabel selesai diperbarui, simpan server_timestamp terbaru ke dalam sync_metadata.last_pull_timestamp.

## 9\. Keamanan & Privasi (Arsitektur Local-First + Sync API)

- **Password & Autentikasi**: Password di-_hash_ menggunakan bcryptjs / Argon2; registrasi publik dimatikan; endpoint sinkronisasi internal wajib memvalidasi Bearer JWT.
- **Enkripsi & Blind Indexing**:
  - Kolom nik, no_kk, npwp, dan no_rekening dienkripsi dengan AES-256-GCM sebelum disimpan ke database.
  - Setiap perubahan pada nik otomatis menghitung nik_hash dengan HMAC-SHA256 menggunakan APP_KEY untuk penegakan constraint unik dan pencarian cepat tanpa membuka enkripsi.
- **Keamanan Berkas (Private Storage & Streaming)**:
  - Unggahan divalidasi berdasarkan MIME type dan ukuran: foto/gambar maksimal 2 MB (jpg, jpeg, png, webp), dokumen PDF maksimal 5 MB.
  - Lampiran surat, file SK, dan dokumen pendukung disimpan di folder storage/private di server dan hanya bisa diunduh melalui endpoint GET /api/files/:id yang memverifikasi token dan _Policy_ pengguna (misal: Guru hanya bisa mengunduh dokumen miliknya sendiri; surat hanya bisa diunduh oleh Admin/TU).
- **Filter Ketat DTO pada Endpoint Sync**:
  - Endpoint GET /api/sync/pull yang dipanggil oleh akun Guru wajib menggunakan fungsi _DTO Mapper_ yang membuang seluruh kolom sensitif siswa/rekan kerja dan tidak pernah menyertakan tabel surat_masuk serta surat_keluar.
  - Endpoint POST /api/sync/push memvalidasi kepemilikan baris (req.user.pegawai_id) secara mutlak di server dan tidak pernah mempercayai role atau ID yang dikirim mentah dari _body_ klien.

## 10\. Teknologi & Arsitektur (Optimasi Laptop Ringan, Expo Go Wi-Fi & GitHub Actions)

Karena pengembangan dilakukan pada **Laptop dengan RAM kecil**, arsitektur sengaja menghindari instalasi **Android Studio**, **Android Emulator (AVD)**, maupun kompilasi **Gradle lokal** yang sangat membebani RAM. Seluruh pengembangan fokus pada _JavaScript/TypeScript bundling_ yang ringan:

| Komponen                        | Teknologi yang Digunakan                                                 | Alasan Pemilihan untuk Laptop RAM Kecil & Shared Hosting                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workspace & Package Manager** | **Monorepo (pnpm workspaces / Bun)**                                     | Hemat ruang disk dan sangat ringan di RAM laptop; mendukung _shared types/schemas_ antara /mobile dan /backend.                                                                                                                         |
| ---                             | ---                                                                      | ---                                                                                                                                                                                                                                     |
| **Frontend & Pengujian Harian** | **React Native (Expo SDK 52+) + Expo Go (via Wi-Fi LAN)**                | **100% kompatibel dengan Expo Go** tanpa perlu _prebuild_ lokal. Pengujian langsung di HP fisik lewat jaringan Wi-Fi yang sama (npx expo start --lan) sehingga membebaskan RAM laptop dari beban Android Emulator.                      |
| ---                             | ---                                                                      | ---                                                                                                                                                                                                                                     |
| **Database Lokal (Offline)**    | **expo-sqlite + Drizzle ORM (drizzle-orm/expo-sqlite)**                  | Termasuk dalam paket standar Expo Go (tidak butuh _custom dev client_), berjalan 100% _offline_ di Android & Web, serta mendukung transaksi SQL penuh.                                                                                  |
| ---                             | ---                                                                      | ---                                                                                                                                                                                                                                     |
| **UUID & Kriptografi**          | **expo-crypto + crypto-js / Web Crypto (Client) & node:crypto (Server)** | Berjalan murni di dalam Expo Go dan Node.js untuk menghasilkan UUID v4, enkripsi AES, dan hash HMAC-SHA256 secara _offline_.                                                                                                            |
| ---                             | ---                                                                      | ---                                                                                                                                                                                                                                     |
| **Styling UI**                  | **NativeWind v4 (Tailwind CSS untuk React Native)**                      | Ringan, memudahkan pembuatan tata letak responsif (_Sidebar_ untuk layar laptop/web dan _Bottom Tab/Drawer_ untuk layar HP).                                                                                                            |
| ---                             | ---                                                                      | ---                                                                                                                                                                                                                                     |
| **Backend Sync Server**         | **Node.js (LTS) + Hono / Express.js + TypeScript**                       | Sangat hemat memori saat dijalankan di laptop (tsx watch), di-bind ke 0.0.0.0 agar bisa diakses oleh HP di Wi-Fi yang sama, serta kompatibel dengan cPanel Shared Hosting.                                                              |
| ---                             | ---                                                                      | ---                                                                                                                                                                                                                                     |
| **Database Server**             | **SQLite (better-sqlite3 / @libsql/client) atau MySQL + Drizzle ORM**    | Sangat ringan di laptop (tidak perlu menjalankan _service_ database berat jika memakai SQLite lokal), dan kompatibel dengan MySQL/SQLite di _shared hosting_.                                                                           |
| ---                             | ---                                                                      | ---                                                                                                                                                                                                                                     |
| **Generator PDF & Excel**       | **expo-print (PDF) & exceljs / xlsx (Excel)**                            | Berjalan langsung di dalam Expo Go dan Web tanpa library native tambahan.                                                                                                                                                               |
| ---                             | ---                                                                      | ---                                                                                                                                                                                                                                     |
| **Compiler APK Produksi**       | **GitHub Actions CI/CD (Cloud Runner Ubuntu)**                           | **Nol beban RAM di laptop**. Saat aplikasi sudah beres, kompilasi Gradle .apk / .aab dijalankan sepenuhnya oleh server GitHub Actions (7 GB RAM gratis) dan hasilnya tinggal diunduh dari menu _Actions Artifacts_ / _GitHub Releases_. |
| ---                             | ---                                                                      | ---                                                                                                                                                                                                                                     |

## 11\. Tahapan Pengerjaan (Roadmap Vibe Coding di Laptop Ringan)

| Tahap | Cakupan Pengerjaan                                                                                                                                                                                                                                                                                                                                                                                           | Hasil yang Dapat Diuji di HP (Expo Go Wi-Fi) & Web                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Fondasi Monorepo, Local-First (expo-sqlite), Skema 19 Tabel & Auth Lokal**: Setup monorepo /mobile (Expo Router + NativeWind + expo-sqlite + Drizzle ORM) dan /backend (Hono/Express + Drizzle). Buat migrasi 19 tabel (lengkap dengan UUID, timestamp, deleted_at, sync_status), _seeder_ data _dummy_ lokal, login 3 role (super_admin, staf_tu, guru), pengaturan madrasah, dan fitur Backup ZIP lokal. | Aplikasi berjalan _full offline_ di **HP via Expo Go (Wi-Fi)** dan **Web Browser** tanpa lag di laptop; ketiga peran dapat login sesuai hak akses; seluruh tabel menggunakan UUID dan memiliki kolom sync_status.                 |
| ---   | ---                                                                                                                                                                                                                                                                                                                                                                                                          | ---                                                                                                                                                                                                                               |
| **2** | **Tahun Ajaran (2 Semester), Master Mapel & Kelas**: Layar CRUD Tahun Ajaran dengan 2 semester (1 = Ganjil, 2 = Genap), transaksi tunggal untuk periode aktif, fitur salin rombel antar semester, CRUD Master Mata Pelajaran (mata_pelajaran), dan CRUD Kelas per periode.                                                                                                                                   | Hanya satu kombinasi Tahun Ajaran + Semester yang aktif dalam satu waktu; Master Mapel dapat ditambah secara dinamis; kelas berhasil terikat ke tahun ajaran & semester.                                                          |
| ---   | ---                                                                                                                                                                                                                                                                                                                                                                                                          | ---                                                                                                                                                                                                                               |
| **3** | **Pegawai, Mapel Guru, Pengampu Kelas & Edit Mandiri "Profil Saya"**: CRUD guru/tendik (atribut EMIS + nik_hash), pemetaan mapel keahlian guru (guru_mapel), riwayat pendidikan, dokumen pendukung, pengaturan guru pengampu per kelas (pengampu_kelas), layar **Profil Saya** (bisa diedit langsung oleh Guru), dan cetak biodata pegawai PDF.                                                              | Saat mengatur pengampu di kelas 7A, pilihan mapel yang muncul hanya mapel milik guru yang dipilih; guru bisa mengajar di 7A tanpa harus mengajar di 7B; Guru dapat mengedit data profil pribadinya sendiri di menu "Profil Saya". |
| ---   | ---                                                                                                                                                                                                                                                                                                                                                                                                          | ---                                                                                                                                                                                                                               |
| **4** | **Siswa, Alumni/Mutasi & Kenaikan Kelas (Edit Khusus Admin & TU)**: CRUD siswa (nik_hash, atribut NISM) yang dikunci hanya untuk Admin & TU, wali siswa, dokumen pendukung siswa, anggota kelas, fitur Pindah Kelas, fitur Naik Kelas/Kelulusan, direktori Alumni & Mutasi, cetak Buku Induk & Form Absensi Kosong secara _offline_.                                                                         | Riwayat kelas tersimpan utuh per semester; siswa hanya bisa diedit oleh Admin/TU; Guru hanya melihat (_read-only_) siswa di kelasnya dan mencetak form absensi kosong.                                                            |
| ---   | ---                                                                                                                                                                                                                                                                                                                                                                                                          | ---                                                                                                                                                                                                                               |
| **5** | **Surat Menyurat & Cetak Surat Keterangan (Eksklusif Admin & TU)**: CRUD surat masuk (_soft delete_), surat keluar (Metode 1: penomoran otomatis per tahun + status aktif/dibatalkan tanpa fitur hapus), generator cetak PDF Surat Keterangan Siswa Aktif secara _offline_.                                                                                                                                  | Menu dan fitur surat hanya tampil dan hanya bisa diakses oleh Super Admin & Staf TU; Guru dan Publik tidak memiliki akses ke fitur surat; nomor urut surat keluar utuh dan bebas konflik.                                         |
| ---   | ---                                                                                                                                                                                                                                                                                                                                                                                                          | ---                                                                                                                                                                                                                               |
| **6** | **Layar Publik Offline-First (CMS) & Import/Eksport Excel**: Modul Berita (sanitasi XSS), Pengumuman (sesuai jadwal tayang), Landing Page dinamis dari SQLite lokal, serta fitur Import & Eksport Excel beserta pencatatan otomatis ke log_eksport.                                                                                                                                                          | Berita dan pengumuman dapat dibaca secara _offline_; eksport dan import Excel berjalan langsung di HP (Expo Go) dan laptop; setiap eksport tercatat di Log Eksport.                                                               |
| ---   | ---                                                                                                                                                                                                                                                                                                                                                                                                          | ---                                                                                                                                                                                                                               |
| **7** | **Mesin Sinkronisasi Manual (Wi-Fi LAN & Server) + Workflow GitHub Actions APK**: Pembuatan endpoint POST /api/sync/push, GET /api/sync/pull, dan /api/sync/upload-file di /backend, pengujian sinkronisasi dari HP ke IP LAN Laptop (\[<http://192.168.\>](<http://192.168.)x.x:3000>), serta pembuatan file .github/workflows/build-apk.yml untuk _compile_ APK otomatis di GitHub Actions.                | Sinkronisasi **Upload Data** & **Tarik Data** berhasil diuji lewat Wi-Fi lokal antara HP dan Laptop; ketika kode di-_push_ ke GitHub, **GitHub Actions** otomatis meng-compile file .apk siap pakai tanpa membebani laptop.       |
| ---   | ---                                                                                                                                                                                                                                                                                                                                                                                                          | ---                                                                                                                                                                                                                               |

## 12\. Panduan Setup Laptop Ringan, Test Expo Go via Wi-Fi & GitHub Actions

### A. Persiapan Lingkungan Hemat RAM di Laptop

1. **Jangan menginstal Android Studio / SDK lokal** agar RAM dan penyimpanan laptop tetap lega. Cukup pasang:
   - **Node.js LTS (v20 / v22+)** dan **pnpm** (npm install -g pnpm).
   - **Git** dan code editor (**VS Code** / **Cursor** / **Windsurf**).
   - Aplikasi **Expo Go** di HP Android Anda (unduh dari Play Store).
2. **Konfigurasi Jaringan Wi-Fi (Agar HP Bisa Mengakses Backend di Laptop)**:
   - Pastikan **Laptop dan HP terhubung ke jaringan Wi-Fi / Hotspot yang sama**.
   - Cek alamat IP lokal (LAN) laptop Anda (buka terminal, ketik ipconfig di Windows atau ip a / ifconfig di Linux/macOS, contoh: 192.168.1.10).
   - Pastikan server /backend di-bind ke 0.0.0.0 (bukan 127.0.0.1), dan atur variabel .env di /mobile:  
     EXPO_PUBLIC_API_URL=<http://192.168.1.10:3000>

3. **Menjalankan Proyek untuk Pengujian Harian**:  
   \# Terminal 1: Jalankan backend sync server (sangat ringan, < 100MB RAM)  
   pnpm --filter backend dev  
   <br/>\# Terminal 2: Jalankan bundler Expo di jaringan Wi-Fi yang sama  
   pnpm --filter mobile start --lan  
   \# Scan QR Code yang muncul di terminal menggunakan aplikasi Expo Go di HP Anda!

### B. Konfigurasi GitHub Actions untuk Compile APK (.github/workflows/build-apk.yml)

Ketika aplikasi sudah selesai dan siap dijadikan file .apk, Anda cukup melakukan git push ke GitHub. Workflow berikut akan menyuruh server GitHub melakukan _prebuild_ dan _compile_ Gradle secara otomatis:

```
name: Build Android APK (Release)

on:
  workflow_dispatch: # Bisa diklik manual kapan saja dari tab Actions di GitHub
  push:
    tags:
      - 'v*' # Atau otomatis berjalan saat membuat tag rilis (misal v1.0.0)

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup pnpm & Node.js
        uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Setup Java JDK 17 (Untuk Gradle)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
          cache: 'gradle'

      - name: Install Dependencies
        run: pnpm install

      - name: Generate Native Android Folder (Expo Prebuild)
        working-directory: ./mobile
        run: npx expo prebuild --platform android --non-interactive

      - name: Compile Release APK dengan Gradle
        working-directory: ./mobile/android
        run: ./gradlew assembleRelease --no-daemon

      - name: Upload Hasil APK ke GitHub Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: mts-roudhotut-thowalib-release-apk
          path: mobile/android/app/build/outputs/apk/release/*.apk
```

### C. Master Prompt untuk AI Vibe Coding (Simpan sebagai CLAUDE.md / .cursorrules)

Salin teks di bawah ini dan simpan sebagai file CLAUDE.md atau .cursorrules di _root_ proyek laptop Anda bersama file PRD ini:

**Instruksi Sistem untuk AI Coding Assistant:** Kamu adalah Senior Full-Stack React Native & Offline-First Architect. Kita sedang membangun aplikasi **Sistem Database & Manajemen Sekolah MTs Roudhotut Thowalib (Versi Local-First)** berdasarkan dokumen PRD terlampir secara bertahap (Tahap 1 sampai Tahap 7).

**Aturan Lingkungan Pengembangan (Laptop RAM Kecil + Expo Go Wi-Fi + GitHub Actions):**

1. **100% Kompatibel dengan Expo Go**: Laptop yang digunakan memiliki RAM terbatas dan **tidak menginstal Android Studio / Emulator**. Selama pengembangan, aplikasi diuji langsung di HP fisik menggunakan **Expo Go** melalui jaringan Wi-Fi yang sama (npx expo start --lan). Oleh karena itu, **DILARANG menggunakan library native pihak ketiga yang mewajibkan custom native code / prebuild lokal** selama pengembangan. Gunakan murni paket resmi yang sudah terbundel di dalam **Expo Go (Expo SDK 52+)**: expo-sqlite, expo-router, expo-file-system, expo-sharing, expo-print, expo-document-picker, expo-image-picker, expo-crypto, dan expo-secure-store.
2. **Konfigurasi Jaringan Wi-Fi LAN**: Server /backend (Node.js + Hono/Express) wajib melakukan _listen_ pada host 0.0.0.0 (misal port 3000) agar dapat diakses oleh HP melalui IP Wi-Fi lokal laptop (EXPO_PUBLIC_API_URL=http://&lt;IP_LAN_LAPTOP&gt;:3000). Sediakan juga fitur di layar Login/Pengaturan aplikasi untuk mengubah URL Server API secara dinamis (disimpan di SQLite/SecureStore) agar saat berpindah Wi-Fi atau beralih ke _shared hosting_ produksi, kita tidak perlu mengubah kode.
3. **Kompilasi APK di GitHub Actions**: Jangan pernah menyuruh pengguna menjalankan npx expo run:android atau ./gradlew di terminal laptop. Sebagai gantinya, pada Tahap 7, buatkan file .github/workflows/build-apk.yml yang menjalankan npx expo prebuild --platform android dan ./gradlew assembleRelease di server GitHub Actions serta mengunggah file .apk sebagai _artifact_.
4. **Standar Skema Tabel Sinkronisasi (19 Tabel)**: Semua tabel operasional wajib menggunakan id bertipe TEXT PRIMARY KEY (UUID v4), created_at, updated_at, deleted_at (format ISO-8601 UTC), sync_status ('synced' | 'pending_push' | 'conflict'), last_synced_at, dan version. Setiap mutasi data lokal (INSERT, UPDATE, dan SOFT-DELETE) wajib mengatur sync_status = 'pending_push' dan memperbarui updated_at.
5. **Kebijakan Sinkronisasi Manual (Upload Data & Tarik Data)**:
   - **Upload Data (POST /api/sync/push)**: Hanya **Admin (super_admin & staf_tu)** yang dapat mengunggah perubahan untuk seluruh tabel operasional. **Guru (guru)** hanya diizinkan melakukan Upload Data untuk memperbarui data pribadinya sendiri ("Profil Saya"), yakni terbatas pada tabel pegawai (id === req.user.pegawai_id), riwayat_pendidikan (pegawai_id === req.user.pegawai_id), dan dokumen_pendukung (documentable_type === 'pegawai' & documentable_id === req.user.pegawai_id). Tolak keras payload tabel lain dari role guru dengan 403 Forbidden. **Publik** sama sekali tidak bisa melakukan Upload Data.
   - **Tarik Data (GET /api/sync/pull?since=...)**: Menggunakan delta sync (updated_at > since) dan rekonsiliasi _Last-Write-Wins_. **Publik** hanya menarik pengaturan, berita (terbit), dan pengumuman (aktif). **Guru** menarik data publik + akademik + data siswa khusus kelas yang diampu/diwalikan pada semester aktif (tanpa kolom sensitif NIK/No KK dan tanpa tabel surat). **Admin/TU** menarik seluruh tabel.
6. **Aturan Bisnis Spesifik**:
   - **Tidak Ada Pengajuan Perbaikan Data**: Guru dapat langsung mengedit data dirinya di menu "Profil Saya" dan menyinkronkannya ke server. Data Siswa hanya dapat ditambah/diedit/dihapus oleh super_admin dan staf_tu (Guru hanya _read-only_ untuk siswa di kelasnya).
   - **Fitur Surat Eksklusif Admin & TU**: Modul Surat Masuk, Surat Keluar (Metode 1: tanpa hapus, pembatalan via status dibatalkan + alasan_batal), dan Cetak Surat Keterangan hanya tersedia untuk super_admin dan staf_tu.
   - **Tahun Ajaran 2 Semester**: Tabel tahun_ajaran memiliki kolom semester (1 = Ganjil, 2 = Genap) dengan UNIQUE(nama, semester) dan hanya satu periode aktif dalam satu waktu (db.transaction).
   - **Master Mapel & Penugasan Guru per Kelas**: Gunakan tabel mata_pelajaran (master mapel dinamis), guru_mapel (daftar mapel keahlian masing-masing guru), dan pengampu_kelas (penugasan guru mengajar mapel tertentu di kelas tertentu, misal mengajar di 7A tapi tidak di 7B). Saat memilih guru di suatu kelas, _dropdown_ mapel hanya boleh menampilkan mapel yang terdaftar pada guru tersebut di guru_mapel.
   - **Berita & Pengumuman**: Dibaca dari SQLite lokal; pengguna menekan tombol **Tarik Data** untuk mendapatkan berita dan pengumuman terbaru dari server.
7. **Gaya Kerja Vibe Coding**: Kerjakan satu tahap per satu waktu sesuai tabel Roadmap di PRD (Tahap 1 s.d. Tahap 7). Setiap selesai satu tahap, berikan perintah terminal ringan untuk mengujinya via **Expo Go di jaringan Wi-Fi yang sama** sebelum lanjut ke tahap berikutnya.