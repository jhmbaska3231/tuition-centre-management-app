// backend/src/lib/crypto.ts
//
// aes-256-gcm for secrets that must be readable by the app (provider api keys)
// output layout: iv (12 bytes) | auth tag (16 bytes) | ciphertext

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from '../config';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export const encrypt = (plaintext: string): Buffer => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', config.crypto.encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
};

export const decrypt = (blob: Buffer): string => {
  const iv = blob.subarray(0, IV_LENGTH);
  const tag = blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = blob.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', config.crypto.encryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};