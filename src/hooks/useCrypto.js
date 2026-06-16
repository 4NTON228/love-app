/**
 * useCrypto — React hook for E2EE key lifecycle management.
 *
 * Responsibilities:
 *   1. Generate + persist identity key pair on first use
 *   2. Upload own public key to profiles.public_key
 *   3. Derive room key(s) from the partner's public key(s)
 *   4. Expose { roomKey, roomKeys, isReady, error } to consumers
 *
 * Key rotation resilience:
 *   Either partner may regenerate their identity keys (cleared storage,
 *   reinstall, new device). When that happens the shared room key changes
 *   and messages encrypted with the previous key would otherwise become
 *   undecryptable. To survive this we:
 *     - keep a HISTORY of every partner public key we've ever seen
 *       (persisted in localStorage),
 *     - derive a room key from each one,
 *     - try all of them when decrypting (newest first),
 *     - always ENCRYPT with the newest key,
 *     - re-derive live via a realtime subscription when the partner
 *       publishes a new public key.
 *
 * roomKey / roomKeys are non-extractable CryptoKeys — they never leave the heap.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  generateIdentityKeys,
  saveIdentityKeys,
  loadPublicKeyJwk,
  loadPrivateKeyJwk,
  hasLocalKeys,
  deriveRoomKeyFromJwks,
} from '../lib/crypto'

const PARTNER_PUBS_PREFIX = 'e2ee_partner_pubs_'

function jwkFingerprint(jwk) {
  // EC P-256 public JWK is uniquely identified by its x/y coordinates
  return `${jwk?.x || ''}.${jwk?.y || ''}`
}

function loadPartnerPubHistory(partnerId) {
  try {
    const raw = localStorage.getItem(PARTNER_PUBS_PREFIX + partnerId)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function savePartnerPubHistory(partnerId, list) {
  try {
    localStorage.setItem(PARTNER_PUBS_PREFIX + partnerId, JSON.stringify(list))
  } catch { /* ignore quota errors */ }
}

/**
 * @param {object} session  — Supabase session
 * @param {object} profile  — current user profile (needs partner_id)
 * @returns {{ roomKey, roomKeys, isReady, cryptoError, refreshKeys }}
 */
export function useCrypto(session, profile) {
  const [roomKey,     setRoomKey]     = useState(null)   // newest key — used to ENCRYPT
  const [roomKeys,    setRoomKeys]    = useState([])     // all candidate keys — used to DECRYPT
  const [isReady,     setIsReady]     = useState(false)
  const [cryptoError, setCryptoError] = useState(null)

  const initKeys = useCallback(async () => {
    if (!session?.user?.id) return
    const uid = session.user.id
    const partnerId = profile?.partner_id

    setCryptoError(null)

    try {
      // ── 1. Ensure this device has an identity key pair ──────────────────
      if (!hasLocalKeys()) {
        const { publicKeyJwk, privateKeyJwk } = await generateIdentityKeys()
        saveIdentityKeys(publicKeyJwk, privateKeyJwk)
        await supabase.from('profiles')
          .update({ public_key: JSON.stringify(publicKeyJwk) })
          .eq('id', uid)
      } else {
        const pubJwk = loadPublicKeyJwk()
        const { data: prof } = await supabase.from('profiles')
          .select('public_key').eq('id', uid).single()
        if (!prof?.public_key && pubJwk) {
          await supabase.from('profiles')
            .update({ public_key: JSON.stringify(pubJwk) })
            .eq('id', uid)
        }
      }

      // ── 2. No partner yet — crypto ready, no room key ───────────────────
      if (!partnerId) {
        setRoomKey(null)
        setRoomKeys([])
        setIsReady(true)
        return
      }

      const { data: partnerProf } = await supabase.from('profiles')
        .select('public_key').eq('id', partnerId).single()

      const myPrivJwk = loadPrivateKeyJwk()

      // ── 3. Build/refresh the partner public-key history ─────────────────
      const history = loadPartnerPubHistory(partnerId)   // [{ jwk, fp }, ...] newest first
      let currentJwk = null
      if (partnerProf?.public_key) {
        try { currentJwk = JSON.parse(partnerProf.public_key) } catch { currentJwk = null }
      }
      if (currentJwk) {
        const fp = jwkFingerprint(currentJwk)
        const without = history.filter(h => h.fp !== fp)
        history.length = 0
        history.push({ jwk: currentJwk, fp }, ...without)   // newest first
        savePartnerPubHistory(partnerId, history)
      }

      if (!history.length) {
        // Partner hasn't published a key yet — graceful degradation
        setRoomKey(null)
        setRoomKeys([])
        setIsReady(true)
        return
      }

      // ── 4. Derive a room key from each historical partner public key ────
      const derived = []
      for (const entry of history) {
        const k = await deriveRoomKeyFromJwks(myPrivJwk, entry.jwk)
        if (k) derived.push(k)
      }

      if (!derived.length) {
        setCryptoError('Не удалось вычислить ключ шифрования')
      } else {
        setRoomKey(derived[0])     // newest = encrypt with this
        setRoomKeys(derived)       // try all when decrypting
      }
      setIsReady(true)
    } catch (err) {
      console.error('[useCrypto]', err)
      setCryptoError('Ошибка инициализации шифрования')
      setIsReady(true)  // still allow app to work in plaintext mode
    }
  }, [session?.user?.id, profile?.partner_id])

  useEffect(() => { initKeys() }, [initKeys])

  // Re-derive live when the partner publishes a new public key (key rotation)
  useEffect(() => {
    const partnerId = profile?.partner_id
    if (!partnerId) return
    const ch = supabase
      .channel(`crypto-partner-${partnerId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${partnerId}` },
        payload => { if (payload.new?.public_key) initKeys() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.partner_id, initKeys])

  return { roomKey, roomKeys, isReady, cryptoError, refreshKeys: initKeys }
}
