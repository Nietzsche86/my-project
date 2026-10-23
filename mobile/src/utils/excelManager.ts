import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { db } from "../db/client";
import {
  siswa,
  pegawai,
  suratMasuk,
  suratKeluar,
  logEksport,
  anggotaKelas,
  kelas,
  tahunAjaran,
  type Siswa,
  type Pegawai,
} from "../db/schema";
import { isNull, and, eq, inArray } from "drizzle-orm";
import {
  generateUUID,
  getIsoUtcString,
  decryptSensitive,
  encryptSensitive,
  generateNikHash,
} from "../db/crypto";

export interface ImportReport {
  successCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Helper untuk mencatat aktivitas eksport ke tabel log_eksport
 */
async function recordExportLog(
  userId: string | undefined,
  jenisData: "siswa" | "pegawai" | "surat_masuk" | "surat_keluar",
  jumlahBaris: number,
  namaFile: string,
  filterInfo: Record<string, any> = {}
) {
  try {
    const nowIso = getIsoUtcString();
    await db.insert(logEksport).values({
      id: generateUUID(),
      created_at: nowIso,
      updated_at: nowIso,
      deleted_at: null,
      sync_status: "pending_push",
      last_synced_at: null,
      version: 1,
      user_id: userId || null,
      jenis_data: jenisData,
      filter: JSON.stringify(filterInfo),
      jumlah_baris: jumlahBaris,
      nama_file: namaFile,
      ip_address: "127.0.0.1 (Local Client)",
    });
  } catch (e) {
    console.warn("Gagal mencatat log eksport:", e);
  }
}

/**
 * 1. EKSPORT DATA SISWA AKTIF KE EXCEL (.xlsx)
 * - Guru: Hanya siswa di kelasnya, kolom sensitif (NIK/KK) dihilangkan.
 * - Admin/TU: Seluruh siswa aktif dengan data EMIS lengkap.
 */
export async function exportSiswaToExcel(options: {
  role: string;
  userId?: string;
  teacherClassIds?: string[];
}): Promise<{ success: boolean; message: string; uri?: string }> {
  try {
    const { role, userId, teacherClassIds = [] } = options;

    // 1. Ambil tahun ajaran aktif untuk mapping rombel
    const taRes = await db
      .select()
      .from(tahunAjaran)
      .where(and(eq(tahunAjaran.is_active, 1), isNull(tahunAjaran.deleted_at)))
      .limit(1);
    const taId = taRes[0]?.id;

    const rombelMap = new Map<string, string>();
    if (taId) {
      const aList = await db
        .select({
          siswaId: anggotaKelas.siswa_id,
          kelasNama: kelas.nama,
          tingkat: kelas.tingkat,
        })
        .from(anggotaKelas)
        .innerJoin(kelas, eq(anggotaKelas.kelas_id, kelas.id))
        .where(
          and(
            eq(anggotaKelas.tahun_ajaran_id, taId),
            isNull(anggotaKelas.deleted_at),
            isNull(kelas.deleted_at)
          )
        );
      aList.forEach((a) => rombelMap.set(a.siswaId, `Kelas ${a.kelasNama} (${a.tingkat})`));
    }

    // 2. Query Siswa Aktif
    let rawSiswa: Siswa[] = [];
    if (role === "guru") {
      if (teacherClassIds.length === 0) {
        return { success: false, message: "Anda belum memiliki kelas yang diampu / diwalikan." };
      }
      const allowedSiswaIds = await db
        .select({ siswaId: anggotaKelas.siswa_id })
        .from(anggotaKelas)
        .where(
          and(
            inArray(anggotaKelas.kelas_id, teacherClassIds),
            isNull(anggotaKelas.deleted_at)
          )
        );
      const idSet = new Set(allowedSiswaIds.map((a) => a.siswaId));
      const allActive = await db
        .select()
        .from(siswa)
        .where(and(eq(siswa.status, "aktif"), isNull(siswa.deleted_at)));
      rawSiswa = allActive.filter((s) => idSet.has(s.id));
    } else {
      rawSiswa = await db
        .select()
        .from(siswa)
        .where(and(eq(siswa.status, "aktif"), isNull(siswa.deleted_at)));
    }

    rawSiswa.sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));

