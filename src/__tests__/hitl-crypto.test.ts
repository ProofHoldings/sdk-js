/**
 * HITL Encryption crypto module tests.
 * Uses canonical test vectors from docs/ENCRYPTION_ENVELOPE.md.
 */
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  computeKid,
  deriveKey,
  encryptMessage,
  decryptMessage,
  encryptPrivateKey,
  decryptPrivateKey,
  generateKeyPair,
  generateEncryptionKeyPair,
  encryptMessageWithFixedInputs,
  validateMessageEnvelope,
  validatePrivateKeyEnvelope,
} from '../crypto/hitl-crypto.js';

// ---------------------------------------------------------------------------
// Test Vector Key Material (from docs/ENCRYPTION_ENVELOPE.md Section 7.1)
// ---------------------------------------------------------------------------

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAlp/dmdcBezsuVu3TlVKe
jDagg/p5jqdLAPllSeFFE1SAVqlURjOWE340l/PvcIYwKuqz32yzoWsQIxhbdYgq
eknVkYzit/gjaPAEwRU2gET40gbmYR47hc2VbQME3m307RwVeJT7lI5jQCM7FNtv
oWfFYPLdVVCcsrV+eLyAtOiIw2s6qBYbEa+I5gIAYbvDCUaeqsdtjRSuBU/dgGeH
gnK8A9az4Qwb2OOr5oD9UGXbFjavPmSlmWNsMFf6lHACBsN3vmE8Vs0bT42vedSR
LE2U/s//QtDmfwsHb3i6pwrAmoB6R8HFPXcG6W27KgyiG3pA89IPDLRWQDSt2rWn
9eKspjJXoamTbhnpq7k+x7tmb0kM116AMdLiTSoFIKjqp6jBUAbFVthPhfYKTkXx
oIQH7Y/SRlm6k6FWlEcPvK9jqV8HXkZvRHGtw97UUW8cxXkOKlET04+h57uyuRii
u91/uh7uM+9QR0Ay7qqBM78eA3xg6r5YLJWah76foJDf9HofDHjQL0EFwjReNH41
BRPoITInTYKb9RIxPfmcFkS2BDGFg7SgHKubeN8dD+oU66j/GgPTMI2XnZjtRh5J
ChB/B72EItGpzt96CZz/v3kgQXiYZKem1Ua/X78rk9+lRx+ftFkzvlwM9fkAfSZc
X8MKTxG+VQUNOs7Jo8HLa6MCAwEAAQ==
-----END PUBLIC KEY-----`;

const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
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
IZdTY7aWPq0Sto38IO98UODsmg==
-----END PRIVATE KEY-----`;

const TEST_PASSWORD = 'test-password-do-not-use';
const TEST_SALT_HEX = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const TEST_DERIVED_KEY_HEX = 'c355f4681854e0909a61e7d51da4c3dc4e151675e8c40480e66b2cd8ffc8dadc';
const TEST_KID = '678d9d6d5ccc0b536f4e0e72d67e99a2aac3ba4450e22888a4c2e21ba68fb411';

const TEST_HITL_ID = '507f1f77bcf86cd799439012';
const TEST_USER_ID = '507f1f77bcf86cd799439013';

const TEST_PLAINTEXT = 'Approve wire transfer of $50,000 to Acme Corp account ending 7890?';
const TEST_AES_KEY_HEX = '4b6f13b3dbb15e76ef1f3f9e4c2f8a16d09e47c3b2a7f1d8e5c4b3a2f1e0d9c8';
const TEST_IV_HEX = '010203040506070809101112';

