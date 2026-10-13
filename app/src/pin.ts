import * as Crypto from 'expo-crypto';
import type { Hashed } from './types';

const digest = (salt: string, pin: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + pin);

export async function hashPin(pin: string): Promise<Hashed> {
  const salt = Crypto.randomUUID();
  return { salt, hash: await digest(salt, pin) };
}

export async function checkPin(pin: string, h?: Hashed) {
  return !!h && (await digest(h.salt, pin)) === h.hash;
}

export type PinResult = 'real' | 'duress' | 'wrong';

export async function classify(pin: string, real?: Hashed, duress?: Hashed): Promise<PinResult> {
  if (await checkPin(pin, real)) return 'real';
  if (await checkPin(pin, duress)) return 'duress';
  return 'wrong';
}
