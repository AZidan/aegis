import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SecretsManagerService {
  private readonly algorithm = 'aes-256-gcm';

  generateToken(length = 48): string {
    return randomBytes(length).toString('base64url');
  }

  getGatewayTokenForTenant(tenantId: string): string {
    const keyMaterial = this.getMasterKey();
    return createHash('sha256')
      .update(`${tenantId}:${keyMaterial.toString('hex')}`)
      .digest('base64url')
      .slice(0, 64);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const key = this.getMasterKey();
    const cipher = createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  decrypt(ciphertext: string): string {
    const [ivB64, authTagB64, payloadB64] = ciphertext.split('.');
    if (!ivB64 || !authTagB64 || !payloadB64) {
      throw new Error('Invalid ciphertext format');
    }

    const key = this.getMasterKey();
    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(authTagB64, 'base64url');
    const payload = Buffer.from(payloadB64, 'base64url');

    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(payload),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private getMasterKey(): Buffer {
    const raw = process.env.AEGIS_SECRETS_MASTER_KEY;
    if (!raw || raw.trim().length === 0) {
      const env = process.env.NODE_ENV ?? 'development';
      if (env !== 'development' && env !== 'test') {
        throw new Error(
          'AEGIS_SECRETS_MASTER_KEY is required outside development/test',
        );
      }
      return createHash('sha256').update('aegis-dev-fallback-key').digest();
    }

    try {
      if (/^[A-Fa-f0-9]{64}$/.test(raw)) {
        return Buffer.from(raw, 'hex');
      }

      const decoded = Buffer.from(raw, 'base64');
      if (decoded.length === 32) {
        return decoded;
      }
    } catch {
      // fall through and hash
    }

    return createHash('sha256').update(raw).digest();
  }
}
