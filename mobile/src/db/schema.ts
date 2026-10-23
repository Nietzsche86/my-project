import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

/**
 * 7 Kolom Standar Sinkronisasi (Wajib pada seluruh 18 tabel operasional)
 */
export const syncColumns = {
  id: text("id").primaryKey(), // UUID v4
  created_at: text("created_at").notNull(), // ISO-8601 UTC
  updated_at: text("updated_at").notNull(), // ISO-8601 UTC
  deleted_at: text("deleted_at"), // Soft delete ISO-8601 UTC (NULL jika aktif)
  sync_status: text("sync_status").notNull().default("pending_push"), // 'synced' | 'pending_push' | 'conflict'
  last_synced_at: text("last_synced_at"), // ISO-8601 UTC
  version: integer("version").notNull().default(1),
};

// 1. users
export const users = sqliteTable("users", {
  ...syncColumns,
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  role: text("role").notNull(), // 'super_admin' | 'staf_tu' | 'guru'
  pegawai_id: text("pegawai_id"), // FK ke pegawai.id
});

// 2. tahun_ajaran
export const tahunAjaran = sqliteTable(
  "tahun_ajaran",
  {
    ...syncColumns,
    nama: text("nama").notNull(), // mis. '2026/2027'
    semester: integer("semester").notNull(), // 1 = Ganjil, 2 = Genap
    nama_semester: text("nama_semester").notNull(), // 'Ganjil' | 'Genap'
    tanggal_mulai: text("tanggal_mulai").notNull(),
    tanggal_selesai: text("tanggal_selesai").notNull(),
    is_active: integer("is_active").notNull().default(0), // 0 | 1
  },
  (table) => [
    uniqueIndex("tahun_ajaran_nama_semester_idx").on(table.nama, table.semester),
  ]
);

// 3. mata_pelajaran
export const mataPelajaran = sqliteTable("mata_pelajaran", {
  ...syncColumns,
  kode_mapel: text("kode_mapel").notNull().unique(), // mis. 'QH', 'MTK'
  nama_mapel: text("nama_mapel").notNull(),
  kelompok: text("kelompok").notNull(), // 'PAI' | 'Umum' | 'Mulok'
  is_active: integer("is_active").notNull().default(1),
});

// 4. pegawai
export const pegawai = sqliteTable(
  "pegawai",
  {
    ...syncColumns,
    jenis: text("jenis").notNull(), // 'guru' | 'tendik'
    status_kepegawaian: text("status_kepegawaian").notNull(), // 'PNS' | 'PPPK' | 'GTY' | 'GTT' | 'Honorer'
    status_aktif: text("status_aktif").notNull().default("aktif"), // 'aktif' | 'nonaktif' | 'pensiun'
    nama_lengkap: text("nama_lengkap").notNull(),
    jenis_kelamin: text("jenis_kelamin").notNull(), // 'L' | 'P'
    tempat_lahir: text("tempat_lahir"),
    tanggal_lahir: text("tanggal_lahir"),
    foto_local_path: text("foto_local_path"),
    foto_remote_url: text("foto_remote_url"),
    nik: text("nik"), // Encrypted AES-256-GCM
    nik_hash: text("nik_hash").unique(), // Blind Index HMAC-SHA256
    nuptk: text("nuptk"),
    pegid: text("pegid"),
    npk: text("npk"),
    nrg: text("nrg"),
    nip: text("nip").unique(),
    no_hp: text("no_hp"),
    email: text("email"),
    alamat_jalan: text("alamat_jalan"),
    rt: text("rt"),
    rw: text("rw"),
    desa: text("desa"),
    kecamatan: text("kecamatan"),
    kabupaten: text("kabupaten"),
    provinsi: text("provinsi"),
    kode_pos: text("kode_pos"),
    jabatan: text("jabatan"),
    tugas_tambahan: text("tugas_tambahan"),
    tmt: text("tmt"),
    sk_pengangkatan_nomor: text("sk_pengangkatan_nomor"),
    sk_pengangkatan_tanggal: text("sk_pengangkatan_tanggal"),
    sk_pengangkatan_local_path: text("sk_pengangkatan_local_path"),
    sk_pengangkatan_remote_url: text("sk_pengangkatan_remote_url"),
    npwp: text("npwp"), // Encrypted AES-256-GCM
    nama_bank: text("nama_bank"),
    no_rekening: text("no_rekening"), // Encrypted AES-256-GCM
    atas_nama_rekening: text("atas_nama_rekening"),
  },
  (table) => [
    index("pegawai_nik_hash_idx").on(table.nik_hash),
    index("pegawai_nuptk_idx").on(table.nuptk),
    index("pegawai_status_aktif_idx").on(table.status_aktif),
  ]
);

