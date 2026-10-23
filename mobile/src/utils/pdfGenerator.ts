import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  Pegawai,
  RiwayatPendidikan,
  MataPelajaran,
  Siswa,
  WaliSiswa,
} from "../db/schema";

export interface PegawaiBiodataPrintData {
  pegawai: Pegawai;
  nikDecrypted?: string;
  npwpDecrypted?: string;
  rekeningDecrypted?: string;
  riwayatPendidikan: RiwayatPendidikan[];
  mataPelajaranList: MataPelajaran[];
  kepalaMadrasahName?: string;
  kepalaMadrasahNip?: string;
}

export interface SiswaBukuIndukPrintData {
  siswa: Siswa;
  nikDecrypted?: string;
  noKkDecrypted?: string;
  nikAyahDecrypted?: string;
  nikIbuDecrypted?: string;
  nikWaliDecrypted?: string;
  waliList: WaliSiswa[];
  kelasRiwayat: {
    tahunAjaranNama: string;
    semester: number;
    namaSemester: string;
    kelasNama: string;
    tingkat: number;
  }[];
  kepalaMadrasahName?: string;
  kepalaMadrasahNip?: string;
}

export interface AbsensiKelasPrintData {
  kelasNama: string;
  tingkat: number;
  tahunAjaranNama: string;
  semesterNama: string;
  waliKelasName?: string;
  waliKelasNip?: string;
  guruPengampuName?: string;
  mapelNama?: string;
  siswaList: {
    nomor: number;
    nis: string | null;
    namaLengkap: string;
    jenisKelamin: string;
  }[];
}

export interface SuratKeteranganSiswaPrintData {
  nomorSurat: string;
  tanggalSurat: string;
  siswa: {
    namaLengkap: string;
    nis: string | null;
    nisn: string | null;
    tempatLahir: string | null;
    tanggalLahir: string | null;
    jenisKelamin: string;
    kelasNama: string;
    tingkat: number;
    namaWali?: string | null;
    alamat?: string | null;
  };
  tahunAjaranNama: string;
  semesterNama: string;
  keperluan: string;
  kepalaMadrasahName?: string;
  kepalaMadrasahNip?: string;
}

