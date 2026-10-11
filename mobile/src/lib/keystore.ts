// Ключи E2EE на устройстве: приватный — в Keychain/Keystore (SecureStore),
// история публичных ключей партнёра — в AsyncStorage (это не секрет).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import type { PrivateJwk, PublicJwk } from './crypto';

const PRIV = 'e2ee_private_key_jwk';
const PUB = 'e2ee_public_key_jwk';
const PARTNER_PUBS = 'e2ee_partner_pubs_';
const SECURE = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

// Ключи привязаны к аккаунту: выход не стирает их, чтобы после повторного
// входа старая переписка оставалась читаемой.
export async function loadIdentity(uid: string): Promise<{ pub: PublicJwk; priv: PrivateJwk } | null> {
  const [pub, priv] = await Promise.all([
    SecureStore.getItemAsync(`${PUB}_${uid}`, SECURE),
    SecureStore.getItemAsync(`${PRIV}_${uid}`, SECURE),
  ]);
  if (!pub || !priv) return null;
  try { return { pub: JSON.parse(pub), priv: JSON.parse(priv) }; } catch { return null; }
}

export async function saveIdentity(uid: string, pub: PublicJwk, priv: PrivateJwk) {
  await SecureStore.setItemAsync(`${PUB}_${uid}`, JSON.stringify(pub), SECURE);
  await SecureStore.setItemAsync(`${PRIV}_${uid}`, JSON.stringify(priv), SECURE);
}

/** При удалении аккаунта. */
export async function clearIdentity(uid: string) {
  await Promise.all([
    SecureStore.deleteItemAsync(`${PUB}_${uid}`, SECURE),
    SecureStore.deleteItemAsync(`${PRIV}_${uid}`, SECURE),
  ]);
}

export type PartnerPub = { jwk: PublicJwk; fp: string };

export async function loadPartnerPubs(partnerId: string): Promise<PartnerPub[]> {
  try {
    const arr = JSON.parse((await AsyncStorage.getItem(PARTNER_PUBS + partnerId)) ?? '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export async function savePartnerPubs(partnerId: string, list: PartnerPub[]) {
  await AsyncStorage.setItem(PARTNER_PUBS + partnerId, JSON.stringify(list.slice(0, 10)));
}
