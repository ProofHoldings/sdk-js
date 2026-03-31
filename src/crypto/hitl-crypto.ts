/**
 * HITL End-to-End Encryption — Crypto Module
 *
 * Implements the envelope spec from docs/ENCRYPTION_ENVELOPE.md.
 * Uses Node.js crypto module (works in Node.js 18+).
 *
 * Two modes:
 * - Encrypt-only: agent has public key, encrypts messages for the approver
 * - Encrypt+decrypt: approver has password, decrypts messages in browser
 */
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENVELOPE_VERSION = 1;
const MESSAGE_ALG = 'RSA-OAEP-256+AES-256-GCM' as const;
const PRIVATE_KEY_ALG = 'PBKDF2-SHA256+AES-256-GCM' as const;
const AES_KEY_BYTES = 32;
const AES_IV_BYTES = 12;
const AES_TAG_BYTES = 16;
const RSA_EK_BYTES = 512; // 4096-bit RSA
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_KEY_BYTES = 32;
const KID_HEX_LENGTH = 64;
const MIN_RSA_MODULUS_BITS = 4096;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CiphertextEnvelope {
  v: 1;
  alg: typeof MESSAGE_ALG;
  ek: string;  // base64url
  iv: string;  // base64url
  ct: string;  // base64url
  tag: string; // base64url
  kid: string; // hex
}

export interface EncryptedPrivateKey {
  v: 1;
  alg: typeof PRIVATE_KEY_ALG;
  iv: string;   // base64url
  ct: string;   // base64url
  tag: string;  // base64url
  salt: string; // base64url
  kid: string;  // hex
}

export interface HitlKeyPair {
  publicKeyPem: string;
  encryptedPrivateKey: EncryptedPrivateKey;
  kid: string;
}

// ---------------------------------------------------------------------------
// Base64url helpers
// ---------------------------------------------------------------------------

function toBase64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function fromBase64url(str: string): Buffer {
  return Buffer.from(str, 'base64url');
}

// ---------------------------------------------------------------------------
// Key Identifier
// ---------------------------------------------------------------------------

/** Compute kid = lowercase_hex(SHA-256(DER-encoded SPKI public key bytes)) */
export function computeKid(publicKeyPem: string): string {
  const keyObject = crypto.createPublicKey(publicKeyPem);
  const der = keyObject.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex');
}

// ---------------------------------------------------------------------------
// RSA Key Generation
// ---------------------------------------------------------------------------

/** Generate an RSA-4096 key pair. Returns PEM-encoded SPKI public + PKCS#8 private. */
export function generateKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

// ---------------------------------------------------------------------------
// PBKDF2
// ---------------------------------------------------------------------------

/** Derive a 256-bit key from password + salt using PBKDF2-SHA256 at 600k iterations. */
export function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_BYTES, 'sha256');
}

// ---------------------------------------------------------------------------
// AES-256-GCM
// ---------------------------------------------------------------------------

function aesGcmEncrypt(
  key: Buffer,
  iv: Buffer,
  plaintext: Buffer,
  aad: Buffer,
): { ciphertext: Buffer; tag: Buffer } {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, tag };
}

function aesGcmDecrypt(
  key: Buffer,
  iv: Buffer,
  ciphertext: Buffer,
  tag: Buffer,
  aad: Buffer,
): Buffer {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  decipher.setAAD(aad);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('Decryption failed');
  }
}

// ---------------------------------------------------------------------------
// RSA-OAEP-SHA256 wrap/unwrap
// ---------------------------------------------------------------------------