// 5. guru_mapel
export const guruMapel = sqliteTable(
  "guru_mapel",
  {
    ...syncColumns,
    pegawai_id: text("pegawai_id")
      .notNull()
      .references(() => pegawai.id, { onDelete: "cascade" }),
    mata_pelajaran_id: text("mata_pelajaran_id")
      .notNull()
      .references(() => mataPelajaran.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("guru_mapel_pegawai_mapel_idx").on(
      table.pegawai_id,
      table.mata_pelajaran_id
    ),
  ]
);

// 6. riwayat_pendidikan
export const riwayatPendidikan = sqliteTable("riwayat_pendidikan", {
  ...syncColumns,
  pegawai_id: text("pegawai_id")
    .notNull()
    .references(() => pegawai.id, { onDelete: "cascade" }),
  jenjang: text("jenjang").notNull(),
  institusi: text("institusi").notNull(),
  jurusan: text("jurusan"),
  tahun_lulus: text("tahun_lulus"),
});

// 7. kelas
export const kelas = sqliteTable(
  "kelas",
  {
    ...syncColumns,
    tahun_ajaran_id: text("tahun_ajaran_id")
      .notNull()
      .references(() => tahunAjaran.id, { onDelete: "restrict" }),
    nama: text("nama").notNull(), // mis. '7A', '7B'
    tingkat: integer("tingkat").notNull(), // 7 | 8 | 9
    wali_kelas_id: text("wali_kelas_id").references(() => pegawai.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("kelas_tahun_ajaran_nama_idx").on(table.tahun_ajaran_id, table.nama),
  ]
);

// 8. pengampu_kelas
export const pengampuKelas = sqliteTable(
  "pengampu_kelas",
  {
    ...syncColumns,
    kelas_id: text("kelas_id")
      .notNull()
      .references(() => kelas.id, { onDelete: "cascade" }),
    pegawai_id: text("pegawai_id")
      .notNull()
      .references(() => pegawai.id, { onDelete: "cascade" }),
    mata_pelajaran_id: text("mata_pelajaran_id")
      .notNull()
      .references(() => mataPelajaran.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("pengampu_kelas_unique_idx").on(
      table.kelas_id,
      table.pegawai_id,
      table.mata_pelajaran_id
    ),
  ]
);

// 9. siswa
export const siswa = sqliteTable(
  "siswa",
  {
    ...syncColumns,
    nis: text("nis").unique(),
    nisn: text("nisn").unique(),
    nama_lengkap: text("nama_lengkap").notNull(),
    jenis_kelamin: text("jenis_kelamin").notNull(), // 'L' | 'P'
    tempat_lahir: text("tempat_lahir"),
    tanggal_lahir: text("tanggal_lahir"),
    agama: text("agama").default("Islam"),
    anak_ke: integer("anak_ke"),
    jumlah_saudara: integer("jumlah_saudara"),
    no_hp: text("no_hp"),
    email: text("email"),
    nik: text("nik"), // Encrypted AES-256-GCM
    nik_hash: text("nik_hash").unique(), // Blind index HMAC-SHA256
    no_kk: text("no_kk"), // Encrypted AES-256-GCM
    nik_ayah: text("nik_ayah"), // Encrypted AES-256-GCM
    nik_ibu: text("nik_ibu"), // Encrypted AES-256-GCM
    alamat_jalan: text("alamat_jalan"),
    rt: text("rt"),
    rw: text("rw"),
    desa: text("desa"),
    kecamatan: text("kecamatan"),
    kabupaten: text("kabupaten"),
    provinsi: text("provinsi"),
    kode_pos: text("kode_pos"),
    tinggal_bersama: text("tinggal_bersama"),
    asal_sekolah: text("asal_sekolah"),
    npsn_sekolah_asal: text("npsn_sekolah_asal"),
    tahun_masuk: text("tahun_masuk"),
    foto_local_path: text("foto_local_path"),
    foto_remote_url: text("foto_remote_url"),
    status: text("status").notNull().default("aktif"), // 'aktif' | 'lulus' | 'pindah' | 'keluar'
    tahun_lulus: text("tahun_lulus"),
    tanggal_keluar: text("tanggal_keluar"),
    catatan_mutasi: text("catatan_mutasi"),
  },
  (table) => [
    index("siswa_nik_hash_idx").on(table.nik_hash),
    index("siswa_nisn_idx").on(table.nisn),
    index("siswa_status_idx").on(table.status),
  ]
);

// 10. wali_siswa
export const waliSiswa = sqliteTable(
  "wali_siswa",
  {
    ...syncColumns,
    siswa_id: text("siswa_id")
      .notNull()
      .references(() => siswa.id, { onDelete: "cascade" }),
    hubungan: text("hubungan").notNull(), // 'ayah' | 'ibu' | 'wali'
    keterangan_hubungan: text("keterangan_hubungan"),
    nama_lengkap: text("nama_lengkap").notNull(),
    status: text("status").default("hidup"), // 'hidup' | 'cerai' | 'meninggal'
    nik: text("nik"), // Encrypted AES-256-GCM
    nik_hash: text("nik_hash"),
    tempat_lahir: text("tempat_lahir"),
    tanggal_lahir: text("tanggal_lahir"),
    pendidikan_terakhir: text("pendidikan_terakhir"),
    pekerjaan: text("pekerjaan"),
    alamat: text("alamat"),
    no_hp: text("no_hp"),
    penghasilan: text("penghasilan"),
    kartu_bantuan: text("kartu_bantuan"),
  },
  (table) => [
    uniqueIndex("wali_siswa_unique_idx").on(table.siswa_id, table.hubungan),
  ]
);

// 11. anggota_kelas
export const anggotaKelas = sqliteTable(
  "anggota_kelas",
  {
    ...syncColumns,
    siswa_id: text("siswa_id")
      .notNull()
      .references(() => siswa.id, { onDelete: "restrict" }),
    kelas_id: text("kelas_id")
      .notNull()
      .references(() => kelas.id, { onDelete: "restrict" }),
    tahun_ajaran_id: text("tahun_ajaran_id")
      .notNull()
      .references(() => tahunAjaran.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("anggota_kelas_siswa_periode_idx").on(
      table.siswa_id,
      table.tahun_ajaran_id
    ),
  ]
);

// 12. dokumen_pendukung
export const dokumenPendukung = sqliteTable(
  "dokumen_pendukung",
  {
    ...syncColumns,
    documentable_type: text("documentable_type").notNull(), // 'siswa' | 'pegawai'
    documentable_id: text("documentable_id").notNull(),
    jenis_dokumen: text("jenis_dokumen").notNull(), // 'KK' | 'Akta Kelahiran' | 'Ijazah' | 'KIP' | 'SK' | 'Sertifikat' | 'KTP' | 'Lainnya'
    nama_dokumen: text("nama_dokumen").notNull(),
    local_file_path: text("local_file_path"),
    remote_file_url: text("remote_file_url"),
    ukuran_file: integer("ukuran_file"),
    uploaded_by: text("uploaded_by").references(() => users.id),
  },
  (table) => [
    index("dokumen_pendukung_target_idx").on(
      table.documentable_type,
      table.documentable_id
    ),
  ]
);

// 13. surat_masuk
export const suratMasuk = sqliteTable("surat_masuk", {
  ...syncColumns,
  tahun_ajaran_id: text("tahun_ajaran_id")
    .notNull()
    .references(() => tahunAjaran.id, { onDelete: "restrict" }),
  nomor_surat: text("nomor_surat").notNull(),
  tanggal_surat: text("tanggal_surat").notNull(),
  tanggal_diterima: text("tanggal_diterima").notNull(),
  pengirim: text("pengirim").notNull(),
  perihal: text("perihal").notNull(),
  kategori: text("kategori"),
  sifat: text("sifat").notNull().default("biasa"), // 'biasa' | 'penting' | 'rahasia'
  lampiran_local_path: text("lampiran_local_path"),
  lampiran_remote_url: text("lampiran_remote_url"),
  keterangan: text("keterangan"),
  created_by: text("created_by").references(() => users.id),
});

// 14. surat_keluar (Metode 1: Tanpa Hapus / deleted_at selalu NULL)
export const suratKeluar = sqliteTable(
  "surat_keluar",
  {
    ...syncColumns,
    tahun_ajaran_id: text("tahun_ajaran_id")
      .notNull()
      .references(() => tahunAjaran.id, { onDelete: "restrict" }),
    tahun: integer("tahun").notNull(),
    nomor_urut: integer("nomor_urut").notNull(),
    nomor_surat: text("nomor_surat").notNull(),
    tanggal_surat: text("tanggal_surat").notNull(),
    tujuan: text("tujuan").notNull(),
    perihal: text("perihal").notNull(),
    kategori: text("kategori"),
    sifat: text("sifat").notNull().default("biasa"), // 'biasa' | 'penting' | 'rahasia'
    status: text("status").notNull().default("aktif"), // 'aktif' | 'dibatalkan'
    alasan_batal: text("alasan_batal"),
    lampiran_local_path: text("lampiran_local_path"),
    lampiran_remote_url: text("lampiran_remote_url"),
    keterangan: text("keterangan"),
    created_by: text("created_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("surat_keluar_tahun_nomor_idx").on(table.tahun, table.nomor_urut),
  ]
);

// 15. berita
export const berita = sqliteTable("berita", {
  ...syncColumns,
  user_id: text("user_id").references(() => users.id),
  judul: text("judul").notNull(),
  slug: text("slug").notNull().unique(),
  ringkasan: text("ringkasan"),
  isi: text("isi").notNull(),
  thumbnail_local_path: text("thumbnail_local_path"),
  thumbnail_remote_url: text("thumbnail_remote_url"),
  status: text("status").notNull().default("draft"), // 'draft' | 'terbit'
  published_at: text("published_at"),
});

// 16. pengumuman
export const pengumuman = sqliteTable("pengumuman", {
  ...syncColumns,
  user_id: text("user_id").references(() => users.id),
  judul: text("judul").notNull(),
  isi: text("isi").notNull(),
  tanggal_mulai: text("tanggal_mulai").notNull(),
  tanggal_selesai: text("tanggal_selesai").notNull(),
  status: text("status").notNull().default("aktif"), // 'aktif' | 'nonaktif'
});

// 17. log_eksport
export const logEksport = sqliteTable("log_eksport", {
  ...syncColumns,
  user_id: text("user_id").references(() => users.id),
  jenis_data: text("jenis_data").notNull(), // 'siswa' | 'pegawai' | 'surat_masuk' | 'surat_keluar'
  filter: text("filter"), // JSON string
  jumlah_baris: integer("jumlah_baris").notNull(),
  nama_file: text("nama_file").notNull(),
  ip_address: text("ip_address"),
});

// 18. pengaturan
export const pengaturan = sqliteTable("pengaturan", {
  ...syncColumns,
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

// 19. sync_metadata (Khusus lokal di perangkat client, tidak ikut disinkronkan)
export const syncMetadata = sqliteTable("sync_metadata", {
  key: text("key").primaryKey(), // 'last_pull_timestamp' | 'last_push_timestamp' | 'device_id' | 'api_url'
  value: text("value").notNull(),
});

export type User = typeof users.$inferSelect;
export type TahunAjaran = typeof tahunAjaran.$inferSelect;
export type MataPelajaran = typeof mataPelajaran.$inferSelect;
export type Pegawai = typeof pegawai.$inferSelect;
export type GuruMapel = typeof guruMapel.$inferSelect;
export type RiwayatPendidikan = typeof riwayatPendidikan.$inferSelect;
export type Kelas = typeof kelas.$inferSelect;
export type PengampuKelas = typeof pengampuKelas.$inferSelect;
export type Siswa = typeof siswa.$inferSelect;
export type WaliSiswa = typeof waliSiswa.$inferSelect;
export type AnggotaKelas = typeof anggotaKelas.$inferSelect;
export type DokumenPendukung = typeof dokumenPendukung.$inferSelect;
export type SuratMasuk = typeof suratMasuk.$inferSelect;
export type SuratKeluar = typeof suratKeluar.$inferSelect;
export type Berita = typeof berita.$inferSelect;
export type Pengumuman = typeof pengumuman.$inferSelect;
export type LogEksport = typeof logEksport.$inferSelect;
export type Pengaturan = typeof pengaturan.$inferSelect;
export type SyncMetadata = typeof syncMetadata.$inferSelect;
