import crypto from 'node:crypto';

// Opaque random tokens (invite links, parent device sessions) are stored only
// as a SHA-256 hash, so a database leak does not hand out working links.

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/** 6-digit numeric code, uniformly random (no modulo bias). */
export function sixDigitCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}
