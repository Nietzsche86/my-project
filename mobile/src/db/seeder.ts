import { db } from "./client";
import {
  users,
  pengaturan,
  tahunAjaran,
  mataPelajaran,
  pegawai,
  guruMapel,
  riwayatPendidikan,
  kelas,
  pengampuKelas,
  siswa,
  waliSiswa,
  anggotaKelas,
  berita,
  pengumuman,
  suratMasuk,
  suratKeluar,
  syncMetadata,
} from "./schema";
import {
  generateUUID,
  getIsoUtcString,
  hashPassword,
  generateNikHash,
  encryptSensitive,
} from "./crypto";
import { eq, or } from "drizzle-orm";

/**
 * Memeriksa apakah database sudah memiliki data awal, dan pastikan seluruh data dasar terisi aman
 */
export async function seedInitialDataAsync(): Promise<void> {
  const now = getIsoUtcString();

  try {
    // 1. Pengaturan Identitas Madrasah
    const settingsData = [
      { key: "nama_madrasah", value: "MTs Roudhotut Thowalib" },
      { key: "nsm", value: "121235170045" },
      { key: "npsn", value: "20582415" },
      { key: "akreditasi", value: "A (Unggul)" },
      { key: "nama_kepala_madrasah", value: "H. Ahmad Fauzi, S.Pd.I., M.Pd." },
      { key: "nip_kepala_madrasah", value: "197805122005011003" },
      { key: "alamat", value: "Jl. Pesantren No. 09, Thowalib, Jawa Timur" },
      { key: "telepon", value: "(0341) 567890" },
      { key: "email", value: "info@mts-rth.sch.id" },
      {
        key: "visi",
        value:
          "Terwujudnya Generasi Qur'ani, Berakhlakul Karimah, Unggul dalam Prestasi, dan Berwawasan Global.",
      },
      {
        key: "misi",
        value:
          "1. Menanamkan aqidah Islam Ahlussunnah wal Jama'ah secara istiqamah.\n2. Melaksanakan pembelajaran berkarakter dan berorientasi teknologi.\n3. Mengembangkan minat, bakat, dan potensi siswa secara komprehensif.",
      },
    ];

    for (const s of settingsData) {
      const exists = await db.select().from(pengaturan).where(eq(pengaturan.key, s.key)).limit(1);
      if (exists.length === 0) {
        await db.insert(pengaturan).values({
          id: generateUUID(),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          key: s.key,
          value: s.value,
        });
      }
    }

    // 2. Tahun Ajaran (2 Semester)
    const existingTa = await db.select().from(tahunAjaran).limit(1);
    const idTaGanjil = "ta-2026-ganjil-seed-id";
    const idTaGenap = "ta-2026-genap-seed-id";

    if (existingTa.length === 0) {
      await db.insert(tahunAjaran).values([
        {
          id: idTaGanjil,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          nama: "2026/2027",
          semester: 1,
          nama_semester: "Ganjil",
          tanggal_mulai: "2026-07-15",
          tanggal_selesai: "2026-12-20",
          is_active: 1, // Periode Aktif
        },
        {
          id: idTaGenap,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          nama: "2026/2027",
          semester: 2,
          nama_semester: "Genap",
          tanggal_mulai: "2027-01-05",
          tanggal_selesai: "2027-06-25",
          is_active: 0,
        },
      ]);
    }

    // 3. Master Mata Pelajaran
    const mapelList = [
      { kode: "QH", nama: "Al-Qur'an Hadis", kelompok: "PAI" },
      { kode: "AA", nama: "Aqidah Akhlak", kelompok: "PAI" },
      { kode: "FIQ", nama: "Fiqih", kelompok: "PAI" },
      { kode: "SKI", nama: "Sejarah Kebudayaan Islam", kelompok: "PAI" },
      { kode: "ARB", nama: "Bahasa Arab", kelompok: "PAI" },
      { kode: "BIN", nama: "Bahasa Indonesia", kelompok: "Umum" },
      { kode: "BIG", nama: "Bahasa Inggris", kelompok: "Umum" },
      { kode: "MTK", nama: "Matematika", kelompok: "Umum" },
      { kode: "IPA", nama: "Ilmu Pengetahuan Alam", kelompok: "Umum" },
      { kode: "IPS", nama: "Ilmu Pengetahuan Sosial", kelompok: "Umum" },
      { kode: "PPKN", nama: "Pendidikan Pancasila", kelompok: "Umum" },
      { kode: "PJK", nama: "Pendidikan Jasmani & Olahraga", kelompok: "Umum" },
      { kode: "ASW", nama: "Aswaja / Ke-NU-an", kelompok: "Mulok" },
      { kode: "BJW", nama: "Bahasa Daerah Jawa", kelompok: "Mulok" },
    ];

    const mapelIdMap: Record<string, string> = {};
    for (const m of mapelList) {
      const existing = await db
        .select()
        .from(mataPelajaran)
        .where(eq(mataPelajaran.kode_mapel, m.kode))
        .limit(1);

      if (existing.length === 0) {
        const mapelId = `mapel-${m.kode.toLowerCase()}-id`;
        mapelIdMap[m.kode] = mapelId;
        await db.insert(mataPelajaran).values({
          id: mapelId,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          kode_mapel: m.kode,
          nama_mapel: m.nama,
          kelompok: m.kelompok,
          is_active: 1,
        });
      } else {
        mapelIdMap[m.kode] = existing[0]!.id;
      }
    }

    // 4. Data Pegawai
    const idPegawaiAdmin = "pegawai-admin-seed-id";
    const idPegawaiTU = "pegawai-tu-seed-id";
    const idPegawaiGuru = "pegawai-guru-seed-id";

    const nikAdmin = "3517091205780001";
    const nikTU = "3517095408920002";
    const nikGuru = "3517092309850003";

    const existingPegawai = await db.select().from(pegawai).limit(1);
    if (existingPegawai.length === 0) {
      await db.insert(pegawai).values([
        {
          id: idPegawaiAdmin,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          jenis: "guru",
          status_kepegawaian: "PNS",
          status_aktif: "aktif",
          nama_lengkap: "H. Ahmad Fauzi, S.Pd.I., M.Pd.",
          jenis_kelamin: "L",
          tempat_lahir: "Jombang",
          tanggal_lahir: "1978-05-12",
          nik: await encryptSensitive(nikAdmin),
          nik_hash: await generateNikHash(nikAdmin),
          nip: "197805122005011003",
          nuptk: "4538756658200022",
          pegid: "2058241501",
          no_hp: "081234567890",
          email: "ahmad.fauzi@mts-rth.sch.id",
          alamat_jalan: "Jl. Pesantren No. 10",
          jabatan: "Kepala Madrasah",
          tugas_tambahan: "Kepala Madrasah",
        },
        {
          id: idPegawaiTU,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          jenis: "tendik",
          status_kepegawaian: "GTY",
          status_aktif: "aktif",
          nama_lengkap: "Siti Nur Aisyah, S.Kom.",
          jenis_kelamin: "P",
          tempat_lahir: "Malang",
          tanggal_lahir: "1992-08-14",
          nik: await encryptSensitive(nikTU),
          nik_hash: await generateNikHash(nikTU),
          nuptk: "7845769670210043",
          pegid: "2058241502",
          no_hp: "081345678901",
          email: "tu@mts-rth.sch.id",
          alamat_jalan: "Jl. Merpati No. 4",
          jabatan: "Kepala Tata Usaha",
        },
        {
          id: idPegawaiGuru,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          jenis: "guru",
          status_kepegawaian: "GTY",
          status_aktif: "aktif",
          nama_lengkap: "Muhammad Ilham, S.Pd.",
          jenis_kelamin: "L",
          tempat_lahir: "Kediri",
          tanggal_lahir: "1985-09-23",
          nik: await encryptSensitive(nikGuru),
          nik_hash: await generateNikHash(nikGuru),
          nuptk: "1234763665200031",
          pegid: "2058241503",
          npk: "987654321098",
          nrg: "123456789",
          no_hp: "081456789012",
          email: "guru@mts-rth.sch.id",
          alamat_jalan: "Jl. Melati Blok C No. 2",
          jabatan: "Guru Mata Pelajaran",
          tugas_tambahan: "Wali Kelas 7A",
        },
      ]);
    }

    // 5. Relasi guru_mapel & riwayat pendidikan
    const existingGuruMapel = await db.select().from(guruMapel).limit(1);
    if (existingGuruMapel.length === 0 && mapelIdMap["MTK"]) {
      await db.insert(guruMapel).values({
        id: generateUUID(),
        created_at: now,
        updated_at: now,
        deleted_at: null,
        sync_status: "synced",
        last_synced_at: now,
        version: 1,
        pegawai_id: idPegawaiGuru,
        mata_pelajaran_id: mapelIdMap["MTK"],
      });
    }

    // 6. Akun Pengguna (3 Role Utama) — WAJIB TERSEEDED
    const defaultAccounts = [
      {
        id: "user-admin-seed-id",
        email: "admin@mts-rth.sch.id",
        password: "admin123",
        role: "super_admin",
        name: "H. Ahmad Fauzi (Super Admin)",
        pegawai_id: idPegawaiAdmin,
      },
      {
        id: "user-tu-seed-id",
        email: "tu@mts-rth.sch.id",
        password: "tu12345",
        role: "staf_tu",
        name: "Siti Nur Aisyah (Staf TU)",
        pegawai_id: idPegawaiTU,
      },
      {
        id: "user-guru-seed-id",
        email: "guru@mts-rth.sch.id",
        password: "guru12345",
        role: "guru",
        name: "Muhammad Ilham (Guru)",
        pegawai_id: idPegawaiGuru,
      },
    ];

    for (const acc of defaultAccounts) {
      // Periksa apakah akun sudah ada (baik dari ID, pegawai_id, atau email)
      // Mencegah penimpaan saat Super Admin telah mengganti email/password
      const uExists = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.id, acc.id),
            eq(users.pegawai_id, acc.pegawai_id),
            eq(users.email, acc.email)
          )
        )
        .limit(1);

      if (uExists.length === 0) {
        const passHash = await hashPassword(acc.password);
        await db.insert(users).values({
          id: acc.id,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          name: acc.name,
          email: acc.email,
          password_hash: passHash,
          role: acc.role,
          pegawai_id: acc.pegawai_id,
        });
      }
    }

    // 7. Kelas / Rombel pada Semester Aktif (Ganjil)
    const idKelas7A = "kelas-7a-seed-id";
    const existingKelas = await db.select().from(kelas).limit(1);
    if (existingKelas.length === 0) {
      await db.insert(kelas).values([
        {
          id: idKelas7A,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          tahun_ajaran_id: idTaGanjil,
          nama: "7A",
          tingkat: 7,
          wali_kelas_id: idPegawaiGuru,
        },
        {
          id: "kelas-7b-seed-id",
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          tahun_ajaran_id: idTaGanjil,
          nama: "7B",
          tingkat: 7,
          wali_kelas_id: null,
        },
        {
          id: "kelas-8a-seed-id",
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          tahun_ajaran_id: idTaGanjil,
          nama: "8A",
          tingkat: 8,
          wali_kelas_id: null,
        },
        {
          id: "kelas-9a-seed-id",
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          tahun_ajaran_id: idTaGanjil,
          nama: "9A",
          tingkat: 9,
          wali_kelas_id: null,
        },
      ]);
    }

    // 8. Data Siswa Dummy Awal
    const existingSiswa = await db.select().from(siswa).limit(1);
    if (existingSiswa.length === 0) {
      const idSiswa1 = "siswa-1-seed-id";
      const idSiswa2 = "siswa-2-seed-id";
      const nikSiswa1 = "3517091503110001";
      const nikSiswa2 = "3517095207110002";

      await db.insert(siswa).values([
        {
          id: idSiswa1,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          nis: "26001",
          nisn: "0112345678",
          nama_lengkap: "Ahmad Rizky Pratama",
          jenis_kelamin: "L",
          tempat_lahir: "Jombang",
          tanggal_lahir: "2011-03-15",
          agama: "Islam",
          nik: await encryptSensitive(nikSiswa1),
          nik_hash: await generateNikHash(nikSiswa1),
          no_kk: await encryptSensitive("3517090101100005"),
          nik_ayah: await encryptSensitive("3517090504780001"),
          nik_ibu: await encryptSensitive("3517094808800002"),
          alamat_jalan: "Dsn. Thowalib RT 02 RW 01",
          desa: "Thowalib",
          kecamatan: "Jombang",
          kabupaten: "Jombang",
          provinsi: "Jawa Timur",
          status: "aktif",
          tahun_masuk: "2026",
        },
        {
          id: idSiswa2,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          nis: "26002",
          nisn: "0118765432",
          nama_lengkap: "Siti Fatimah Azzahra",
          jenis_kelamin: "P",
          tempat_lahir: "Malang",
          tanggal_lahir: "2011-07-22",
          agama: "Islam",
          nik: await encryptSensitive(nikSiswa2),
          nik_hash: await generateNikHash(nikSiswa2),
          no_kk: await encryptSensitive("3517090101100006"),
          nik_ayah: await encryptSensitive("3517091206770003"),
          nik_ibu: await encryptSensitive("3517095511810004"),
          alamat_jalan: "Jl. Pesantren Timur No. 12",
          desa: "Thowalib",
          kecamatan: "Jombang",
          kabupaten: "Jombang",
          provinsi: "Jawa Timur",
          status: "aktif",
          tahun_masuk: "2026",
        },
      ]);

      // Masukkan ke anggota kelas 7A
      await db.insert(anggotaKelas).values([
        {
          id: generateUUID(),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          siswa_id: idSiswa1,
          kelas_id: idKelas7A,
          tahun_ajaran_id: idTaGanjil,
        },
        {
          id: generateUUID(),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          siswa_id: idSiswa2,
          kelas_id: idKelas7A,
          tahun_ajaran_id: idTaGanjil,
        },
      ]);

      // Seed data orang tua (Ayah & Ibu) untuk siswa awal
      await db.insert(waliSiswa).values([
        {
          id: generateUUID(),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          siswa_id: idSiswa1,
          hubungan: "ayah",
          nama_lengkap: "Bambang Prasetyo",
          status: "hidup",
          nik: await encryptSensitive("3517090504780001"),
          nik_hash: await generateNikHash("3517090504780001"),
          tempat_lahir: "Jombang",
          tanggal_lahir: "1978-04-05",
          pendidikan_terakhir: "S1",
          pekerjaan: "Wiraswasta",
          no_hp: "081234567891",
        },
        {
          id: generateUUID(),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          siswa_id: idSiswa1,
          hubungan: "ibu",
          nama_lengkap: "Nur Aini",
          status: "hidup",
          nik: await encryptSensitive("3517094808800002"),
          nik_hash: await generateNikHash("3517094808800002"),
          tempat_lahir: "Mojokerto",
          tanggal_lahir: "1980-08-18",
          pendidikan_terakhir: "SMA",
          pekerjaan: "Ibu Rumah Tangga",
          no_hp: "081234567892",
          kartu_bantuan: "KIP",
        },
      ]);
    }

    // 9. Berita Publik Terbit
    const existingBerita = await db.select().from(berita).limit(1);
    if (existingBerita.length === 0) {
      await db.insert(berita).values([
        {
          id: generateUUID(),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          judul: "Penerimaan Peserta Didik Baru (PPDB) Tahun Ajaran 2026/2027 Resmi Dibuka",
          slug: "ppdb-2026-2027-resmi-dibuka",
          ringkasan:
            "MTs Roudhotut Thowalib membuka pendaftaran siswa dan peserta didik baru dengan program tahfidz dan sains.",
          isi: "Alhamdulillah, pendaftaran peserta didik baru (PPDB) MTs Roudhotut Thowalib tahun ajaran 2026/2027 telah resmi dibuka.",
          status: "terbit",
          published_at: "2026-07-01",
        },
      ]);
    }

    // 10. Pengumuman Aktif
    const existingPengumuman = await db.select().from(pengumuman).limit(1);
    if (existingPengumuman.length === 0) {
      await db.insert(pengumuman).values([
        {
          id: generateUUID(),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "synced",
          last_synced_at: now,
          version: 1,
          judul: "Pertemuan Wali Murid & Pembagian Laporan Hasil Belajar",
          isi: "Diberitahukan kepada seluruh bapak/ibu wali siswa bahwa pertemuan wali murid akan dilaksanakan pada hari Sabtu, 24 Oktober 2026.",
          tanggal_mulai: "2026-10-15",
          tanggal_selesai: "2026-10-25",
          status: "aktif",
        },
      ]);
    }

    // 11. Surat Keluar Contoh
    const existingSuratKeluar = await db.select().from(suratKeluar).limit(1);
    if (existingSuratKeluar.length === 0) {
      await db.insert(suratKeluar).values({
        id: generateUUID(),
        created_at: now,
        updated_at: now,
        deleted_at: null,
        sync_status: "synced",
        last_synced_at: now,
        version: 1,
        tahun_ajaran_id: idTaGanjil,
        tahun: 2026,
        nomor_urut: 1,
        nomor_surat: "001/MTs.RT/PP.00/VIII/2026",
        tanggal_surat: "2026-08-05",
        tujuan: "Wali Murid Kelas 7, 8, dan 9",
        perihal: "Pemberitahuan Kegiatan Ekstrakurikuler Wajib Pramuka dan Pencak Silat",
        kategori: "Pemberitahuan",
        sifat: "biasa",
        status: "aktif",
      });
    }

    // 12. Metadata Sinkronisasi
    const existingMeta = await db.select().from(syncMetadata).limit(1);
    if (existingMeta.length === 0) {
      await db.insert(syncMetadata).values([
        { key: "last_pull_timestamp", value: now },
        { key: "last_synced_at", value: now },
        { key: "api_url", value: "http://192.168.0.109:3000" },
        { key: "device_id", value: generateUUID() },
      ]);
    }

    console.log("Seeding data awal MTs Roudhotut Thowalib selesai dengan sukses!");
  } catch (err) {
    console.error("Peringatan saat seeding database:", err);
  }
}