// 1. GENERATE BIODATA PEGAWAI PDF
export async function generateAndSharePegawaiBiodataPdf(
  data: PegawaiBiodataPrintData
): Promise<{ success: boolean; message: string }> {
  const {
    pegawai,
    nikDecrypted = "-",
    npwpDecrypted = "-",
    rekeningDecrypted = "-",
    riwayatPendidikan,
    mataPelajaranList,
    kepalaMadrasahName = "H. Ahmad Fauzi, S.Pd.I",
    kepalaMadrasahNip = "198005122005011003",
  } = data;

  const todayStr = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const riwayatHtml =
    riwayatPendidikan.length === 0
      ? `<tr><td colspan="4" style="text-align: center; color: #64748B; font-style: italic; padding: 8px;">Belum ada riwayat pendidikan yang tercatat</td></tr>`
      : riwayatPendidikan
          .map(
            (r, idx) => `
        <tr>
          <td style="text-align: center; padding: 6px;">${idx + 1}</td>
          <td style="padding: 6px; font-weight: 600;">${r.jenjang}</td>
          <td style="padding: 6px;">${r.institusi}</td>
          <td style="text-align: center; padding: 6px;">${r.jurusan || "-"} (${r.tahun_lulus || "-"})</td>
        </tr>
      `
          )
          .join("");

  const mapelHtml =
    mataPelajaranList.length === 0
      ? `<tr><td colspan="4" style="text-align: center; color: #64748B; font-style: italic; padding: 8px;">Tidak ada mata pelajaran spesifik yang diampu</td></tr>`
      : mataPelajaranList
          .map(
            (m, idx) => `
        <tr>
          <td style="text-align: center; padding: 6px;">${idx + 1}</td>
          <td style="text-align: center; font-weight: bold; padding: 6px;">${m.kode_mapel}</td>
          <td style="padding: 6px; font-weight: 600;">${m.nama_mapel}</td>
          <td style="text-align: center; padding: 6px;">${m.kelompok}</td>
        </tr>
      `
          )
          .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Biodata Pegawai - ${pegawai.nama_lengkap}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #0F172A;
      line-height: 1.4;
      padding: 24px;
      margin: 0;
      font-size: 11pt;
    }
    .kop-wrapper {
      text-align: center;
      border-bottom: 3px double #047857;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .kop-yayasan {
      font-size: 11pt;
      font-weight: bold;
      letter-spacing: 0.5px;
      color: #334155;
    }
    .kop-madrasah {
      font-size: 16pt;
      font-weight: 900;
      color: #047857;
      margin: 2px 0;
      letter-spacing: 0.5px;
    }
    .kop-nsm {
      font-size: 9pt;
      color: #64748B;
      margin-bottom: 4px;
    }
    .kop-alamat {
      font-size: 9pt;
      color: #475569;
    }
    .doc-title-wrapper {
      text-align: center;
      margin-bottom: 20px;
    }
    .doc-title {
      font-size: 13pt;
      font-weight: 800;
      text-transform: uppercase;
      text-decoration: underline;
      color: #0F172A;
      letter-spacing: 0.5px;
    }
    .doc-subtitle {
      font-size: 10pt;
      color: #64748B;
      margin-top: 4px;
    }
    .section-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #047857;
      border-bottom: 1.5px solid #E2E8F0;
      padding-bottom: 4px;
      margin-top: 16px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    table.data-table td {
      padding: 4px 6px;
      vertical-align: top;
      font-size: 10pt;
    }
    table.data-table td.label {
      width: 28%;
      color: #475569;
      font-weight: 600;
    }
    table.data-table td.colon {
      width: 2%;
      color: #64748B;
    }
    table.data-table td.value {
      width: 70%;
      color: #0F172A;
      font-weight: 500;
    }
    table.grid-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      margin-bottom: 12px;
    }
    table.grid-table th {
      background-color: #ECFDF5;
      color: #047857;
      font-weight: 800;
      font-size: 9.5pt;
      border: 1px solid #CBD5E1;
      padding: 6px;
      text-align: center;
    }
    table.grid-table td {
      border: 1px solid #E2E8F0;
      font-size: 9.5pt;
    }
    .signature-row {
      margin-top: 36px;
      width: 100%;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .signature-space {
      height: 65px;
    }
    .signature-name {
      font-weight: 800;
      text-decoration: underline;
      color: #0F172A;
    }
    .signature-meta {
      font-size: 9pt;
      color: #64748B;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <!-- KOP SURAT MADRASAH -->
  <div class="kop-wrapper">
    <div class="kop-yayasan">YAYASAN PONDOK PESANTREN ROUDHOTUT THOWALIB</div>
    <div class="kop-madrasah">MADRASAH TSANAWIYAH ROUDHOTUT THOWALIB</div>
    <div class="kop-nsm">NSM: 121235170045 &nbsp;|&nbsp; NPSN: 20584489 &nbsp;|&nbsp; Terakreditasi "A"</div>
    <div class="kop-alamat">Dsn. Thowalib, Ds. Bandung, Kec. Diwek, Kab. Jombang, Jawa Timur 61471</div>
  </div>

  <!-- JUDUL DOKUMEN -->
  <div class="doc-title-wrapper">
    <div class="doc-title">BIODATA RESMI PENDIDIK & TENAGA KEPENDIDIKAN</div>
    <div class="doc-subtitle">Sistem Database Terpadu MTs Roudhotut Thowalib</div>
  </div>

  <!-- I. IDENTITAS PRIBADI -->
  <div class="section-title">I. Identitas Pribadi</div>
  <table class="data-table">
    <tr>
      <td class="label">Nama Lengkap</td>
      <td class="colon">:</td>
      <td class="value" style="font-weight: 800; color: #047857;">${pegawai.nama_lengkap}</td>
    </tr>
    <tr>
      <td class="label">NIK (Kependudukan)</td>
      <td class="colon">:</td>
      <td class="value">${nikDecrypted}</td>
    </tr>
    <tr>
      <td class="label">Jenis Kelamin</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</td>
    </tr>
    <tr>
      <td class="label">Tempat, Tanggal Lahir</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.tempat_lahir || "-"}, ${pegawai.tanggal_lahir || "-"}</td>
    </tr>
    <tr>
      <td class="label">Alamat Domisili</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.alamat_jalan || "-"} RT ${pegawai.rt || "-"} RW ${pegawai.rw || "-"}, Desa ${pegawai.desa || "-"}, Kec. ${pegawai.kecamatan || "-"}, ${pegawai.kabupaten || "-"}, Prov. ${pegawai.provinsi || "-"} (${pegawai.kode_pos || "-"})</td>
    </tr>
    <tr>
      <td class="label">Kontak (HP / WhatsApp)</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.no_hp || "-"}</td>
    </tr>
    <tr>
      <td class="label">Alamat Email</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.email || "-"}</td>
    </tr>
  </table>

  <!-- II. KEPEGAWAIAN & EMIS KEMENAG -->
  <div class="section-title">II. Data Kepegawaian & EMIS Kemenag</div>
  <table class="data-table">
    <tr>
      <td class="label">Jenis Pegawai</td>
      <td class="colon">:</td>
      <td class="value" style="font-weight: bold;">${pegawai.jenis === "guru" ? "Tenaga Pendidik (Guru)" : "Tenaga Kependidikan (Tendik)"}</td>
    </tr>
    <tr>
      <td class="label">Jabatan Struktural</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.jabatan || "-"}</td>
    </tr>
    <tr>
      <td class="label">Tugas Tambahan</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.tugas_tambahan || "-"}</td>
    </tr>
    <tr>
      <td class="label">Status Kepegawaian</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.status_kepegawaian} (Status Aktif: ${pegawai.status_aktif.toUpperCase()})</td>
    </tr>
    <tr>
      <td class="label">NIP</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.nip || "-"}</td>
    </tr>
    <tr>
      <td class="label">NUPTK / NPK</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.nuptk || "-"} / ${pegawai.npk || "-"}</td>
    </tr>
    <tr>
      <td class="label">PegID / NRG</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.pegid || "-"} / ${pegawai.nrg || "-"}</td>
    </tr>
    <tr>
      <td class="label">TMT Pengangkatan</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.tmt || "-"}</td>
    </tr>
    <tr>
      <td class="label">Nomor & Tanggal SK</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.sk_pengangkatan_nomor || "-"} (Tgl: ${pegawai.sk_pengangkatan_tanggal || "-"})</td>
    </tr>
    <tr>
      <td class="label">NPWP</td>
      <td class="colon">:</td>
      <td class="value">${npwpDecrypted}</td>
    </tr>
    <tr>
      <td class="label">Rekening Bank</td>
      <td class="colon">:</td>
      <td class="value">${pegawai.nama_bank || "-"} - ${rekeningDecrypted} (a.n ${pegawai.atas_nama_rekening || "-"})</td>
    </tr>
  </table>

  <!-- III. RIWAYAT PENDIDIKAN -->
  <div class="section-title">III. Riwayat Pendidikan Formal</div>
  <table class="grid-table">
    <thead>
      <tr>
        <th style="width: 8%;">No</th>
        <th style="width: 20%;">Jenjang</th>
        <th style="width: 44%;">Nama Institusi / Sekolah</th>
        <th style="width: 28%;">Jurusan & Tahun Lulus</th>
      </tr>
    </thead>
    <tbody>
      ${riwayatHtml}
    </tbody>
  </table>

  <!-- IV. MATA PELAJARAN YANG DIAMPU (KHUSUS GURU) -->
  ${
    pegawai.jenis === "guru"
      ? `
  <div class="section-title">IV. Mata Pelajaran Keahlian / Diampu</div>
  <table class="grid-table">
    <thead>
      <tr>
        <th style="width: 8%;">No</th>
        <th style="width: 18%;">Kode Mapel</th>
        <th style="width: 50%;">Nama Mata Pelajaran</th>
        <th style="width: 24%;">Kelompok</th>
      </tr>
    </thead>
    <tbody>
      ${mapelHtml}
    </tbody>
  </table>
  `
      : ""
  }

  <!-- TANDA TANGAN LEGALISASI -->
  <table style="width: 100%; margin-top: 36px; border: none;">
    <tr>
      <td style="width: 50%; text-align: center; vertical-align: top;">
        <div>Mengetahui,</div>
        <div style="font-weight: bold;">Kepala MTs Roudhotut Thowalib</div>
        <div class="signature-space"></div>
        <div class="signature-name">${kepalaMadrasahName}</div>
        <div class="signature-meta">NIP. ${kepalaMadrasahNip}</div>
      </td>
      <td style="width: 50%; text-align: center; vertical-align: top;">
        <div>Jombang, ${todayStr}</div>
        <div style="font-weight: bold;">Pegawai Bersangkutan,</div>
        <div class="signature-space"></div>
        <div class="signature-name">${pegawai.nama_lengkap}</div>
        <div class="signature-meta">NIP/NUPTK: ${pegawai.nip || pegawai.nuptk || "-"}</div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
        dialogTitle: `Biodata Pegawai - ${pegawai.nama_lengkap}`,
      });
      return { success: true, message: "PDF Biodata berhasil dicetak dan siap dibagikan." };
    } else {
      return { success: true, message: `PDF tersimpan di perangkat: ${uri}` };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Gagal mencetak dokumen PDF",
    };
  }
}

