/**
 * E2EE — та же схема, что в веб-версии (src/lib/crypto.js), но без Web Crypto
 * (в React Native его нет). Аудированные библиотеки @noble:
 *
 *   Identity:  ECDH P-256, ключи в формате JWK (как в вебе → profiles.public_key)
 *   Room key:  ECDH(my_private, partner_public).x → HKDF-SHA-256(salt=0³², info) → 32 байта
 *   Message:   AES-GCM-256, случайный 12-байтный IV
 *   Envelope:  { v: 1, alg: "AESGCM256", iv: "<b64>", ct: "<b64>" }
 *
 * Совместимость с вебом проверяется тестом src/lib/__tests__/crypto.test.ts.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { p256 } from '@noble/curves/nist.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';

export type PublicJwk = { kty: 'EC'; crv: 'P-256'; x: string; y: string; ext?: boolean; key_ops?: string[] };
export type PrivateJwk = PublicJwk & { d: string };
export type RoomKey = Uint8Array;

// ── UTF-8 (без TextEncoder/TextDecoder — их может не быть в Hermes) ─────────
export function utf8Encode(str: string): Uint8Array {
  const out: number[] = [];
  for (const ch of str) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else { out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
  }
  return Uint8Array.from(out);
}

export function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i++];
    let c: number;
    if (b < 0x80) c = b;
    else if (b < 0xe0) c = ((b & 31) << 6) | (bytes[i++] & 63);
    else if (b < 0xf0) c = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    else c = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    out += String.fromCodePoint(c);
  }
  return out;
}

const HKDF_INFO = utf8Encode('love-app-room-key-v1');
const ZERO_SALT = new Uint8Array(32);
const PAYLOAD_V = 1;

// ── base64 / base64url ──────────────────────────────────────────────────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

function b64decode(str: string): Uint8Array {
  const clean = str.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buf = 0, bits = 0, j = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('Invalid base64');
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j++] = (buf >> bits) & 0xff;
    }
  }
  return out.subarray(0, j);
}

const b64url = (bytes: Uint8Array) => b64encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ── Identity keys ───────────────────────────────────────────────────────────
export function generateIdentityKeys(): { publicKeyJwk: PublicJwk; privateKeyJwk: PrivateJwk } {
  const secret = p256.utils.randomSecretKey();
  const pub = p256.getPublicKey(secret, false); // 0x04 || x || y
  const publicKeyJwk: PublicJwk = {
    kty: 'EC', crv: 'P-256',
    x: b64url(pub.subarray(1, 33)),
    y: b64url(pub.subarray(33, 65)),
    ext: true, key_ops: [],
  };
  return { publicKeyJwk, privateKeyJwk: { ...publicKeyJwk, d: b64url(secret), key_ops: ['deriveKey'] } };
}

function publicPoint(jwk: PublicJwk): Uint8Array {
  const x = b64decode(jwk.x), y = b64decode(jwk.y);
  if (x.length !== 32 || y.length !== 32) throw new Error('Bad P-256 JWK');
  const out = new Uint8Array(65);
  out[0] = 4; out.set(x, 1); out.set(y, 33);
  return out;
}

/** Общий ключ комнаты — побайтово тот же, что получает веб через Web Crypto. */
export function deriveRoomKey(myPrivateJwk: PrivateJwk, partnerPublicJwk: PublicJwk): RoomKey {
  // Web Crypto ECDH отдаёт x-координату общей точки
  const shared = p256.getSharedSecret(b64decode(myPrivateJwk.d), publicPoint(partnerPublicJwk), true).subarray(1);
  return hkdf(sha256, shared, ZERO_SALT, HKDF_INFO, 32);
}

export function tryDeriveRoomKey(myPrivateJwk: PrivateJwk | null, partnerPublicJwk: PublicJwk | null): RoomKey | null {
  if (!myPrivateJwk || !partnerPublicJwk) return null;
  try { return deriveRoomKey(myPrivateJwk, partnerPublicJwk); } catch { return null; }
}

// ── Messages ────────────────────────────────────────────────────────────────
export function encryptMessage(plaintext: string, roomKey: RoomKey): string {
  const iv = randomBytes(12);
  const ct = gcm(roomKey, iv).encrypt(utf8Encode(plaintext)); // ct || tag, как в Web Crypto
  return JSON.stringify({ v: PAYLOAD_V, alg: 'AESGCM256', iv: b64encode(iv), ct: b64encode(ct) });
}

export function decryptMessage(envelope: string, roomKey: RoomKey): string {
  const { v, alg, iv, ct } = JSON.parse(envelope);
  if (v !== PAYLOAD_V || alg !== 'AESGCM256') throw new Error('Unknown envelope version');
  return utf8Decode(gcm(roomKey, b64decode(iv)).decrypt(b64decode(ct)));
}

/** Пробует все ключи (ротация ключей партнёра), никогда не бросает. */
export function safeDecryptWithKeys(envelope: string, roomKeys: RoomKey[]): { ok: boolean; text: string | null } {
  for (const key of roomKeys) {
    try { return { ok: true, text: decryptMessage(envelope, key) }; } catch { /* next key */ }
  }
  return { ok: false, text: null };
}

export function isEncryptedEnvelope(str: unknown): boolean {
  if (!str || typeof str !== 'string') return false;
  try {
    const p = JSON.parse(str);
    return p.v === PAYLOAD_V && p.alg === 'AESGCM256' && !!p.iv && !!p.ct;
  } catch { return false; }
}

export function jwkFingerprint(jwk: PublicJwk | null | undefined): string {
  return `${jwk?.x ?? ''}.${jwk?.y ?? ''}`;
}
