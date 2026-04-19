/**
 * E2EE crypto module — uses only Web Crypto API (SubtleCrypto).
 * No custom primitives. No third-party libraries.
 *
 * Scheme:
 *   Identity:   ECDH P-256 key pair per user
 *   Room key:   ECDH(my_private, partner_public) → HKDF-SHA-256 → AES-GCM-256
 *   Message:    AES-GCM-256 with random 12-byte IV per message
 *   File:       random AES-GCM-256 key per file, file key wrapped with room key
 *
 * Private key storage:
 *   Phase 1 scaffold: stored as JWK in localStorage under PRIV_KEY_KEY.
 *   TODO Phase 2: wrap private key with PBKDF2-derived key (require PIN/passphrase)
 *   and store wrapped blob — so even if localStorage is read the key is useless.
 *
 * Payload envelope (JSON, base64-encoded fields):
 *   { v: 1, alg: "AESGCM256", iv: "<b64>", ct: "<b64>" }
 *
 * Backward compatibility:
 *   Messages without is_encrypted=true are treated as legacy plaintext.
 *   Decryption failures surface a controlled error, never crash the UI.
 */

const ALGO_EC   = { name: 'ECDH', namedCurve: 'P-256' }
const ALGO_AES  = { name: 'AES-GCM', length: 256 }
const HKDF_INFO = new TextEncoder().encode('love-app-room-key-v1')
const PAYLOAD_V = 1
const PRIV_KEY_KEY  = 'e2ee_private_key_jwk'
const PUB_KEY_KEY   = 'e2ee_public_key_jwk'

// ── Utilities ────────────────────────────────────────────────────────────────

function b64encode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function b64decode(str) {
  const bin = atob(str)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr.buffer
}

function isAvailable() {
  return typeof window !== 'undefined' && !!window.crypto?.subtle
}

// ── Identity key management ──────────────────────────────────────────────────

/**
 * Generate a new ECDH P-256 identity key pair.
 * Returns { publicKeyJwk, privateKeyJwk } — raw JWK objects for storage.
 */
export async function generateIdentityKeys() {
  if (!isAvailable()) throw new Error('Web Crypto not available')
  const pair = await crypto.subtle.generateKey(ALGO_EC, true, ['deriveKey'])
  const publicKeyJwk  = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return { publicKeyJwk, privateKeyJwk }
}

/** Persist identity keys to localStorage (private key — phase-1 unprotected). */
export function saveIdentityKeys(publicKeyJwk, privateKeyJwk) {
  localStorage.setItem(PUB_KEY_KEY, JSON.stringify(publicKeyJwk))
  localStorage.setItem(PRIV_KEY_KEY, JSON.stringify(privateKeyJwk))
}

/** Load public key JWK from localStorage. */
export function loadPublicKeyJwk() {
  try {
    const raw = localStorage.getItem(PUB_KEY_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/** Load private key JWK from localStorage. */
export function loadPrivateKeyJwk() {
  try {
    const raw = localStorage.getItem(PRIV_KEY_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/** Check whether this device has an identity key pair. */
export function hasLocalKeys() {
  return !!(localStorage.getItem(PUB_KEY_KEY) && localStorage.getItem(PRIV_KEY_KEY))
}

/** Clear local keys (e.g. on sign-out). */
export function clearLocalKeys() {
  localStorage.removeItem(PUB_KEY_KEY)
  localStorage.removeItem(PRIV_KEY_KEY)
}

/**
 * Import a public key JWK (from partner's profile.public_key) into CryptoKey.
 * Use for ECDH derivation.
 */
export async function importPublicKey(jwk) {
  if (!isAvailable()) throw new Error('Web Crypto not available')
  return crypto.subtle.importKey('jwk', jwk, ALGO_EC, false, [])
}

/**
 * Import own private key JWK into CryptoKey.
 */
export async function importPrivateKey(jwk) {
  if (!isAvailable()) throw new Error('Web Crypto not available')
  return crypto.subtle.importKey('jwk', jwk, ALGO_EC, false, ['deriveKey'])
}

// ── Room key derivation ──────────────────────────────────────────────────────

/**
 * Derive a shared AES-GCM-256 room key from own private key + partner public key.
 * Uses ECDH → HKDF-SHA-256 → AES-GCM 256.
 * Both sides derive the SAME key deterministically.
 */
export async function deriveRoomKey(myPrivateKey, partnerPublicKey) {
  if (!isAvailable()) throw new Error('Web Crypto not available')

  const ecdhShared = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: partnerPublicKey },
    myPrivateKey,
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  )

  const roomKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32), // zero salt — deterministic, both sides agree
      info: HKDF_INFO,
    },
    ecdhShared,
    ALGO_AES,
    false,
    ['encrypt', 'decrypt'],
  )

  return roomKey
}

/**
 * Convenience: derive room key from stored JWKs.
 * Returns null if keys missing or Web Crypto unavailable.
 */
export async function deriveRoomKeyFromJwks(myPrivateJwk, partnerPublicJwk) {
  try {
    const myPriv = await importPrivateKey(myPrivateJwk)
    const partPub = await importPublicKey(partnerPublicJwk)
    return deriveRoomKey(myPriv, partPub)
  } catch (_e) {
    return null
  }
}

// ── Message encryption ───────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string with the room key.
 * Returns a JSON-safe envelope string.
 *
 * Envelope: { v, alg, iv, ct }
 */
export async function encryptMessage(plaintext, roomKey) {
  if (!isAvailable()) throw new Error('Web Crypto not available')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, roomKey, encoded)
  return JSON.stringify({
    v: PAYLOAD_V,
    alg: 'AESGCM256',
    iv: b64encode(iv),
    ct: b64encode(ct),
  })
}