    // 3. Susun data baris Excel
    const rows = [];
    for (let i = 0; i < rawSiswa.length; i++) {
      const s = rawSiswa[i]!;
      const rombel = rombelMap.get(s.id) || "Belum Masuk Rombel";

      if (role === "guru") {
        rows.push({
          No: i + 1,
          NIS: s.nis || "-",
          NISN: s.nisn || "-",
          "Nama Lengkap": s.nama_lengkap,
          "Jenis Kelamin": s.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan",
          "Tempat Lahir": s.tempat_lahir || "-",
          "Tanggal Lahir": s.tanggal_lahir || "-",
          "Rombel Semester Ini": rombel,
          Alamat: s.alamat_jalan || "-",
          Desa: s.desa || "-",
          Kecamatan: s.kecamatan || "-",
          "No. Telepon / WhatsApp": s.no_hp || "-",
        });
      } else {
        // Admin / TU: Termasuk NIK didekripsi
        let decryptedNik = "-";
        if (s.nik) {
          decryptedNik = (await decryptSensitive(s.nik)) || "-";
        }
        let decryptedNikAyah = "-";
        if (s.nik_ayah) {
          decryptedNikAyah = (await decryptSensitive(s.nik_ayah)) || "-";
        }
        let decryptedNikIbu = "-";
        if (s.nik_ibu) {
          decryptedNikIbu = (await decryptSensitive(s.nik_ibu)) || "-";
        }
        rows.push({
          No: i + 1,
          NIS: s.nis || "-",
          NISN: s.nisn || "-",
          "Nama Lengkap": s.nama_lengkap,
          NIK: decryptedNik,
          "NIK Ayah": decryptedNikAyah,
          "NIK Ibu": decryptedNikIbu,
          "Jenis Kelamin": s.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan",
          "Tempat Lahir": s.tempat_lahir || "-",
          "Tanggal Lahir": s.tanggal_lahir || "-",
          Agama: s.agama || "Islam",
          "Rombel Semester Ini": rombel,
          "Asal Sekolah (SD/MI)": s.asal_sekolah || "-",
          "Tahun Masuk": s.tahun_masuk || "-",
          "Alamat Lengkap": s.alamat_jalan || "-",
          RT: s.rt || "-",
          RW: s.rw || "-",
          Desa: s.desa || "-",
          Kecamatan: s.kecamatan || "-",
          Kabupaten: s.kabupaten || "-",
          "No. HP": s.no_hp || "-",
          Status: s.status.toUpperCase(),
        });
      }
    }

    // 4. Buat File Spreadsheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Data_Siswa");

    const base64Data = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    const filename = `Data_Siswa_MTsRTH_${Date.now()}.xlsx`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 5. Catat Audit Log
    await recordExportLog(userId, "siswa", rows.length, filename, {
      role,
      filter: "aktif",
    });

    // 6. Bagikan / Simpan File
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Unduh File Data Siswa Excel",
      });
    }

    return {
      success: true,
      message: `Berhasil mengeksport ${rows.length} data siswa ke format Excel.`,
      uri: fileUri,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Gagal mengeksport data siswa." };
  }
}

/**
 * 2. EKSPORT DATA PEGAWAI / GURU KE EXCEL (.xlsx)
 */