// 2. GENERATE BUKU INDUK SISWA (BIODATA RESMI SISWA) PDF
export async function generateAndShareSiswaBukuIndukPdf(
  data: SiswaBukuIndukPrintData
): Promise<{ success: boolean; message: string }> {
  const {
    siswa,
    nikDecrypted = "-",
    noKkDecrypted = "-",
    nikAyahDecrypted = "-",
    nikIbuDecrypted = "-",
    nikWaliDecrypted = "-",
    waliList = [],
    kelasRiwayat = [],
    kepalaMadrasahName = "H. Ahmad Fauzi, S.Pd.I",
    kepalaMadrasahNip = "198005122005011003",
  } = data;

  const todayStr = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const ayah = waliList.find((w) => w.hubungan === "ayah");
  const ibu = waliList.find((w) => w.hubungan === "ibu");
  const wali = waliList.find((w) => w.hubungan === "wali");

  const riwayatKelasHtml =
    kelasRiwayat.length === 0
      ? `<tr><td colspan="4" style="text-align: center; color: #64748B; font-style: italic; padding: 6px;">Belum ada catatan riwayat rombel</td></tr>`
      : kelasRiwayat
          .map(
            (k, idx) => `
        <tr>
          <td style="text-align: center; padding: 5px;">${idx + 1}</td>
          <td style="text-align: center; padding: 5px; font-weight: bold;">${k.tahunAjaranNama} (${k.namaSemester})</td>
          <td style="text-align: center; padding: 5px;">Tingkat ${k.tingkat}</td>
          <td style="text-align: center; padding: 5px; font-weight: 800; color: #047857;">Kelas ${k.kelasNama}</td>
        </tr>
      `
          )
          .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Lembar Buku Induk - ${siswa.nama_lengkap}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #0F172A;
      line-height: 1.35;
      padding: 24px;
      margin: 0;
      font-size: 10pt;
    }
    .kop-wrapper {
      text-align: center;
      border-bottom: 3px double #047857;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .kop-yayasan { font-size: 10pt; font-weight: bold; color: #334155; }
    .kop-madrasah { font-size: 15pt; font-weight: 900; color: #047857; margin: 2px 0; }
    .kop-nsm { font-size: 8.5pt; color: #64748B; margin-bottom: 2px; }
    .kop-alamat { font-size: 8.5pt; color: #475569; }
    .doc-title-wrapper { text-align: center; margin-bottom: 16px; }
    .doc-title { font-size: 12pt; font-weight: 900; text-transform: uppercase; text-decoration: underline; color: #0F172A; }
    .doc-subtitle { font-size: 9pt; color: #64748B; margin-top: 2px; }
    .section-title {
      font-size: 10pt;
      font-weight: 800;
      color: #047857;
      border-bottom: 1.5px solid #E2E8F0;
      padding-bottom: 3px;
      margin-top: 12px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    table.data-table td { padding: 3px 5px; vertical-align: top; font-size: 9.5pt; }
    table.data-table td.label { width: 30%; color: #475569; font-weight: 600; }
    table.data-table td.colon { width: 2%; color: #64748B; }
    table.data-table td.value { width: 68%; color: #0F172A; font-weight: 500; }
    table.grid-table { width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 8px; }
    table.grid-table th { background-color: #ECFDF5; color: #047857; font-weight: 800; font-size: 9pt; border: 1px solid #CBD5E1; padding: 5px; text-align: center; }
    table.grid-table td { border: 1px solid #E2E8F0; font-size: 9pt; }
    .signature-space { height: 55px; }
    .signature-name { font-weight: 800; text-decoration: underline; color: #0F172A; }
  </style>
</head>
<body>
  <div class="kop-wrapper">
    <div class="kop-yayasan">YAYASAN PONDOK PESANTREN ROUDHOTUT THOWALIB</div>
    <div class="kop-madrasah">MADRASAH TSANAWIYAH ROUDHOTUT THOWALIB</div>
    <div class="kop-nsm">NSM: 121235170045 &nbsp;|&nbsp; NPSN: 20584489 &nbsp;|&nbsp; Terakreditasi "A"</div>
    <div class="kop-alamat">Dsn. Thowalib, Ds. Bandung, Kec. Diwek, Kab. Jombang, Jawa Timur 61471</div>
  </div>

  <div class="doc-title-wrapper">
    <div class="doc-title">LEMBAR BUKU INDUK PESERTA DIDIK</div>
    <div class="doc-subtitle">Nomor Induk Siswa: ${siswa.nis || "-"} &nbsp;|&nbsp; NISN: ${siswa.nisn || "-"}</div>
  </div>

  <div class="section-title">A. Keterangan Pribadi Peserta Didik</div>
  <table class="data-table">
    <tr>
      <td class="label">Nama Lengkap Siswa</td>
      <td class="colon">:</td>
      <td class="value" style="font-weight: 800; color: #047857;">${siswa.nama_lengkap}</td>
    </tr>
    <tr>
      <td class="label">Nomor Induk Kependudukan (NIK)</td>
      <td class="colon">:</td>
      <td class="value">${nikDecrypted} (No. KK: ${noKkDecrypted})</td>
    </tr>
    <tr>
      <td class="label">NIK Ayah / NIK Ibu</td>
      <td class="colon">:</td>
      <td class="value">${nikAyahDecrypted} / ${nikIbuDecrypted}</td>
    </tr>
    <tr>
      <td class="label">Jenis Kelamin</td>
      <td class="colon">:</td>
      <td class="value">${siswa.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</td>
    </tr>
    <tr>
      <td class="label">Tempat, Tanggal Lahir</td>
      <td class="colon">:</td>
      <td class="value">${siswa.tempat_lahir || "-"}, ${siswa.tanggal_lahir || "-"}</td>
    </tr>
    <tr>
      <td class="label">Agama</td>
      <td class="colon">:</td>
      <td class="value">${siswa.agama || "Islam"}</td>
    </tr>
    <tr>
      <td class="label">Anak Ke / Jumlah Saudara</td>
      <td class="colon">:</td>
      <td class="value">Anak ke-${siswa.anak_ke || "-"} dari ${siswa.jumlah_saudara || "-"} bersaudara</td>
    </tr>
    <tr>
      <td class="label">Status Tinggal Bersama</td>
      <td class="colon">:</td>
      <td class="value">${siswa.tinggal_bersama || "Orang Tua / Pondok Pesantren"}</td>
    </tr>
    <tr>
      <td class="label">Alamat Lengkap Domisili</td>
      <td class="colon">:</td>
      <td class="value">${siswa.alamat_jalan || "-"} RT ${siswa.rt || "-"} RW ${siswa.rw || "-"}, Desa ${siswa.desa || "-"}, Kec. ${siswa.kecamatan || "-"}, ${siswa.kabupaten || "-"}, Prov. ${siswa.provinsi || "-"} (${siswa.kode_pos || "-"})</td>
    </tr>
    <tr>
      <td class="label">No. Telepon / WhatsApp</td>
      <td class="colon">:</td>
      <td class="value">${siswa.no_hp || "-"}</td>
    </tr>
  </table>

  <div class="section-title">B. Keterangan Pendidikan Sebelumnya</div>
  <table class="data-table">
    <tr>
      <td class="label">Sekolah / Madrasah Asal (SD/MI)</td>
      <td class="colon">:</td>
      <td class="value" style="font-weight: 600;">${siswa.asal_sekolah || "-"}</td>
    </tr>
    <tr>
      <td class="label">NPSN Sekolah Asal</td>
      <td class="colon">:</td>
      <td class="value">${siswa.npsn_sekolah_asal || "-"}</td>
    </tr>
    <tr>
      <td class="label">Tahun Masuk MTs</td>
      <td class="colon">:</td>
      <td class="value">${siswa.tahun_masuk || "-"} (Status Siswa: ${siswa.status.toUpperCase()})</td>
    </tr>
  </table>

  <div class="section-title">C. Keterangan Orang Tua / Wali Murid</div>
  <table class="grid-table">
    <thead>
      <tr>
        <th style="width: 25%;">Keterangan</th>
        <th style="width: 25%;">Ayah Kandung</th>
        <th style="width: 25%;">Ibu Kandung</th>
        <th style="width: 25%;">Wali Siswa</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 5px; font-weight: 600;">Nama Lengkap</td>
        <td style="padding: 5px; font-weight: 700;">${ayah?.nama_lengkap || "-"} (${ayah?.status || "hidup"})</td>
        <td style="padding: 5px; font-weight: 700;">${ibu?.nama_lengkap || "-"} (${ibu?.status || "hidup"})</td>
        <td style="padding: 5px; font-weight: 700;">${wali?.nama_lengkap ? `${wali.nama_lengkap} (${wali.keterangan_hubungan || "Wali"})` : "-"}</td>
      </tr>
      <tr>
        <td style="padding: 5px; font-weight: 600;">NIK</td>
        <td style="padding: 5px;">${nikAyahDecrypted || "-"}</td>
        <td style="padding: 5px;">${nikIbuDecrypted || "-"}</td>
        <td style="padding: 5px;">${nikWaliDecrypted || "-"}</td>
      </tr>
      <tr>
        <td style="padding: 5px; font-weight: 600;">Tempat, Tgl Lahir</td>
        <td style="padding: 5px;">${[ayah?.tempat_lahir, ayah?.tanggal_lahir].filter(Boolean).join(", ") || "-"}</td>
        <td style="padding: 5px;">${[ibu?.tempat_lahir, ibu?.tanggal_lahir].filter(Boolean).join(", ") || "-"}</td>
        <td style="padding: 5px;">${[wali?.tempat_lahir, wali?.tanggal_lahir].filter(Boolean).join(", ") || "-"}</td>
      </tr>
      <tr>
        <td style="padding: 5px; font-weight: 600;">Lulusan Pendidikan</td>
        <td style="padding: 5px;">${ayah?.pendidikan_terakhir || "-"}</td>
        <td style="padding: 5px;">${ibu?.pendidikan_terakhir || "-"}</td>
        <td style="padding: 5px;">${wali?.pendidikan_terakhir || "-"}</td>
      </tr>
      <tr>
        <td style="padding: 5px; font-weight: 600;">Pekerjaan Utama</td>
        <td style="padding: 5px;">${ayah?.pekerjaan || "-"}</td>
        <td style="padding: 5px;">${ibu?.pekerjaan || "-"}</td>
        <td style="padding: 5px;">${wali?.pekerjaan || "-"}</td>
      </tr>
      <tr>
        <td style="padding: 5px; font-weight: 600;">No. HP / WhatsApp</td>
        <td style="padding: 5px;">${ayah?.no_hp || "-"}</td>
        <td style="padding: 5px;">${ibu?.no_hp || "-"}</td>
        <td style="padding: 5px;">${wali?.no_hp || "-"}</td>
      </tr>
      <tr>
        <td style="padding: 5px; font-weight: 600;">Kartu Bantuan Sosial</td>
        <td colspan="3" style="padding: 5px;">${ibu?.kartu_bantuan || ayah?.kartu_bantuan || "Tidak Menerima Bantuan"}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">D. Catatan Riwayat Rombongan Belajar (Rombel)</div>
  <table class="grid-table">
    <thead>
      <tr>
        <th style="width: 8%;">No</th>
        <th style="width: 42%;">Tahun Ajaran & Semester</th>
        <th style="width: 25%;">Tingkat Kelas</th>
        <th style="width: 25%;">Nama Rombel</th>
      </tr>
    </thead>
    <tbody>
      ${riwayatKelasHtml}
    </tbody>
  </table>

  <table style="width: 100%; margin-top: 30px; border: none;">
    <tr>
      <td style="width: 50%; text-align: center; vertical-align: top;">
        <div>Mengetahui,</div>
        <div style="font-weight: bold;">Kepala MTs Roudhotut Thowalib</div>
        <div class="signature-space"></div>
        <div class="signature-name">${kepalaMadrasahName}</div>
        <div style="font-size: 8.5pt; color: #64748B;">NIP. ${kepalaMadrasahNip}</div>
      </td>
      <td style="width: 50%; text-align: center; vertical-align: top;">
        <div>Jombang, ${todayStr}</div>
        <div style="font-weight: bold;">Staf Tata Usaha / Wali Kelas</div>
        <div class="signature-space"></div>
        <div class="signature-name">Petugas Pendata</div>
        <div style="font-size: 8.5pt; color: #64748B;">NIP / NUPTK: -</div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
        dialogTitle: `Buku Induk - ${siswa.nama_lengkap}`,
      });
      return { success: true, message: "PDF Buku Induk Siswa berhasil dicetak dan siap dibagikan." };
    } else {
      return { success: true, message: `PDF tersimpan di perangkat: ${uri}` };
    }
  } catch (error: any) {
    return { success: false, message: error?.message || "Gagal mencetak dokumen PDF" };
  }
}

// 3. GENERATE FORM PRESENSI / ABSENSI KELAS PHYSICAL SHEET (PDF)
export async function generateAndShareAbsensiKelasPdf(
  data: AbsensiKelasPrintData
): Promise<{ success: boolean; message: string }> {
  const {
    kelasNama,
    tingkat,
    tahunAjaranNama,
    semesterNama,
    waliKelasName = "Belum Ditentukan",
    guruPengampuName,
    mapelNama,
    siswaList,
  } = data;

  const rowsHtml =
    siswaList.length === 0
      ? `<tr><td colspan="21" style="text-align: center; padding: 12px; color: #64748B;">Belum ada siswa terdaftar di rombel ini</td></tr>`
      : siswaList
          .map(
            (s, idx) => `
        <tr>
          <td style="text-align: center; padding: 4px; font-weight: bold;">${idx + 1}</td>
          <td style="text-align: center; padding: 4px; font-family: monospace;">${s.nis || "-"}</td>
          <td style="padding: 4px 6px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${s.namaLengkap}</td>
          <td style="text-align: center; padding: 4px; font-weight: bold;">${s.jenisKelamin}</td>
          ${Array(12).fill('<td style="width: 22px; border: 1px solid #CBD5E1;"></td>').join("")}
          <td style="width: 18px; border: 1px solid #CBD5E1;"></td>
          <td style="width: 18px; border: 1px solid #CBD5E1;"></td>
          <td style="width: 18px; border: 1px solid #CBD5E1;"></td>
          <td style="width: 18px; border: 1px solid #CBD5E1;"></td>
          <td style="width: 18px; border: 1px solid #CBD5E1;"></td>
        </tr>
      `
          )
          .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Presensi Kelas ${kelasNama}</title>
  <style>
    @page { size: landscape; margin: 12mm; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #0F172A;
      margin: 0;
      font-size: 8.5pt;
    }
    .header-table { width: 100%; border-bottom: 2px solid #047857; padding-bottom: 6px; margin-bottom: 8px; }
    .school-title { font-size: 13pt; font-weight: 900; color: #047857; text-transform: uppercase; }
    .doc-title { font-size: 10.5pt; font-weight: 800; color: #1E293B; }
    .meta-line { font-size: 8.5pt; color: #475569; }
    table.attendance-grid { width: 100%; border-collapse: collapse; margin-top: 8px; }
    table.attendance-grid th {
      background-color: #ECFDF5;
      color: #047857;
      border: 1px solid #94A3B8;
      padding: 4px 2px;
      font-size: 8pt;
      font-weight: 800;
      text-align: center;
    }
    table.attendance-grid td {
      border: 1px solid #CBD5E1;
      font-size: 8pt;
      height: 20px;
    }
    .sig-table { width: 100%; margin-top: 14px; font-size: 8.5pt; border: none; }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="vertical-align: top;">
        <div class="school-title">MTs Roudhotut Thowalib Jombang</div>
        <div class="doc-title">DAFTAR HADIR SISWA & PRESENSI KELAS FISIK</div>
      </td>
      <td style="text-align: right; vertical-align: top;">
        <div class="meta-line"><b>Kelas:</b> ${kelasNama} (Tingkat ${tingkat}) &nbsp;|&nbsp; <b>Semester:</b> ${semesterNama} ${tahunAjaranNama}</div>
        <div class="meta-line"><b>Wali Kelas:</b> ${waliKelasName} ${mapelNama ? `&nbsp;|&nbsp; <b>Mapel:</b> ${mapelNama} (${guruPengampuName || "-"})` : ""}</div>
      </td>
    </tr>
  </table>

  <table class="attendance-grid">
    <thead>
      <tr>
        <th rowspan="2" style="width: 25px;">No</th>
        <th rowspan="2" style="width: 55px;">NIS</th>
        <th rowspan="2" style="width: 145px; text-align: left; padding-left: 6px;">Nama Lengkap Siswa</th>
        <th rowspan="2" style="width: 25px;">L/P</th>
        <th colspan="12">Pertemuan / Tanggal</th>
        <th colspan="5">Rekapitulasi</th>
      </tr>
      <tr>
        ${Array(12).fill(0).map((_, i) => `<th style="width: 22px;">${i + 1}</th>`).join("")}
        <th style="width: 18px;">H</th>
        <th style="width: 18px;">S</th>
        <th style="width: 18px;">I</th>
        <th style="width: 18px;">A</th>
        <th style="width: 18px;">%</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <table class="sig-table">
    <tr>
      <td style="width: 50%; text-align: center;">
        <div>Mengetahui, Wali Kelas</div>
        <div style="height: 40px;"></div>
        <div style="font-weight: bold; text-decoration: underline;">${waliKelasName}</div>
      </td>
      <td style="width: 50%; text-align: center;">
        <div>Guru Pengampu / Piket Harian</div>
        <div style="height: 40px;"></div>
        <div style="font-weight: bold; text-decoration: underline;">${guruPengampuName || "................................................"}</div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
        dialogTitle: `Presensi Kelas ${kelasNama}`,
      });
      return { success: true, message: "PDF Form Presensi berhasil dicetak dan siap dibagikan." };
    } else {
      return { success: true, message: `PDF tersimpan di perangkat: ${uri}` };
    }
  } catch (error: any) {
    return { success: false, message: error?.message || "Gagal mencetak form presensi" };
  }
}

// 4. GENERATE SURAT KETERANGAN SISWA AKTIF (PDF)
export async function generateAndShareSuratKeteranganPdf(
  data: SuratKeteranganSiswaPrintData
): Promise<{ success: boolean; message: string }> {
  const {
    nomorSurat,
    tanggalSurat,
    siswa,
    tahunAjaranNama,
    semesterNama,
    keperluan,
    kepalaMadrasahName = "H. Ahmad Fauzi, S.Pd.I",
    kepalaMadrasahNip = "198005122005011003",
  } = data;

  const formatIdDate = (dStr?: string) => {
    if (!dStr) return "-";
    try {
      const parts = dStr.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]!, 10), parseInt(parts[1]!, 10) - 1, parseInt(parts[2]!, 10));
        return new Intl.DateTimeFormat("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(d);
      }
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(d);
    } catch {
      return dStr;
    }
  };

  const formattedTglSurat = formatIdDate(tanggalSurat);
  const formattedTglLahir = formatIdDate(siswa.tanggalLahir || undefined);

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 20mm 20mm 20mm;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #0F172A;
      margin: 0;
      padding: 0;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
    }
    .header-logo {
      width: 80px;
      text-align: center;
      vertical-align: middle;
    }
    .logo-box {
      width: 68px;
      height: 68px;
      background: #047857;
      color: #FFFFFF;
      border-radius: 50%;
      display: inline-block;
      line-height: 68px;
      font-size: 26px;
      font-weight: bold;
      text-align: center;
      border: 2px solid #D97706;
    }
    .header-text {
      text-align: center;
      vertical-align: middle;
    }
    .inst-yayasan {
      font-size: 11pt;
      font-weight: bold;
      letter-spacing: 0.5px;
      color: #0F172A;
      margin: 0;
    }
    .inst-name {
      font-size: 15pt;
      font-weight: 900;
      color: #047857;
      margin: 2px 0;
      letter-spacing: 1px;
    }
    .inst-status {
      font-size: 10pt;
      font-weight: bold;
      color: #D97706;
      margin: 1px 0;
    }
    .inst-meta {
      font-size: 9pt;
      color: #334155;
      margin: 1px 0;
    }
    .inst-address {
      font-size: 8.5pt;
      color: #475569;
      margin: 1px 0;
      font-style: italic;
    }
    .divider {
      border: none;
      border-top: 2.5px solid #047857;
      border-bottom: 1px solid #D97706;
      height: 4px;
      margin-top: 6px;
      margin-bottom: 24px;
    }
    .doc-title-box {
      text-align: center;
      margin-bottom: 24px;
    }
    .doc-title {
      font-size: 13pt;
      font-weight: bold;
      text-decoration: underline;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .doc-number {
      font-size: 10.5pt;
      font-weight: normal;
    }
    .opening-text {
      text-align: justify;
      text-indent: 36px;
      margin-bottom: 14px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-left: 20px;
      margin-right: 20px;
      margin-bottom: 16px;
    }
    .data-table td {
      padding: 3.5px 0;
      vertical-align: top;
      font-size: 11pt;
    }
    .data-table .label {
      width: 180px;
    }
    .data-table .colon {
      width: 18px;
      text-align: center;
    }
    .data-table .value {
      font-weight: bold;
    }
    .closing-text {
      text-align: justify;
      text-indent: 36px;
      margin-bottom: 12px;
    }
    .sig-section {
      width: 100%;
      margin-top: 36px;
    }
    .sig-table {
      width: 100%;
      border-collapse: collapse;
    }
    .sig-table td {
      vertical-align: top;
    }
    .sig-box {
      width: 250px;
      float: right;
      text-align: left;
    }
    .sig-space {
      height: 70px;
    }
    .sig-name {
      font-weight: bold;
      text-decoration: underline;
      font-size: 11pt;
    }
    .sig-nip {
      font-size: 10.5pt;
      color: #1E293B;
    }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td class="header-logo">
        <div class="logo-box">RTH</div>
      </td>
      <td class="header-text">
        <div class="inst-yayasan">YAYASAN PONDOK PESANTREN ROUDHOTUT THOWALIB</div>
        <div class="inst-name">MADRASAH TSANAWIYAH ROUDHOTUT THOWALIB</div>
        <div class="inst-status">STATUS TERAKREDITASI "A" (UNGGUL)</div>
        <div class="inst-meta">NSM: 121233080045 &nbsp;•&nbsp; NPSN: 20363210</div>
        <div class="inst-address">Alamat: Jl. Raya Tanjung Tirto No. 05, Tanjungsari, Kec. Windusari, Kab. Magelang 56152</div>
      </td>
    </tr>
  </table>

  <div class="divider"></div>

  <div class="doc-title-box">
    <div class="doc-title">SURAT KETERANGAN SISWA AKTIF</div>
    <div class="doc-number">Nomor : ${nomorSurat}</div>
  </div>

  <div class="opening-text">
    Yang bertanda tangan di bawah ini, Kepala Madrasah Tsanawiyah (MTs) Roudhotut Thowalib Windusari, Kabupaten Magelang, Provinsi Jawa Tengah, dengan ini menerangkan dengan sesungguhnya bahwa:
  </div>

  <table class="data-table">
    <tr>
      <td class="label">Nama Lengkap Siswa</td>
      <td class="colon">:</td>
      <td class="value">${siswa.namaLengkap.toUpperCase()}</td>
    </tr>
    <tr>
      <td class="label">Nomor Induk Siswa (NIS)</td>
      <td class="colon">:</td>
      <td class="value">${siswa.nis || "-"}</td>
    </tr>
    <tr>
      <td class="label">Nomor Induk Siswa Nasional (NISN)</td>
      <td class="colon">:</td>
      <td class="value">${siswa.nisn || "-"}</td>
    </tr>
    <tr>
      <td class="label">Tempat, Tanggal Lahir</td>
      <td class="colon">:</td>
      <td class="value">${siswa.tempatLahir || "-"}, ${formattedTglLahir}</td>
    </tr>
    <tr>
      <td class="label">Jenis Kelamin</td>
      <td class="colon">:</td>
      <td class="value">${siswa.jenisKelamin === "L" ? "Laki-laki" : "Perempuan"}</td>
    </tr>
    <tr>
      <td class="label">Kelas / Tingkat</td>
      <td class="colon">:</td>
      <td class="value">Kelas ${siswa.kelasNama} (Tingkat ${siswa.tingkat})</td>
    </tr>
    <tr>
      <td class="label">Nama Orang Tua / Wali</td>
      <td class="colon">:</td>
      <td class="value">${siswa.namaWali || "-"}</td>
    </tr>
    <tr>
      <td class="label">Alamat Lengkap</td>
      <td class="colon">:</td>
      <td class="value" style="font-weight: normal;">${siswa.alamat || "-"}</td>
    </tr>
  </table>

  <div class="closing-text">
    Adalah benar-benar siswa yang tercatat <b>AKTIF</b> mengikuti proses kegiatan belajar mengajar pada Semester <b>${semesterNama}</b> Tahun Ajaran <b>${tahunAjaranNama}</b> di Madrasah Tsanawiyah (MTs) Roudhotut Thowalib Windusari.
  </div>

  <div class="closing-text">
    Surat keterangan ini kami terbitkan atas permohonan yang bersangkutan sebagai kelengkapan administrasi untuk keperluan: <b>${keperluan}</b>.
  </div>

  <div class="closing-text">
    Demikian surat keterangan ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya oleh pihak yang berkepentingan.
  </div>

  <div class="sig-section">
    <table class="sig-table">
      <tr>
        <td style="width: 50%;"></td>
        <td style="width: 50%;">
          <div class="sig-box">
            <div>Windusari, ${formattedTglSurat}</div>
            <div>Kepala Madrasah,</div>
            <div class="sig-space"></div>
            <div class="sig-name">${kepalaMadrasahName}</div>
            <div class="sig-nip">NIP. ${kepalaMadrasahNip}</div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
        dialogTitle: `Surat Keterangan - ${siswa.namaLengkap}`,
      });
      return { success: true, message: "PDF Surat Keterangan Siswa Aktif berhasil dibuat dan siap dibagikan." };
    } else {
      return { success: true, message: `PDF tersimpan di perangkat: ${uri}` };
    }
  } catch (error: any) {
    return { success: false, message: error?.message || "Gagal mencetak surat keterangan" };
  }
}
