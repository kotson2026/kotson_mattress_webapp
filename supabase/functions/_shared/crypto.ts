// PBKDF2 SHA-256 password verification and crypto utilities for Supabase Edge Functions

/**
 * Canonical representation for Indian mobile numbers: '+91' followed by 10 digits.
 */
export function normalizePhone(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91${digits.slice(2)}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return digits ? `+${digits}` : "";
}

export function extract10Digits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function maskPhone(phone: string): string {
  const d = extract10Digits(phone);
  if (d.length === 10) {
    return `+91******${d.slice(-4)}`;
  }
  return "+91******";
}

export function mintReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  const randomBytes = new Uint8Array(4);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < 4; i++) {
    suffix += chars[randomBytes[i] % chars.length];
  }
  return `KS${suffix}`;
}

/**
 * Verify legacy Python Passlib PBKDF2-SHA256 password hash.
 * Format: $pbkdf2-sha256$29000$<salt_b64>$<checksum_b64>
 */
export async function verifyLegacyPbkdf2(password: string, hashStr: string): Promise<boolean> {
  try {
    if (!hashStr || !hashStr.startsWith("$pbkdf2-sha256$")) {
      return false;
    }
    const parts = hashStr.split("$");
    if (parts.length < 5) return false;

    const rounds = parseInt(parts[2], 10);
    const rawSaltB64 = parts[3];
    const rawChecksumB64 = parts[4];

    // Pad base64 strings to multiple of 4
    const saltB64 = rawSaltB64.padEnd(rawSaltB64.length + (4 - (rawSaltB64.length % 4)) % 4, "=");
    const checksumB64 = rawChecksumB64.padEnd(rawChecksumB64.length + (4 - (rawChecksumB64.length % 4)) % 4, "=");

    const saltBinary = atob(saltB64);
    const salt = new Uint8Array(saltBinary.length);
    for (let i = 0; i < saltBinary.length; i++) {
      salt[i] = saltBinary.charCodeAt(i);
    }

    const checkBinary = atob(checksumB64);
    const expected = new Uint8Array(checkBinary.length);
    for (let i = 0; i < checkBinary.length; i++) {
      expected[i] = checkBinary.charCodeAt(i);
    }

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const derived = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: rounds,
        hash: "SHA-256",
      },
      key,
      expected.length * 8
    );

    const derivedArr = new Uint8Array(derived);
    if (derivedArr.length !== expected.length) return false;

    // Constant-time comparison
    let diff = 0;
    for (let i = 0; i < derivedArr.length; i++) {
      diff |= derivedArr[i] ^ expected[i];
    }
    return diff === 0;
  } catch (err) {
    console.error("PBKDF2 verification error:", err);
    return false;
  }
}