export async function exportPegawaiToExcel(options: {
  userId?: string;
}): Promise<{ success: boolean; message: string; uri?: string }> {
  try {
    const list = await db
      .select()
      .from(pegawai)
      .where(isNull(pegawai.deleted_at));

    list.sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));

    const rows = [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!;
      let decryptedNik = "-";
      if (p.nik) {
        decryptedNik = (await decryptSensitive(p.nik)) || "-";
      }

      rows.push({
        No: i + 1,
        "Nama Lengkap": p.nama_lengkap,
        Jenis: p.jenis === "guru" ? "Guru (PTK)" : "Tendik (Staf TU)",
        "Status Kepegawaian": p.status_kepegawaian.toUpperCase(),
        Jabatan: p.jabatan || "-",
        NIP: p.nip || "-",
        NUPTK: p.nuptk || "-",
        NPK: p.npk || "-",
        PegID: p.pegid || "-",
        NRG: p.nrg || "-",
        NIK: decryptedNik,
        "Jenis Kelamin": p.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan",
        "Tempat Lahir": p.tempat_lahir || "-",
        "Tanggal Lahir": p.tanggal_lahir || "-",
        TMT: p.tmt || "-",
        "No. HP / WhatsApp": p.no_hp || "-",
        Email: p.email || "-",
        "Status Aktif": p.status_aktif.toUpperCase(),
      });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Data_Pegawai");

    const base64Data = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    const filename = `Data_Pegawai_MTsRTH_${Date.now()}.xlsx`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await recordExportLog(options.userId, "pegawai", rows.length, filename);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Unduh File Data Pegawai Excel",
      });
    }

    return {
      success: true,
      message: `Berhasil mengeksport ${rows.length} data pegawai ke format Excel.`,
      uri: fileUri,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Gagal mengeksport data pegawai." };
  }
}

/**
 * 3. EKSPORT ARSIP PERSURATAN (SURAT MASUK & KELUAR) KE EXCEL
 */
export async function exportSuratToExcel(options: {
  userId?: string;
  jenis: "masuk" | "keluar";
}): Promise<{ success: boolean; message: string; uri?: string }> {
  try {
    const { userId, jenis } = options;
    const wb = XLSX.utils.book_new();
    let rowCount = 0;
    let filename = "";

    if (jenis === "keluar") {
      const list = await db
        .select()
        .from(suratKeluar)
        .orderBy(suratKeluar.tahun, suratKeluar.nomor_urut);

      const rows = list.map((sk) => ({
        "No. Agenda": `#${sk.nomor_urut}`,
        Tahun: sk.tahun,
        "Nomor Surat": sk.nomor_surat,
        "Tanggal Surat": sk.tanggal_surat,
        Tujuan: sk.tujuan,
        Perihal: sk.perihal,
        Kategori: sk.kategori || "-",
        Sifat: sk.sifat.toUpperCase(),
        Status: sk.status.toUpperCase(),
        "Alasan Pembatalan": sk.alasan_batal || "-",
        Keterangan: sk.keterangan || "-",
      }));

      rowCount = rows.length;
      filename = `Buku_Agenda_Surat_Keluar_${Date.now()}.xlsx`;
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Surat_Keluar");
      await recordExportLog(userId, "surat_keluar", rowCount, filename);
    } else {
      const list = await db
        .select()
        .from(suratMasuk)
        .where(isNull(suratMasuk.deleted_at))
        .orderBy(suratMasuk.tanggal_diterima);

      const rows = list.map((sm, idx) => ({
        No: idx + 1,
        "Nomor Surat Asal": sm.nomor_surat,
        "Tanggal Surat": sm.tanggal_surat,
        "Tanggal Diterima": sm.tanggal_diterima,
        "Instansi Pengirim": sm.pengirim,
        Perihal: sm.perihal,
        Kategori: sm.kategori || "-",
        Sifat: sm.sifat.toUpperCase(),
        "Keterangan / Disposisi": sm.keterangan || "-",
      }));

      rowCount = rows.length;
      filename = `Buku_Agenda_Surat_Masuk_${Date.now()}.xlsx`;
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Surat_Masuk");
      await recordExportLog(userId, "surat_masuk", rowCount, filename);
    }

    const base64Data = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: `Unduh Buku Agenda Surat ${jenis === "keluar" ? "Keluar" : "Masuk"}`,
      });
    }

    return {
      success: true,
      message: `Berhasil mengeksport ${rowCount} data surat ${jenis}.`,
      uri: fileUri,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Gagal mengeksport data surat." };
  }
}

/**
 * 4. DOWNLOAD TEMPLATE IMPORT EXCEL SISWA
 */
