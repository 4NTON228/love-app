/// <reference types="jest" />
/// <reference types="node" />
/**
 * Кросс-совместимость E2EE с веб-версией (src/lib/crypto.js).
 * Веб использует Web Crypto — здесь он доступен из Node (globalThis.crypto).
 */
import {
  decryptMessage,
  deriveRoomKey,
  encryptMessage,
  generateIdentityKeys,
  isEncryptedEnvelope,
  safeDecryptWithKeys,
  utf8Decode,
  utf8Encode,
} from '../crypto';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const web = require('../../../../src/lib/crypto.js');

beforeAll(() => {
  // веб-модуль проверяет window.crypto.subtle
  (globalThis as any).window = globalThis;
});

describe('mobile ↔ web E2EE', () => {
  test('room keys agree: mobile key pair + web key pair', async () => {
    const mobile = generateIdentityKeys();
    const webKeys = await web.generateIdentityKeys();

    const mobileRoom = deriveRoomKey(mobile.privateKeyJwk, webKeys.publicKeyJwk);
    const webRoom = await web.deriveRoomKeyFromJwks(webKeys.privateKeyJwk, mobile.publicKeyJwk);

    // mobile → web
    const env1 = encryptMessage('Привет с телефона ❤️', mobileRoom);
    expect(await web.decryptMessage(env1, webRoom)).toBe('Привет с телефона ❤️');

    // web → mobile
    const env2 = await web.encryptMessage('И тебе из браузера 🌹', webRoom);
    expect(decryptMessage(env2, mobileRoom)).toBe('И тебе из браузера 🌹');
  });

  test('envelope format matches web', () => {
    const a = generateIdentityKeys();
    const b = generateIdentityKeys();
    const env = encryptMessage('x', deriveRoomKey(a.privateKeyJwk, b.publicKeyJwk));
    const parsed = JSON.parse(env);
    expect(parsed.v).toBe(1);
    expect(parsed.alg).toBe('AESGCM256');
    expect(isEncryptedEnvelope(env)).toBe(true);
    expect(web.isEncryptedEnvelope(env)).toBe(true);
    expect(a.publicKeyJwk).toMatchObject({ kty: 'EC', crv: 'P-256' });
    expect(a.privateKeyJwk.d).toBeTruthy();
  });

  test('both sides derive the same key', () => {
    const a = generateIdentityKeys();
    const b = generateIdentityKeys();
    const kab = deriveRoomKey(a.privateKeyJwk, b.publicKeyJwk);
    const kba = deriveRoomKey(b.privateKeyJwk, a.publicKeyJwk);
    expect(Buffer.from(kab).toString('hex')).toBe(Buffer.from(kba).toString('hex'));
  });

  test('safeDecryptWithKeys tries all keys and never throws', () => {
    const a = generateIdentityKeys();
    const b = generateIdentityKeys();
    const c = generateIdentityKeys();
    const right = deriveRoomKey(a.privateKeyJwk, b.publicKeyJwk);
    const wrong = deriveRoomKey(a.privateKeyJwk, c.publicKeyJwk);
    const env = encryptMessage('секрет', right);
    expect(safeDecryptWithKeys(env, [wrong, right])).toEqual({ ok: true, text: 'секрет' });
    expect(safeDecryptWithKeys(env, [wrong])).toEqual({ ok: false, text: null });
    expect(safeDecryptWithKeys('not json', [right])).toEqual({ ok: false, text: null });
  });

  test('tampered ciphertext is rejected', () => {
    const a = generateIdentityKeys();
    const b = generateIdentityKeys();
    const k = deriveRoomKey(a.privateKeyJwk, b.publicKeyJwk);
    const env = JSON.parse(encryptMessage('hello', k));
    const ct = Buffer.from(env.ct, 'base64');
    ct[0] ^= 1;
    env.ct = ct.toString('base64');
    expect(safeDecryptWithKeys(JSON.stringify(env), [k]).ok).toBe(false);
  });
});

describe('utf8', () => {
  test('matches TextEncoder/TextDecoder', () => {
    for (const s of ['', 'abc', 'Привет', 'emoji ❤️🌹👩‍❤️‍👨', '中文', '\u0000￿']) {
      expect(Buffer.from(utf8Encode(s)).toString('hex')).toBe(Buffer.from(new TextEncoder().encode(s)).toString('hex'));
      expect(utf8Decode(new TextEncoder().encode(s))).toBe(s);
    }
  });
});
