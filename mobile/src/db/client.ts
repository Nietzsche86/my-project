import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "./schema";

export const DATABASE_NAME = "mts_roudhotut_thowalib.db";

export const expoDb = openDatabaseSync(DATABASE_NAME);

// Aktifkan Foreign Key dan WAL Mode
expoDb.execSync("PRAGMA foreign_keys = ON;");
expoDb.execSync("PRAGMA journal_mode = WAL;");

export const db = drizzle(expoDb, { schema });

/**
 * Script DDL Pembuatan 19 Tabel SQLite (Idempotent: CREATE TABLE IF NOT EXISTS)
 * Memastikan tabel terbuat otomatis di HP via Expo Go tanpa perlu menjalankan build native
 */
export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  pegawai_id TEXT
);

CREATE TABLE IF NOT EXISTS tahun_ajaran (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  nama TEXT NOT NULL,
  semester INTEGER NOT NULL,
  nama_semester TEXT NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_selesai TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  UNIQUE (nama, semester)
);

CREATE TABLE IF NOT EXISTS mata_pelajaran (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  kode_mapel TEXT NOT NULL UNIQUE,
  nama_mapel TEXT NOT NULL,
  kelompok TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pegawai (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  jenis TEXT NOT NULL,
  status_kepegawaian TEXT NOT NULL,
  status_aktif TEXT NOT NULL DEFAULT 'aktif',
  nama_lengkap TEXT NOT NULL,
  jenis_kelamin TEXT NOT NULL,
  tempat_lahir TEXT,
  tanggal_lahir TEXT,
  foto_local_path TEXT,
  foto_remote_url TEXT,
  nik TEXT,
  nik_hash TEXT UNIQUE,
  nuptk TEXT,
  pegid TEXT,
  npk TEXT,
  nrg TEXT,
  nip TEXT UNIQUE,
  no_hp TEXT,
  email TEXT,
  alamat_jalan TEXT,
  rt TEXT,
  rw TEXT,
  desa TEXT,
  kecamatan TEXT,
  kabupaten TEXT,
  provinsi TEXT,
  kode_pos TEXT,
  jabatan TEXT,
  tugas_tambahan TEXT,
  tmt TEXT,
  sk_pengangkatan_nomor TEXT,
  sk_pengangkatan_tanggal TEXT,
  sk_pengangkatan_local_path TEXT,
  sk_pengangkatan_remote_url TEXT,
  npwp TEXT,
  nama_bank TEXT,
  no_rekening TEXT,
  atas_nama_rekening TEXT
);

CREATE TABLE IF NOT EXISTS guru_mapel (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  pegawai_id TEXT NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  mata_pelajaran_id TEXT NOT NULL REFERENCES mata_pelajaran(id) ON DELETE RESTRICT,
  UNIQUE (pegawai_id, mata_pelajaran_id)
);

CREATE TABLE IF NOT EXISTS riwayat_pendidikan (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  pegawai_id TEXT NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  jenjang TEXT NOT NULL,
  institusi TEXT NOT NULL,
  jurusan TEXT,
  tahun_lulus TEXT
);

CREATE TABLE IF NOT EXISTS kelas (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE RESTRICT,
  nama TEXT NOT NULL,
  tingkat INTEGER NOT NULL,
  wali_kelas_id TEXT REFERENCES pegawai(id) ON DELETE SET NULL,
  UNIQUE (tahun_ajaran_id, nama)
);

CREATE TABLE IF NOT EXISTS pengampu_kelas (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  kelas_id TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  pegawai_id TEXT NOT NULL REFERENCES pegawai(id) ON DELETE CASCADE,
  mata_pelajaran_id TEXT NOT NULL REFERENCES mata_pelajaran(id) ON DELETE RESTRICT,
  UNIQUE (kelas_id, pegawai_id, mata_pelajaran_id)
);

CREATE TABLE IF NOT EXISTS siswa (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  nis TEXT UNIQUE,
  nisn TEXT UNIQUE,
  nama_lengkap TEXT NOT NULL,
  jenis_kelamin TEXT NOT NULL,
  tempat_lahir TEXT,
  tanggal_lahir TEXT,
  agama TEXT DEFAULT 'Islam',
  anak_ke INTEGER,
  jumlah_saudara INTEGER,
  no_hp TEXT,
  email TEXT,
  nik TEXT,
  nik_hash TEXT UNIQUE,
  no_kk TEXT,
  nik_ayah TEXT,
  nik_ibu TEXT,
  alamat_jalan TEXT,
  rt TEXT,
  rw TEXT,
  desa TEXT,
  kecamatan TEXT,
  kabupaten TEXT,
  provinsi TEXT,
  kode_pos TEXT,
  tinggal_bersama TEXT,
  asal_sekolah TEXT,
  npsn_sekolah_asal TEXT,
  tahun_masuk TEXT,
  foto_local_path TEXT,
  foto_remote_url TEXT,
  status TEXT NOT NULL DEFAULT 'aktif',
  tahun_lulus TEXT,
  tanggal_keluar TEXT,
  catatan_mutasi TEXT
);

CREATE TABLE IF NOT EXISTS wali_siswa (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  hubungan TEXT NOT NULL,
  keterangan_hubungan TEXT,
  nama_lengkap TEXT NOT NULL,
  status TEXT DEFAULT 'hidup',
  nik TEXT,
  nik_hash TEXT,
  tempat_lahir TEXT,
  tanggal_lahir TEXT,
  pendidikan_terakhir TEXT,
  pekerjaan TEXT,
  alamat TEXT,
  no_hp TEXT,
  penghasilan TEXT,
  kartu_bantuan TEXT,
  UNIQUE (siswa_id, hubungan)
);

CREATE TABLE IF NOT EXISTS anggota_kelas (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE RESTRICT,
  kelas_id TEXT NOT NULL REFERENCES kelas(id) ON DELETE RESTRICT,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE RESTRICT,
  UNIQUE (siswa_id, tahun_ajaran_id)
);

CREATE TABLE IF NOT EXISTS dokumen_pendukung (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  documentable_type TEXT NOT NULL,
  documentable_id TEXT NOT NULL,
  jenis_dokumen TEXT NOT NULL,
  nama_dokumen TEXT NOT NULL,
  local_file_path TEXT,
  remote_file_url TEXT,
  ukuran_file INTEGER,
  uploaded_by TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS surat_masuk (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE RESTRICT,
  nomor_surat TEXT NOT NULL,
  tanggal_surat TEXT NOT NULL,
  tanggal_diterima TEXT NOT NULL,
  pengirim TEXT NOT NULL,
  perihal TEXT NOT NULL,
  kategori TEXT,
  sifat TEXT NOT NULL DEFAULT 'biasa',
  lampiran_local_path TEXT,
  lampiran_remote_url TEXT,
  keterangan TEXT,
  created_by TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS surat_keluar (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE RESTRICT,
  tahun INTEGER NOT NULL,
  nomor_urut INTEGER NOT NULL,
  nomor_surat TEXT NOT NULL,
  tanggal_surat TEXT NOT NULL,
  tujuan TEXT NOT NULL,
  perihal TEXT NOT NULL,
  kategori TEXT,
  sifat TEXT NOT NULL DEFAULT 'biasa',
  status TEXT NOT NULL DEFAULT 'aktif',
  alasan_batal TEXT,
  lampiran_local_path TEXT,
  lampiran_remote_url TEXT,
  keterangan TEXT,
  created_by TEXT REFERENCES users(id),
  UNIQUE (tahun, nomor_urut)
);

CREATE TABLE IF NOT EXISTS berita (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  user_id TEXT REFERENCES users(id),
  judul TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  ringkasan TEXT,
  isi TEXT NOT NULL,
  thumbnail_local_path TEXT,
  thumbnail_remote_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS pengumuman (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  user_id TEXT REFERENCES users(id),
  judul TEXT NOT NULL,
  isi TEXT NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_selesai TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif'
);

CREATE TABLE IF NOT EXISTS log_eksport (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  user_id TEXT REFERENCES users(id),
  jenis_data TEXT NOT NULL,
  filter TEXT,
  jumlah_baris INTEGER NOT NULL,
  nama_file TEXT NOT NULL,
  ip_address TEXT
);

CREATE TABLE IF NOT EXISTS pengaturan (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_push',
  last_synced_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

/**
 * Inisialisasi struktur database secara aman
 */
export async function initDatabaseAsync(): Promise<void> {
  try {
    expoDb.execSync(CREATE_TABLES_SQL);

    // Migrasi aman untuk kolom tambahan
    try {
      expoDb.execSync("ALTER TABLE siswa ADD COLUMN nik_ayah TEXT;");
    } catch {}
    try {
      expoDb.execSync("ALTER TABLE siswa ADD COLUMN nik_ibu TEXT;");
    } catch {}
    try {
      expoDb.execSync("ALTER TABLE wali_siswa ADD COLUMN tempat_lahir TEXT;");
    } catch {}
    try {
      expoDb.execSync("ALTER TABLE wali_siswa ADD COLUMN tanggal_lahir TEXT;");
    } catch {}
    try {
      expoDb.execSync("ALTER TABLE wali_siswa ADD COLUMN pendidikan_terakhir TEXT;");
    } catch {}
  } catch (error) {
    console.error("Gagal inisialisasi tabel database SQLite:", error);
    throw error;
  }
}