export async function downloadTemplateImportSiswa(): Promise<{ success: boolean; message: string }> {
  try {
    const templateRows = [
      {
        nis: "26001",
        nisn: "0091234567",
        nama_lengkap: "Ahmad Zainal Arifin",
        jenis_kelamin: "L",
        tempat_lahir: "Magelang",
        tanggal_lahir: "2012-05-14",
        nik: "3308123456780001",
        alamat_jalan: "Jl. Pesantren No. 12",
        desa: "Tanjungsari",
        kecamatan: "Windusari",
        asal_sekolah: "MI Ma'arif Windusari",
        no_hp: "081234567890",
      },
      {
        nis: "26002",
        nisn: "0091234568",
        nama_lengkap: "Siti Nur Fatimah",
        jenis_kelamin: "P",
        tempat_lahir: "Temanggung",
        tanggal_lahir: "2012-08-20",
        nik: "3308123456780002",
        alamat_jalan: "Dusun Krajan RT 02 RW 01",
        desa: "Bandarsari",
        kecamatan: "Windusari",
        asal_sekolah: "SD Negeri 1 Windusari",
        no_hp: "082345678901",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateRows);
    XLSX.utils.book_append_sheet(wb, ws, "Template_Siswa");

    const base64Data = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    const filename = `Template_Import_Siswa_MTsRTH.xlsx`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Unduh Template Excel Import Siswa",
      });
    }

    return { success: true, message: "Template Excel Siswa berhasil diunduh." };
  } catch (e: any) {
    return { success: false, message: e?.message || "Gagal mengunduh template." };
  }
}

/**
 * 5. DOWNLOAD TEMPLATE IMPORT EXCEL PEGAWAI
 */
export async function downloadTemplateImportPegawai(): Promise<{ success: boolean; message: string }> {
  try {
    const templateRows = [
      {
        nama_lengkap: "M. Hasyim Asy'ari, M.Pd.",
        nip: "198506122010011012",
        nuptk: "8765432109876543",
        npk: "987654321",
        pegid: "10293847",
        jenis: "guru",
        status_kepegawaian: "GTY",
        jabatan: "Guru Mapel Fikih",
        jenis_kelamin: "L",
        tempat_lahir: "Magelang",
        tanggal_lahir: "1985-06-12",
        nik: "3308123456780003",
        no_hp: "081398765432",
        email: "hasyim@mts-rth.sch.id",
      },
      {
        nama_lengkap: "Nurul Aini, S.E.",
        nip: "",
        nuptk: "",
        npk: "",
        pegid: "20394857",
        jenis: "tendik",
        status_kepegawaian: "Honorer",
        jabatan: "Staf Administrasi Keuangan",
        jenis_kelamin: "P",
        tempat_lahir: "Semarang",
        tanggal_lahir: "1992-11-04",
        nik: "3308123456780004",
        no_hp: "085712345678",
        email: "nurul@mts-rth.sch.id",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateRows);
    XLSX.utils.book_append_sheet(wb, ws, "Template_Pegawai");

    const base64Data = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    const filename = `Template_Import_Pegawai_MTsRTH.xlsx`;
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Unduh Template Excel Import Pegawai",
      });
    }

    return { success: true, message: "Template Excel Pegawai berhasil diunduh." };
  } catch (e: any) {
    return { success: false, message: e?.message || "Gagal mengunduh template." };
  }
}

/**
 * 6. IMPORT DATA SISWA DARI FILE EXCEL (.xlsx)
 * Mode: 'skip' (lewati duplikasi) | 'update' (perbarui data jika NISN/NIS cocok)
 */
