/**
 * Media pipeline utilities.
 *
 * Provides:
 *   compressImage      — resize + quality-reduce before upload
 *   createThumbnail    — small preview for list rendering
 *   encryptAndUpload   — compress → (optional) encrypt → upload to Supabase Storage
 *   downloadAndDecrypt — download encrypted blob → decrypt → return object URL
 *
 * All canvas operations are async to avoid blocking the main thread.
 * Object URLs returned by this module MUST be revoked by the caller when done.
 */

import { supabase } from './supabase'
import {
  generateFileKey,
  encryptFile,
  decryptFile,
  encryptFileKey,
  buildFileEncMeta,
} from './crypto'

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_FULL_W      = 1600  // px — max width/height for full image
const FULL_QUALITY    = 0.85  // JPEG quality for full image
const THUMB_W         = 320   // px — max width/height for thumbnail
const THUMB_QUALITY   = 0.75
const THUMB_SUFFIX    = '_thumb'

const ALLOWED_TYPES   = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_MB     = 10

// ── Validation ───────────────────────────────────────────────────────────────

export function validateImageFile(file) {
  if (!file) return 'Файл не выбран'
  if (!ALLOWED_TYPES.includes(file.type)) return 'Формат: JPEG, PNG, WebP, GIF'
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `Макс. размер: ${MAX_FILE_MB} МБ`
  return null
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

/**
 * Load a File / Blob into an HTMLImageElement.
 * Returns a Promise<HTMLImageElement>.
 */
function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

/**
 * Draw image to canvas at target dimensions and export as Blob.
 */
function canvasToBlob(img, maxDim, quality, type = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    let w = img.naturalWidth
    let h = img.naturalHeight
    if (w > maxDim || h > maxDim) {
      if (w > h) { h = Math.round((h / w) * maxDim); w = maxDim }
      else       { w = Math.round((w / h) * maxDim); h = maxDim }
    }
    const canvas = document.createElement('canvas')
    canvas.width  = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { reject(new Error('Canvas not available')); return }
    ctx.drawImage(img, 0, 0, w, h)
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), type, quality)
  })
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compress an image File.
 * Returns a Blob at reduced dimensions + quality.
 * GIFs are returned as-is (no canvas re-encode, would lose animation).
 */
export async function compressImage(file) {
  if (file.type === 'image/gif') return file   // preserve gif animation
  const img = await loadImage(file)
  return canvasToBlob(img, MAX_FULL_W, FULL_QUALITY)
}

/**
 * Create a small thumbnail Blob from a File.
 */
export async function createThumbnail(file) {
  if (file.type === 'image/gif') return file
  const img = await loadImage(file)
  return canvasToBlob(img, THUMB_W, THUMB_QUALITY)
}

/**
 * Compress, then optionally encrypt, then upload to Supabase Storage.
 *
 * @param {File}        file
 * @param {string}      basePath    — storage path without extension, e.g. "moments/abc"
 * @param {CryptoKey|null} roomKey  — if provided, encrypts before upload
 * @returns {{
 *   fullPath: string,
 *   thumbPath: string,
 *   publicUrl: string | null,        // null when encrypted
 *   thumbPublicUrl: string | null,
 *   encMeta: object | null,          // encryption metadata if encrypted
 *   thumbEncMeta: object | null,
 * }}
 */
export async function processAndUpload(file, basePath, roomKey = null) {
  const err = validateImageFile(file)
  if (err) throw new Error(err)

  const ext       = file.type === 'image/gif' ? 'gif' : 'jpg'
  const fullPath  = `${basePath}.${ext}`
  const thumbPath = `${basePath}${THUMB_SUFFIX}.${ext}`

  const [fullBlob, thumbBlob] = await Promise.all([
    compressImage(file),
    createThumbnail(file),
  ])

  if (roomKey) {
    // ── Encrypted upload ──────────────────────────────────────────────────
    const [fullBuf, thumbBuf] = await Promise.all([
      fullBlob.arrayBuffer(),
      thumbBlob.arrayBuffer(),
    ])

    const [fileKey, thumbKey] = await Promise.all([
      generateFileKey(),
      generateFileKey(),
    ])

    const [
      { encryptedBuffer: encFull,  iv: ivFull  },
      { encryptedBuffer: encThumb, iv: ivThumb },
    ] = await Promise.all([
      encryptFile(fullBuf, fileKey),
      encryptFile(thumbBuf, thumbKey),
    ])

    const [encFileKeyEnv, encThumbKeyEnv] = await Promise.all([
      encryptFileKey(fileKey, roomKey),
      encryptFileKey(thumbKey, roomKey),
    ])

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.storage.from('photos').upload(fullPath,  encFull,  { upsert: true, contentType: 'application/octet-stream' }),
      supabase.storage.from('photos').upload(thumbPath, encThumb, { upsert: true, contentType: 'application/octet-stream' }),
    ])
    if (e1) throw new Error(`Upload failed: ${e1.message}`)
    if (e2) throw new Error(`Thumb upload failed: ${e2.message}`)

    return {
      fullPath,
      thumbPath,
      publicUrl: null,
      thumbPublicUrl: null,
      encMeta: buildFileEncMeta({
        iv: ivFull, encryptedFileKeyEnvelope: encFileKeyEnv,
        mimeType: file.type, originalSize: fullBlob.size,
      }),
      thumbEncMeta: buildFileEncMeta({
        iv: ivThumb, encryptedFileKeyEnvelope: encThumbKeyEnv,
        mimeType: file.type, originalSize: thumbBlob.size,
      }),
    }
  }

  // ── Plaintext upload (legacy / no E2EE yet) ───────────────────────────────
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.storage.from('photos').upload(fullPath,  fullBlob,  { upsert: true, contentType: file.type }),
    supabase.storage.from('photos').upload(thumbPath, thumbBlob, { upsert: true, contentType: file.type }),
  ])
  if (e1) throw new Error(`Upload failed: ${e1.message}`)
  if (e2) throw new Error(`Thumb upload failed: ${e2.message}`)

  const publicUrl      = supabase.storage.from('photos').getPublicUrl(fullPath).data.publicUrl
  const thumbPublicUrl = supabase.storage.from('photos').getPublicUrl(thumbPath).data.publicUrl

  return { fullPath, thumbPath, publicUrl, thumbPublicUrl, encMeta: null, thumbEncMeta: null }
}

/**
 * Download an encrypted file from Supabase Storage, decrypt it, and return an object URL.
 * Caller MUST call URL.revokeObjectURL(url) when done to avoid memory leaks.
 *
 * @param {string}     storagePath
 * @param {object}     encMeta     — { iv, file_key_enc, mime }
 * @param {CryptoKey}  roomKey
 * @returns {Promise<string>}  object URL
 */
export async function downloadAndDecrypt(storagePath, encMeta, roomKey) {
  const { data, error } = await supabase.storage.from('photos').download(storagePath)
  if (error) throw new Error(`Download failed: ${error.message}`)

  const { decryptFileKey } = await import('./crypto')
  const fileKey = await decryptFileKey(encMeta.file_key_enc, roomKey)

  const encBuf = await data.arrayBuffer()

  let ivBytes
  if (typeof encMeta.iv === 'string') {
    const bin = atob(encMeta.iv)
    ivBytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) ivBytes[i] = bin.charCodeAt(i)
  } else {
    ivBytes = new Uint8Array(encMeta.iv)
  }

  const plainBuf = await decryptFile(encBuf, fileKey, ivBytes)
  const blob = new Blob([plainBuf], { type: encMeta.mime || 'image/jpeg' })
  return URL.createObjectURL(blob)
}