/**
 * Decrypt an envelope string with the room key.
 * Returns plaintext string, or throws on failure.
 */
export async function decryptMessage(envelope, roomKey) {
  if (!isAvailable()) throw new Error('Web Crypto not available')
  const { v, alg, iv, ct } = JSON.parse(envelope)
  if (v !== PAYLOAD_V || alg !== 'AESGCM256') throw new Error('Unknown envelope version')
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(iv) },
    roomKey,
    b64decode(ct),
  )
  return new TextDecoder().decode(plain)
}

/**
 * Safe decrypt — returns { ok, text } instead of throwing.
 * UI should never crash on decryption failure.
 */
export async function safeDecryptMessage(envelope, roomKey) {
  try {
    const text = await decryptMessage(envelope, roomKey)
    return { ok: true, text }
  } catch (_e) {
    return { ok: false, text: null }
  }
}

// ── File / photo encryption ──────────────────────────────────────────────────

/**
 * Generate a random per-file AES-GCM-256 key.
 */
export async function generateFileKey() {
  if (!isAvailable()) throw new Error('Web Crypto not available')
  return crypto.subtle.generateKey(ALGO_AES, true, ['encrypt', 'decrypt'])
}

/**
 * Encrypt raw file bytes (ArrayBuffer) with a file key.
 * Returns { encryptedBuffer, iv } where iv is Uint8Array.
 */
export async function encryptFile(fileBuffer, fileKey) {
  if (!isAvailable()) throw new Error('Web Crypto not available')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, fileKey, fileBuffer)
  return { encryptedBuffer: ct, iv }
}

/**
 * Decrypt raw encrypted bytes (ArrayBuffer) with a file key.
 */
export async function decryptFile(encryptedBuffer, fileKey, iv) {
  if (!isAvailable()) throw new Error('Web Crypto not available')
  const ivArr = iv instanceof Uint8Array ? iv : new Uint8Array(iv)
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivArr }, fileKey, encryptedBuffer)
}

/**
 * Wrap a file key with the room key so it can be stored in message metadata.
 * Returns an envelope string (same format as message envelope).
 */
export async function encryptFileKey(fileKey, roomKey) {
  const exported = await crypto.subtle.exportKey('raw', fileKey)
  return encryptMessage(b64encode(exported), roomKey)
}

/**
 * Unwrap a file key envelope using the room key.
 * Returns a CryptoKey.
 */
export async function decryptFileKey(envelope, roomKey) {
  if (!isAvailable()) throw new Error('Web Crypto not available')
  const { ok, text } = await safeDecryptMessage(envelope, roomKey)
  if (!ok) throw new Error('Failed to decrypt file key')
  const raw = b64decode(text)
  return crypto.subtle.importKey('raw', raw, ALGO_AES, false, ['encrypt', 'decrypt'])
}

/**
 * Build encryption metadata object to store alongside an encrypted file.
 */
export function buildFileEncMeta({ iv, encryptedFileKeyEnvelope, mimeType, originalSize, algVersion = 1 }) {
  return {
    v: algVersion,
    alg: 'AESGCM256',
    iv: iv instanceof Uint8Array ? b64encode(iv) : iv,
    file_key_enc: encryptedFileKeyEnvelope,
    mime: mimeType,
    size: originalSize,
  }
}

// ── Versioned payload helpers ─────────────────────────────────────────────────

/**
 * Check if a string looks like an E2EE envelope (v1).
 * Used to distinguish legacy plaintext from encrypted ciphertext.
 */
export function isEncryptedEnvelope(str) {
  if (!str || typeof str !== 'string') return false
  try {
    const p = JSON.parse(str)
    return p.v === PAYLOAD_V && p.alg === 'AESGCM256' && !!p.iv && !!p.ct
  } catch { return false }
}

/**
 * Determine if a message record is E2EE encrypted.
 * Checks both the DB flag and payload shape (belt-and-suspenders).
 */
export function isMessageEncrypted(msg) {
  return !!msg.is_encrypted || isEncryptedEnvelope(msg.ciphertext)
}