export async function importSiswaFromExcel(
  fileUri: string,
  mode: "skip" | "update" = "skip"
): Promise<ImportReport> {
  const report: ImportReport = {
    successCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  try {
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const wb = XLSX.read(base64Data, { type: "base64" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      report.errors.push("File Excel tidak memiliki lembar kerja (sheet).");
      return report;
    }

    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]!);
    if (rows.length === 0) {
      report.errors.push("Tidak ada data baris yang ditemukan pada file Excel.");
      return report;
    }

    const nowIso = getIsoUtcString();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const nama = String(row.nama_lengkap || row["Nama Lengkap"] || "").trim();
      const nisn = String(row.nisn || row["NISN"] || "").trim() || null;
      const nis = String(row.nis || row["NIS"] || "").trim() || null;
      const rawJk = String(row.jenis_kelamin || row["Jenis Kelamin"] || "L").toUpperCase();
      const jk = rawJk.startsWith("P") ? "P" : "L";
      const rawNik = String(row.nik || row["NIK"] || "").trim();

      if (!nama) {
        report.errors.push(`Baris ${i + 2}: Kolom nama_lengkap wajib diisi.`);
        continue;
      }

      try {
        let encNik: string | null = null;
        let hNik: string | null = null;
        if (rawNik && rawNik.length >= 10) {
          encNik = await encryptSensitive(rawNik);
          hNik = await generateNikHash(rawNik);
        }

        // Cek keberadaan siswa di database
        let existingSiswa: Siswa | null = null;
        if (nisn) {
          const found = await db.select().from(siswa).where(eq(siswa.nisn, nisn)).limit(1);
          if (found.length > 0 && found[0]) existingSiswa = found[0];
        }
        if (!existingSiswa && nis) {
          const found = await db.select().from(siswa).where(eq(siswa.nis, nis)).limit(1);
          if (found.length > 0 && found[0]) existingSiswa = found[0];
        }

        if (existingSiswa) {
          if (mode === "skip") {
            report.skippedCount++;
            continue;
          } else {
            // Update data siswa yang ada
            await db
              .update(siswa)
              .set({
                nama_lengkap: nama,
                jenis_kelamin: jk,
                tempat_lahir: row.tempat_lahir || row["Tempat Lahir"] || existingSiswa.tempat_lahir,
                tanggal_lahir: row.tanggal_lahir || row["Tanggal Lahir"] || existingSiswa.tanggal_lahir,
                alamat_jalan: row.alamat_jalan || row["Alamat"] || existingSiswa.alamat_jalan,
                desa: row.desa || existingSiswa.desa,
                kecamatan: row.kecamatan || existingSiswa.kecamatan,
                asal_sekolah: row.asal_sekolah || existingSiswa.asal_sekolah,
                no_hp: row.no_hp || existingSiswa.no_hp,
                nik: encNik || existingSiswa.nik,
                nik_hash: hNik || existingSiswa.nik_hash,
                updated_at: nowIso,
                sync_status: "pending_push",
                version: (existingSiswa.version || 1) + 1,
              })
              .where(eq(siswa.id, existingSiswa.id));

            report.updatedCount++;
          }
        } else {
          // Insert Siswa Baru
          await db.insert(siswa).values({
            id: generateUUID(),
            created_at: nowIso,
            updated_at: nowIso,
            deleted_at: null,
            sync_status: "pending_push",
            last_synced_at: null,
            version: 1,
            nama_lengkap: nama,
            nis: nis,
            nisn: nisn,
            jenis_kelamin: jk,
            tempat_lahir: row.tempat_lahir || row["Tempat Lahir"] || null,
            tanggal_lahir: row.tanggal_lahir || row["Tanggal Lahir"] || null,
            agama: "Islam",
            alamat_jalan: row.alamat_jalan || row["Alamat"] || null,
            desa: row.desa || null,
            kecamatan: row.kecamatan || null,
            asal_sekolah: row.asal_sekolah || null,
            no_hp: row.no_hp || null,
            nik: encNik,
            nik_hash: hNik,
            status: "aktif",
          });

          report.successCount++;
        }
      } catch (err: any) {
        report.errors.push(`Baris ${i + 2} (${nama}): ${err?.message || "Kesalahan database"}`);
      }
    }
  } catch (err: any) {
    report.errors.push(`Gagal membaca file Excel: ${err?.message}`);
  }

  return report;
}

