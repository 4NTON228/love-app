/**
 * Shared app helpers — import where needed.
 * Keep this file free of React imports (pure JS utilities).
 */
import { supabase } from './supabase'

// ── File upload ──────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE_MB = 10

/**
 * Validate an image File before upload.
 * Returns null if valid, or an error string.
 */
export function validateImageFile(file) {
  if (!file) return 'Файл не выбран'
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Допустимые форматы: JPEG, PNG, WebP, GIF'
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `Размер файла не должен превышать ${MAX_FILE_SIZE_MB} МБ`
  }
  return null
}

/**
 * Upload a file to Supabase Storage and return the public URL.
 * Throws on error.
 */
export async function uploadPhoto(file, path) {
  const err = validateImageFile(file)
  if (err) throw new Error(err)

  const { error: upErr } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
  if (upErr) throw new Error(`Ошибка загрузки: ${upErr.message}`)

  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}

// ── Supabase error handling ──────────────────────────────────────

const PG_ERROR_MESSAGES = {
  '23505': 'Такая запись уже существует',
  '23503': 'Связанная запись не найдена',
  '42501': 'Нет прав для этого действия',
  PGRST116: 'Запись не найдена',
}

/**
 * Convert a Supabase/PostgREST error into a human-readable Russian string.
 */
export function humanizeError(error) {
  if (!error) return null
  const code = error.code ?? ''
  if (PG_ERROR_MESSAGES[code]) return PG_ERROR_MESSAGES[code]
  if (error.message?.includes('JWT')) return 'Сессия истекла, войди снова'
  if (error.message?.includes('network')) return 'Нет соединения, проверь интернет'
  return error.message ?? 'Неизвестная ошибка'
}

// ── Toast (lightweight, no external deps) ───────────────────────
// Usage: import { toast } from '../lib/helpers'
//        toast.success('Сохранено!')  /  toast.error('Ошибка')

let _toastContainer = null

function getContainer() {
  if (_toastContainer) return _toastContainer
  _toastContainer = document.createElement('div')
  Object.assign(_toastContainer.style, {
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '99999',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'center',
    pointerEvents: 'none',
  })
  document.body.appendChild(_toastContainer)
  return _toastContainer
}

function showToast(message, type = 'info') {
  const container = getContainer()
  const el = document.createElement('div')
  const BG = { success: '#22c55e', error: '#ef4444', info: '#C8334A' }
  Object.assign(el.style, {
    background: BG[type] ?? BG.info,
    color: 'white',
    padding: '10px 20px',
    borderRadius: '14px',
    fontSize: '14px',
    fontFamily: 'var(--font-body, sans-serif)',
    fontWeight: '500',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    opacity: '0',
    transition: 'opacity 0.2s ease',
    whiteSpace: 'nowrap',
    maxWidth: '80vw',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  })
  el.textContent = message
  container.appendChild(el)
  requestAnimationFrame(() => { el.style.opacity = '1' })
  setTimeout(() => {
    el.style.opacity = '0'
    setTimeout(() => { container.removeChild(el) }, 200)
  }, 3000)
}

export const toast = {
  success: (msg) => showToast(msg, 'success'),
  error: (msg) => showToast(msg, 'error'),
  info: (msg) => showToast(msg, 'info'),
}

// ── Profile & couple helpers ─────────────────────────────────────

/**
 * Fetch the current user's profile. Returns null on error.
 */
export async function getCurrentProfile(userId) {
  if (!userId) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data ?? null
}

/**
 * Ensure user is authenticated. Throws if not.
 */
export async function requireUser() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Не авторизован')
  return session.user
}

/**
 * Build a Supabase query filtered to the current couple (uid + pid).
 * Returns the query with .in() or .eq() applied.
 */
export function filterByPair(query, uid, pid) {
  if (!uid) return query
  const ids = [uid, pid].filter(Boolean)
  return ids.length === 1 ? query.eq('user_id', ids[0]) : query.in('user_id', ids)
}

// ── URL helpers ──────────────────────────────────────────────────

/**
 * Safely revoke an object URL. No-op if url is null/undefined.
 */
export function revokeObjectUrl(url) {
  if (url && url.startsWith('blob:')) {
    try { URL.revokeObjectURL(url) } catch (_) {}
  }
}
