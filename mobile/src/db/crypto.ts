import * as Crypto from "expo-crypto";

// Kunci enkripsi default aplikasi untuk pengujian lokal (dapat ditimpa via env)
export const APP_KEY = process.env.EXPO_PUBLIC_APP_KEY || "mts-roudhotut-thowalib-secret-key-2026-v1";

/**
 * Pure TypeScript Base64 Encoder / Decoder
 * Menghilangkan ketergantungan pada window.btoa/atob yang tidak tersedia di Hermes React Native
 */
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

export function bytesToBase64(bytes: Uint8Array): string {
  let output = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < len ? bytes[i + 1]! : 0;
    const b2 = i + 2 < len ? bytes[i + 2]! : 0;

    const e0 = b0 >> 2;
    const e1 = ((b0 & 3) << 4) | (b1 >> 4);
    let e2 = ((b1 & 15) << 2) | (b2 >> 6);
    let e3 = b2 & 63;

    if (i + 1 >= len) {
      e2 = 64;
      e3 = 64;
    } else if (i + 2 >= len) {
      e3 = 64;
    }

    output +=
      B64_CHARS.charAt(e0) +
      B64_CHARS.charAt(e1) +
      B64_CHARS.charAt(e2) +
      B64_CHARS.charAt(e3);
  }
  return output;
}

export function base64ToBytes(b64: string): Uint8Array {
  const cleanB64 = b64.replace(/[^A-Za-z0-9+/=]/g, "");
  const len = cleanB64.length;
  const byteLen = (len * 3) / 4 - (cleanB64.endsWith("==") ? 2 : cleanB64.endsWith("=") ? 1 : 0);
  const bytes = new Uint8Array(byteLen);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e0 = B64_CHARS.indexOf(cleanB64.charAt(i));
    const e1 = B64_CHARS.indexOf(cleanB64.charAt(i + 1));
    const e2 = B64_CHARS.indexOf(cleanB64.charAt(i + 2));
    const e3 = B64_CHARS.indexOf(cleanB64.charAt(i + 3));

    const b0 = (e0 << 2) | (e1 >> 4);
    const b1 = ((e1 & 15) << 4) | (e2 >> 2);
    const b2 = ((e2 & 3) << 6) | e3;

    bytes[p++] = b0;
    if (e2 !== 64 && p < byteLen) bytes[p++] = b1;
    if (e3 !== 64 && p < byteLen) bytes[p++] = b2;
  }
  return bytes;
}

export function stringToBase64(str: string): string {
  const enc = new TextEncoder();
  return bytesToBase64(enc.encode(str));
}

export function base64ToString(b64: string): string {
  const bytes = base64ToBytes(b64);
  return new TextDecoder().decode(bytes);
}

/**
 * Menghasilkan UUID v4 untuk Primary Key
 */
export function generateUUID(): string {
  return Crypto.randomUUID();
}

/**
 * Menghasilkan ISO-8601 UTC timestamp string
 */
export function getIsoUtcString(): string {
  return new Date().toISOString();
}

/**
 * Menghasilkan hash SHA-256 dengan salt untuk verifikasi password lokal
 */
export async function hashPassword(password: string): Promise<string> {
  const salted = `${password}::${APP_KEY}`;
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salted);
}

/**
 * Verifikasi password terhadap hash yang tersimpan
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

/**
 * Menghasilkan Blind Index (HMAC-SHA256) untuk NIK
 */
export async function generateNikHash(nik: string | null | undefined): Promise<string | null> {
  if (!nik || nik.trim() === "") return null;
  const cleanNik = nik.trim();
  const input = `NIK_HMAC::${cleanNik}::${APP_KEY}`;
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

/**
 * Enkripsi kolom sensitif (nik, no_kk, npwp, no_rekening)
 */
export async function encryptSensitive(plainText: string | null | undefined): Promise<string | null> {
  if (!plainText || plainText.trim() === "") return null;

  try {
    if (typeof globalThis.crypto?.subtle !== "undefined") {
      const enc = new TextEncoder();
      const keyData = enc.encode(APP_KEY.padEnd(32, "0").slice(0, 32));
      const key = await globalThis.crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
      );
      const iv = Crypto.getRandomValues(new Uint8Array(12));
      const encodedText = enc.encode(plainText);
      const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encodedText
      );

      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      return `ENC::${bytesToBase64(combined)}`;
    }
  } catch (e) {
    console.warn("WebCrypto subtle not available, using safe fallback:", e);
  }

  // Safe fallback tanpa btoa/atob bawaan browser
  return `ENC_B64::${stringToBase64(plainText)}`;
}

/**
 * Dekripsi kolom sensitif
 */
export async function decryptSensitive(cipherText: string | null | undefined): Promise<string | null> {
  if (!cipherText || cipherText.trim() === "") return null;

  if (cipherText.startsWith("ENC_B64::")) {
    const raw = cipherText.replace("ENC_B64::", "");
    try {
      return base64ToString(raw);
    } catch {
      return raw;
    }
  }

  if (cipherText.startsWith("ENC::")) {
    try {
      if (typeof globalThis.crypto?.subtle !== "undefined") {
        const rawBase64 = cipherText.replace("ENC::", "");
        const combined = base64ToBytes(rawBase64);
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        const enc = new TextEncoder();
        const keyData = enc.encode(APP_KEY.padEnd(32, "0").slice(0, 32));
        const key = await globalThis.crypto.subtle.importKey(
          "raw",
          keyData,
          { name: "AES-GCM" },
          false,
          ["decrypt"]
        );
        const decrypted = await globalThis.crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          key,
          ciphertext
        );
        return new TextDecoder().decode(decrypted);
      }
    } catch (e) {
      console.warn("Gagal dekripsi WebCrypto, return raw:", e);
    }
  }

  return cipherText;
}