function rsaOaepWrap(publicKeyPem: string, plaintext: Buffer): Buffer {
  const keyObject = crypto.createPublicKey(publicKeyPem);
  return crypto.publicEncrypt(
    { key: keyObject, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    plaintext,
  );
}

function rsaOaepUnwrap(privateKeyPem: string, ciphertext: Buffer): Buffer {
  const keyObject = crypto.createPrivateKey(privateKeyPem);
  try {
    return crypto.privateDecrypt(
      { key: keyObject, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      ciphertext,
    );
  } catch {
    throw new Error('Decryption failed');
  }
}

// ---------------------------------------------------------------------------
// Envelope Validation
// ---------------------------------------------------------------------------

export function validateMessageEnvelope(obj: unknown): obj is CiphertextEnvelope {
  if (!obj || typeof obj !== 'object') return false;
  const e = obj as Record<string, unknown>;
  if (e.v !== 1) return false;
  if (e.alg !== MESSAGE_ALG) return false;
  if (typeof e.ek !== 'string' || fromBase64url(e.ek).length !== RSA_EK_BYTES) return false;
  if (typeof e.iv !== 'string' || fromBase64url(e.iv).length !== AES_IV_BYTES) return false;
  if (typeof e.tag !== 'string' || fromBase64url(e.tag).length !== AES_TAG_BYTES) return false;
  if (typeof e.ct !== 'string' || !e.ct) return false;
  if (typeof e.kid !== 'string' || !/^[a-f0-9]{64}$/.test(e.kid)) return false;
  // Reject unknown fields
  const known = new Set(['v', 'alg', 'ek', 'iv', 'ct', 'tag', 'kid']);
  for (const key of Object.keys(e)) {
    if (!known.has(key)) return false;
  }
  return true;
}

export function validatePrivateKeyEnvelope(obj: unknown): obj is EncryptedPrivateKey {
  if (!obj || typeof obj !== 'object') return false;
  const e = obj as Record<string, unknown>;
  if (e.v !== 1) return false;
  if (e.alg !== PRIVATE_KEY_ALG) return false;
  if (typeof e.iv !== 'string' || fromBase64url(e.iv).length !== AES_IV_BYTES) return false;
  if (typeof e.tag !== 'string' || fromBase64url(e.tag).length !== AES_TAG_BYTES) return false;
  if (typeof e.ct !== 'string' || !e.ct) return false;
  if (typeof e.salt !== 'string' || fromBase64url(e.salt).length !== PBKDF2_SALT_BYTES) return false;
  if (typeof e.kid !== 'string' || !/^[a-f0-9]{64}$/.test(e.kid)) return false;
  const known = new Set(['v', 'alg', 'iv', 'ct', 'tag', 'salt', 'kid']);
  for (const key of Object.keys(e)) {
    if (!known.has(key)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Message Encryption (Section 4.1)
// ---------------------------------------------------------------------------

/**
 * Encrypt a confirmation message for a HITL config.
 * AAD = `{hitlId}`
 */
export function encryptMessage(
  plaintext: string,
  publicKeyPem: string,
  hitlId: string,
): CiphertextEnvelope {
  const aesKey = crypto.randomBytes(AES_KEY_BYTES);
  const iv = crypto.randomBytes(AES_IV_BYTES);
  const aad = Buffer.from(hitlId, 'utf8');
  const plaintextBuf = Buffer.from(plaintext, 'utf8');

  const { ciphertext, tag } = aesGcmEncrypt(aesKey, iv, plaintextBuf, aad);
  const ek = rsaOaepWrap(publicKeyPem, aesKey);
  const kid = computeKid(publicKeyPem);

  return {
    v: ENVELOPE_VERSION,
    alg: MESSAGE_ALG,
    ek: toBase64url(ek),
    iv: toBase64url(iv),
    ct: toBase64url(ciphertext),
    tag: toBase64url(tag),
    kid,
  };
}

/**
 * Encrypt a message with fixed AES key and IV (for test vector generation only).
 * @internal
 */
export function encryptMessageWithFixedInputs(
  plaintext: string,
  publicKeyPem: string,
  hitlId: string,
  aesKey: Buffer,
  iv: Buffer,
): CiphertextEnvelope {
  const aad = Buffer.from(hitlId, 'utf8');
  const plaintextBuf = Buffer.from(plaintext, 'utf8');

  const { ciphertext, tag } = aesGcmEncrypt(aesKey, iv, plaintextBuf, aad);
  const ek = rsaOaepWrap(publicKeyPem, aesKey);
  const kid = computeKid(publicKeyPem);

  return {
    v: ENVELOPE_VERSION,
    alg: MESSAGE_ALG,
    ek: toBase64url(ek),
    iv: toBase64url(iv),
    ct: toBase64url(ciphertext),
    tag: toBase64url(tag),
    kid,
  };
}

/**
 * Decrypt a confirmation message envelope.
 * AAD = `{hitlId}`
 */
export function decryptMessage(
  envelope: CiphertextEnvelope,
  privateKeyPem: string,
  hitlId: string,
): string {
  if (!validateMessageEnvelope(envelope)) {
    throw new Error('Decryption failed');
  }

  const ek = fromBase64url(envelope.ek);
  const iv = fromBase64url(envelope.iv);
  const ct = fromBase64url(envelope.ct);
  const tag = fromBase64url(envelope.tag);
  const aad = Buffer.from(hitlId, 'utf8');

  const aesKey = rsaOaepUnwrap(privateKeyPem, ek);
  const plaintext = aesGcmDecrypt(aesKey, iv, ct, tag, aad);

  return plaintext.toString('utf8');
}

// ---------------------------------------------------------------------------
// Private Key Encryption (Section 4.2)
// ---------------------------------------------------------------------------

/**
 * Encrypt an RSA private key with a user password for storage.
 * AAD = `{hitlId}:{userId}`
 */
export function encryptPrivateKey(
  privateKeyPem: string,
  password: string,
  publicKeyPem: string,
  hitlId: string,
  userId: string,
): EncryptedPrivateKey {
  const salt = crypto.randomBytes(PBKDF2_SALT_BYTES);
  const derivedKey = deriveKey(password, salt);
  const iv = crypto.randomBytes(AES_IV_BYTES);
  const aad = Buffer.from(`${hitlId}:${userId}`, 'utf8');
  const privateKeyDer = crypto.createPrivateKey(privateKeyPem).export({ type: 'pkcs8', format: 'der' });

  const { ciphertext, tag } = aesGcmEncrypt(derivedKey, iv, privateKeyDer as Buffer, aad);
  const kid = computeKid(publicKeyPem);

  return {
    v: ENVELOPE_VERSION,
    alg: PRIVATE_KEY_ALG,
    iv: toBase64url(iv),
    ct: toBase64url(ciphertext),
    tag: toBase64url(tag),
    salt: toBase64url(salt),
    kid,
  };
}

/**
 * Decrypt an RSA private key using the user's password.
 * AAD = `{hitlId}:{userId}`
 * Returns PEM-encoded PKCS#8 private key.
 */
export function decryptPrivateKey(
  envelope: EncryptedPrivateKey,
  password: string,
  hitlId: string,
  userId: string,
): string {
  if (!validatePrivateKeyEnvelope(envelope)) {
    throw new Error('Decryption failed');
  }

  const salt = fromBase64url(envelope.salt);
  const derivedKey = deriveKey(password, salt);
  const iv = fromBase64url(envelope.iv);
  const ct = fromBase64url(envelope.ct);
  const tag = fromBase64url(envelope.tag);
  const aad = Buffer.from(`${hitlId}:${userId}`, 'utf8');

  const privateKeyDer = aesGcmDecrypt(derivedKey, iv, ct, tag, aad);

  // Convert DER back to PEM
  const keyObject = crypto.createPrivateKey({ key: privateKeyDer, format: 'der', type: 'pkcs8' });
  return keyObject.export({ type: 'pkcs8', format: 'pem' }) as string;
}

// ---------------------------------------------------------------------------
// Full Key Setup (convenience)
// ---------------------------------------------------------------------------

/**
 * Generate a new RSA-4096 key pair and encrypt the private key with a password.
 * Returns everything needed for `PUT /api/v1/hitl/:id/keys`.
 */
export function generateEncryptionKeyPair(
  password: string,
  hitlId: string,
  userId: string,
): { publicKeyPem: string; encryptedPrivateKey: EncryptedPrivateKey; kdfSalt: string; kid: string } {
  const { publicKeyPem, privateKeyPem } = generateKeyPair();
  const encrypted = encryptPrivateKey(privateKeyPem, password, publicKeyPem, hitlId, userId);
  const kid = computeKid(publicKeyPem);
  return {
    publicKeyPem,
    encryptedPrivateKey: encrypted,
    kdfSalt: encrypted.salt,
    kid,
  };
}
