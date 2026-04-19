/**
 * useCrypto — React hook for E2EE key lifecycle management.
 *
 * Responsibilities:
 *   1. Generate + persist identity key pair on first use
 *   2. Upload own public key to profiles.public_key
 *   3. Derive room key when partner's public key is available
 *   4. Expose { roomKey, isReady, error } to consumers
 *
 * roomKey is a non-extractable CryptoKey — it never leaves the JS heap.
 * Consumers encrypt/decrypt via crypto.js functions, passing roomKey.
 *
 * Phase-1 limitation:
 *   Private key stored as raw JWK in localStorage.
 *   Phase 2 should wrap it with a PIN/passphrase-derived key (PBKDF2).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  generateIdentityKeys,
  saveIdentityKeys,
  loadPublicKeyJwk,
  loadPrivateKeyJwk,
  hasLocalKeys,
  deriveRoomKeyFromJwks,
} from '../lib/crypto'

/**
 * @param {object} session  — Supabase session
 * @param {object} profile  — current user profile (needs partner_id)
 * @returns {{ roomKey: CryptoKey|null, isReady: boolean, cryptoError: string|null, refreshKeys: function }}
 */
export function useCrypto(session, profile) {
  const [roomKey,     setRoomKey]     = useState(null)
  const [isReady,     setIsReady]     = useState(false)
  const [cryptoError, setCryptoError] = useState(null)
  const initRef = useRef(false)

  const initKeys = useCallback(async () => {
    if (!session?.user?.id) return
    const uid = session.user.id
    const partnerId = profile?.partner_id

    setCryptoError(null)
    setIsReady(false)

    try {
      // ── 1. Ensure this device has an identity key pair ──────────────────
      if (!hasLocalKeys()) {
        const { publicKeyJwk, privateKeyJwk } = await generateIdentityKeys()
        saveIdentityKeys(publicKeyJwk, privateKeyJwk)

        // Upload public key to server (only the public key)
        await supabase.from('profiles')
          .update({ public_key: JSON.stringify(publicKeyJwk) })
          .eq('id', uid)
      } else {
        // Ensure server has our public key (in case it was cleared)
        const pubJwk = loadPublicKeyJwk()
        const { data: prof } = await supabase.from('profiles')
          .select('public_key').eq('id', uid).single()
        if (!prof?.public_key && pubJwk) {
          await supabase.from('profiles')
            .update({ public_key: JSON.stringify(pubJwk) })
            .eq('id', uid)
        }
      }

      // ── 2. Derive room key if partner is connected ───────────────────────
      if (!partnerId) {
        setIsReady(true)    // no partner yet — crypto ready but no room key
        return
      }

      const { data: partnerProf } = await supabase.from('profiles')
        .select('public_key').eq('id', partnerId).single()

      if (!partnerProf?.public_key) {
        // Partner hasn't set up E2EE yet — graceful degradation
        setIsReady(true)
        return
      }

      const myPrivJwk     = loadPrivateKeyJwk()
      const partnerPubJwk = JSON.parse(partnerProf.public_key)

      const key = await deriveRoomKeyFromJwks(myPrivJwk, partnerPubJwk)
      if (key) {
        setRoomKey(key)
      } else {
        setCryptoError('Не удалось вычислить ключ шифрования')
      }

      setIsReady(true)
    } catch (err) {
      console.error('[useCrypto]', err)
      setCryptoError('Ошибка инициализации шифрования')
      setIsReady(true)  // still allow app to work in plaintext mode
    }
  }, [session?.user?.id, profile?.partner_id])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    initKeys()
  }, [initKeys])

  // Re-init if partner changes (new connection)
  const prevPartnerRef = useRef(profile?.partner_id)
  useEffect(() => {
    if (prevPartnerRef.current !== profile?.partner_id) {
      prevPartnerRef.current = profile?.partner_id
      initRef.current = false
      initKeys()
    }
  }, [profile?.partner_id, initKeys])

  return { roomKey, isReady, cryptoError, refreshKeys: initKeys }
}
