/**
 * Ключи комнаты для чата — порт веб-хука useCrypto:
 *  1. на устройстве есть пара ключей (иначе создаём и публикуем public_key);
 *  2. помним все публичные ключи партнёра (ротация: новый телефон/браузер);
 *  3. шифруем новейшим ключом, расшифровываем перебором всех.
 */
import { useEffect, useState } from 'react';

import { generateIdentityKeys, jwkFingerprint, type PublicJwk, type RoomKey, tryDeriveRoomKey } from '@/lib/crypto';
import { loadIdentity, loadPartnerPubs, saveIdentity, savePartnerPubs } from '@/lib/keystore';
import { supabase } from '@/lib/supabase';

export function useRoomKeys(userId: string | undefined, partnerId: string | null | undefined) {
  const [roomKey, setRoomKey] = useState<RoomKey | null>(null);
  const [roomKeys, setRoomKeys] = useState<RoomKey[]>([]);
  const [ready, setReady] = useState(false);

  const [version, setVersion] = useState(0); // +1 → пересчитать ключи

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        let identity = await loadIdentity(userId);
        if (!identity) {
          const { publicKeyJwk, privateKeyJwk } = generateIdentityKeys();
          await saveIdentity(userId, publicKeyJwk, privateKeyJwk);
          identity = { pub: publicKeyJwk, priv: privateKeyJwk };
        }
        const { data: me } = await supabase.from('profiles').select('public_key').eq('id', userId).single();
        if (me?.public_key !== JSON.stringify(identity.pub)) {
          // Публикуем ключ этого устройства (партнёр запомнит и старый — см. историю)
          await supabase.from('profiles').update({ public_key: JSON.stringify(identity.pub) }).eq('id', userId);
        }

        if (!partnerId) {
          if (!cancelled) { setRoomKey(null); setRoomKeys([]); }
          return;
        }

        const { data: partner } = await supabase.from('profiles').select('public_key').eq('id', partnerId).single();
        const history = await loadPartnerPubs(partnerId);
        let current: PublicJwk | null = null;
        try { current = partner?.public_key ? JSON.parse(partner.public_key) : null; } catch { current = null; }
        if (current) {
          const fp = jwkFingerprint(current);
          const next = [{ jwk: current, fp }, ...history.filter((h) => h.fp !== fp)];
          await savePartnerPubs(partnerId, next);
          history.splice(0, history.length, ...next);
        }
        const keys = history.map((h) => tryDeriveRoomKey(identity!.priv, h.jwk)).filter((k): k is RoomKey => !!k);
        if (!cancelled) { setRoomKey(keys[0] ?? null); setRoomKeys(keys); }
      } catch (e) {
        console.warn('[useRoomKeys]', e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, partnerId, version]);

  // Партнёр сменил ключ → пересчитываем
  useEffect(() => {
    if (!partnerId) return;
    const ch = supabase
      .channel(`crypto-partner-${partnerId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${partnerId}` },
        (p) => { if ((p.new as { public_key?: string }).public_key) setVersion((v) => v + 1); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partnerId]);

  return { roomKey, roomKeys, ready };
}