// Expected deterministic AES-GCM output
const EXPECTED_CT_HEX = 'ab7795eb7600db1fcb15bc908e4084471e30946c8c839ab1a15b9461a6fcf80d0bee097b92de1dc98cf86c22b6e5f3e92023c6e9a394e90d46578bca087951ee144d';
const EXPECTED_TAG_HEX = 'a72b7eee1ab10ea0723874d8676efa4d';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HITL Crypto', () => {
  // =========================================================================
  // kid computation
  // =========================================================================

  describe('computeKid', () => {
    it('should compute correct kid from test public key', () => {
      const kid = computeKid(TEST_PUBLIC_KEY);
      expect(kid).toBe(TEST_KID);
    });

    it('should return 64 lowercase hex characters', () => {
      const kid = computeKid(TEST_PUBLIC_KEY);
      expect(kid).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // =========================================================================
  // PBKDF2
  // =========================================================================

  describe('deriveKey', () => {
    it('should produce correct derived key from test vectors', () => {
      const salt = Buffer.from(TEST_SALT_HEX, 'hex');
      const key = deriveKey(TEST_PASSWORD, salt);
      expect(key.toString('hex')).toBe(TEST_DERIVED_KEY_HEX);
    });
  });

  // =========================================================================
  // Vector 1: Message Encrypt/Decrypt Round-Trip
  // =========================================================================

  describe('Vector 1: Message encrypt/decrypt round-trip', () => {
    it('should produce deterministic AES-GCM output with fixed inputs', () => {
      const aesKey = Buffer.from(TEST_AES_KEY_HEX, 'hex');
      const iv = Buffer.from(TEST_IV_HEX, 'hex');

      const envelope = encryptMessageWithFixedInputs(
        TEST_PLAINTEXT,
        TEST_PUBLIC_KEY,
        TEST_HITL_ID,
        aesKey,
        iv,
      );

      // AES-GCM is deterministic for fixed (key, IV, plaintext, AAD)
      expect(Buffer.from(envelope.ct, 'base64url').toString('hex')).toBe(EXPECTED_CT_HEX);
      expect(Buffer.from(envelope.tag, 'base64url').toString('hex')).toBe(EXPECTED_TAG_HEX);
      expect(envelope.kid).toBe(TEST_KID);
      expect(envelope.v).toBe(1);
      expect(envelope.alg).toBe('RSA-OAEP-256+AES-256-GCM');
    });

    it('should decrypt envelope back to original plaintext', () => {
      const aesKey = Buffer.from(TEST_AES_KEY_HEX, 'hex');
      const iv = Buffer.from(TEST_IV_HEX, 'hex');

      const envelope = encryptMessageWithFixedInputs(
        TEST_PLAINTEXT,
        TEST_PUBLIC_KEY,
        TEST_HITL_ID,
        aesKey,
        iv,
      );

      const decrypted = decryptMessage(envelope, TEST_PRIVATE_KEY, TEST_HITL_ID);
      expect(decrypted).toBe(TEST_PLAINTEXT);
    });

    it('should encrypt and decrypt with random key/IV', () => {
      const envelope = encryptMessage(TEST_PLAINTEXT, TEST_PUBLIC_KEY, TEST_HITL_ID);

      expect(validateMessageEnvelope(envelope)).toBe(true);

      const decrypted = decryptMessage(envelope, TEST_PRIVATE_KEY, TEST_HITL_ID);
      expect(decrypted).toBe(TEST_PLAINTEXT);
    });
  });

  // =========================================================================
  // Vector 2: Wrong Password Rejection
  // =========================================================================

  describe('Vector 2: Wrong password rejection', () => {
    it('should fail to decrypt private key with wrong password', () => {
      const encrypted = encryptPrivateKey(TEST_PRIVATE_KEY, TEST_PASSWORD, TEST_PUBLIC_KEY, TEST_HITL_ID, TEST_USER_ID);

      expect(() => {
        decryptPrivateKey(encrypted, 'wrong-password', TEST_HITL_ID, TEST_USER_ID);
      }).toThrow('Decryption failed');
    });

    it('should succeed with correct password', () => {
      const encrypted = encryptPrivateKey(TEST_PRIVATE_KEY, TEST_PASSWORD, TEST_PUBLIC_KEY, TEST_HITL_ID, TEST_USER_ID);

      const decrypted = decryptPrivateKey(encrypted, TEST_PASSWORD, TEST_HITL_ID, TEST_USER_ID);

      // Verify the decrypted key can be used for RSA operations
      const testData = Buffer.from('test');
      const signed = crypto.sign('sha256', testData, decrypted);
      const verified = crypto.verify('sha256', testData, TEST_PUBLIC_KEY, signed);
      expect(verified).toBe(true);
    });
  });

  // =========================================================================
  // Vector 3: Wrong AAD Rejection
  // =========================================================================

  describe('Vector 3: Wrong AAD rejection', () => {
    it('should fail to decrypt with wrong hitl_id', () => {
      const envelope = encryptMessage(TEST_PLAINTEXT, TEST_PUBLIC_KEY, TEST_HITL_ID);

      expect(() => {
        decryptMessage(envelope, TEST_PRIVATE_KEY, '507f1f77bcf86cd799439099');
      }).toThrow('Decryption failed');
    });
  });

  // =========================================================================
  // Envelope Validation
  // =========================================================================

  describe('validateMessageEnvelope', () => {
    it('should accept valid envelope', () => {
      const envelope = encryptMessage(TEST_PLAINTEXT, TEST_PUBLIC_KEY, TEST_HITL_ID);
      expect(validateMessageEnvelope(envelope)).toBe(true);
    });

    it('should reject wrong version', () => {
      const envelope = encryptMessage(TEST_PLAINTEXT, TEST_PUBLIC_KEY, TEST_HITL_ID);
      expect(validateMessageEnvelope({ ...envelope, v: 2 })).toBe(false);
    });

    it('should reject wrong alg', () => {
      const envelope = encryptMessage(TEST_PLAINTEXT, TEST_PUBLIC_KEY, TEST_HITL_ID);
      expect(validateMessageEnvelope({ ...envelope, alg: 'AES-GCM' })).toBe(false);
    });

    it('should reject unknown fields', () => {
      const envelope = encryptMessage(TEST_PLAINTEXT, TEST_PUBLIC_KEY, TEST_HITL_ID);
      expect(validateMessageEnvelope({ ...envelope, extra: 'field' })).toBe(false);
    });
  });

  describe('validatePrivateKeyEnvelope', () => {
    it('should accept valid encrypted private key', () => {
      const encrypted = encryptPrivateKey(TEST_PRIVATE_KEY, TEST_PASSWORD, TEST_PUBLIC_KEY, TEST_HITL_ID, TEST_USER_ID);
      expect(validatePrivateKeyEnvelope(encrypted)).toBe(true);
    });

    it('should reject wrong alg', () => {
      const encrypted = encryptPrivateKey(TEST_PRIVATE_KEY, TEST_PASSWORD, TEST_PUBLIC_KEY, TEST_HITL_ID, TEST_USER_ID);
      expect(validatePrivateKeyEnvelope({ ...encrypted, alg: 'RSA-OAEP-256+AES-256-GCM' })).toBe(false);
    });
  });

  // =========================================================================
  // Key Generation
  // =========================================================================

  describe('generateKeyPair', () => {
    it('should generate valid RSA-4096 key pair', () => {
      const { publicKeyPem, privateKeyPem } = generateKeyPair();

      expect(publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----');
      expect(privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----');

      // Verify RSA-4096
      const keyObject = crypto.createPublicKey(publicKeyPem);
      expect(keyObject.asymmetricKeyType).toBe('rsa');
      const details = keyObject.asymmetricKeyDetails as { modulusLength?: number };
      expect(details.modulusLength).toBe(4096);
    });
  });

  describe('generateEncryptionKeyPair', () => {
    it('should produce a complete key setup for API upload', () => {
      const result = generateEncryptionKeyPair(TEST_PASSWORD, TEST_HITL_ID, TEST_USER_ID);

      expect(result.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----');
      expect(result.kid).toMatch(/^[a-f0-9]{64}$/);
      expect(result.kdfSalt).toBeTruthy();
      expect(validatePrivateKeyEnvelope(result.encryptedPrivateKey)).toBe(true);

      // Verify round-trip: decrypt the private key and use it
      const privateKeyPem = decryptPrivateKey(result.encryptedPrivateKey, TEST_PASSWORD, TEST_HITL_ID, TEST_USER_ID);
      const envelope = encryptMessage(TEST_PLAINTEXT, result.publicKeyPem, TEST_HITL_ID);
      const decrypted = decryptMessage(envelope, privateKeyPem, TEST_HITL_ID);
      expect(decrypted).toBe(TEST_PLAINTEXT);
    });
  });
});