/**
 * 7. IMPORT DATA PEGAWAI DARI FILE EXCEL (.xlsx)
 */
export async function importPegawaiFromExcel(
  fileUri: string,
  mode: "skip" | "update" = "skip"
): Promise<ImportReport> {
  const report: ImportReport = {
    successCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  try {
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const wb = XLSX.read(base64Data, { type: "base64" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      report.errors.push("File Excel tidak memiliki lembar kerja.");
      return report;
    }

    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]!);
    if (rows.length === 0) {
      report.errors.push("Tidak ada data pada file Excel.");
      return report;
    }

    const nowIso = getIsoUtcString();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const nama = String(row.nama_lengkap || row["Nama Lengkap"] || "").trim();
      const nuptk = String(row.nuptk || row["NUPTK"] || "").trim() || null;
      const nip = String(row.nip || row["NIP"] || "").trim() || null;
      const pegid = String(row.pegid || row["PegID"] || "").trim() || null;
      const rawJenis = String(row.jenis || "guru").toLowerCase();
      const jenis = rawJenis === "tendik" ? "tendik" : "guru";
      const statusKepegawaian = String(row.status_kepegawaian || "GTY");
      const jabatan = String(row.jabatan || (jenis === "guru" ? "Guru Mapel" : "Staf TU"));
      const rawNik = String(row.nik || row["NIK"] || "").trim();

      if (!nama) {
        report.errors.push(`Baris ${i + 2}: Nama lengkap pegawai wajib diisi.`);
        continue;
      }

      try {
        let encNik: string | null = null;
        let hNik: string | null = null;
        if (rawNik && rawNik.length >= 10) {
          encNik = await encryptSensitive(rawNik);
          hNik = await generateNikHash(rawNik);
        }

        // Cek duplikasi
        let existing: Pegawai | null = null;
        if (nuptk) {
          const found = await db.select().from(pegawai).where(eq(pegawai.nuptk, nuptk)).limit(1);
          if (found.length > 0 && found[0]) existing = found[0];
        }
        if (!existing && nip) {
          const found = await db.select().from(pegawai).where(eq(pegawai.nip, nip)).limit(1);
          if (found.length > 0 && found[0]) existing = found[0];
        }

        if (existing) {
          if (mode === "skip") {
            report.skippedCount++;
            continue;
          } else {
            await db
              .update(pegawai)
              .set({
                nama_lengkap: nama,
                jenis: jenis as any,
                status_kepegawaian: statusKepegawaian as any,
                jabatan: jabatan,
                no_hp: row.no_hp || existing.no_hp,
                email: row.email || existing.email,
                nik: encNik || existing.nik,
                nik_hash: hNik || existing.nik_hash,
                updated_at: nowIso,
                sync_status: "pending_push",
                version: (existing.version || 1) + 1,
              })
              .where(eq(pegawai.id, existing.id));

            report.updatedCount++;
          }
        } else {
          await db.insert(pegawai).values({
            id: generateUUID(),
            created_at: nowIso,
            updated_at: nowIso,
            deleted_at: null,
            sync_status: "pending_push",
            last_synced_at: null,
            version: 1,
            nama_lengkap: nama,
            jenis: jenis as any,
            status_kepegawaian: statusKepegawaian as any,
            jabatan: jabatan,
            nip: nip,
            nuptk: nuptk,
            npk: row.npk ? String(row.npk) : null,
            pegid: pegid,
            jenis_kelamin: String(row.jenis_kelamin || "L").toUpperCase().startsWith("P") ? "P" : "L",
            status_aktif: "aktif",
            no_hp: row.no_hp ? String(row.no_hp) : null,
            email: row.email ? String(row.email) : null,
            nik: encNik,
            nik_hash: hNik,
          });

          report.successCount++;
        }
      } catch (err: any) {
        report.errors.push(`Baris ${i + 2} (${nama}): ${err?.message || "Kesalahan database"}`);
      }
    }
  } catch (err: any) {
    report.errors.push(`Gagal membaca file Excel: ${err?.message}`);
  }

  return report;
}
