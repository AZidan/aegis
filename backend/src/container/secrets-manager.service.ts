import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
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

  getHookTokenForTenant(tenantId: string): string {
    const keyMaterial = this.getMasterKey();
    return createHash('sha256')
      .update(`hook:${tenantId}:${keyMaterial.toString('hex')}`)
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

  generateAgeKeypair(tenantId: string): { publicKey: string; privateKey: string } {
    const masterKey = this.getMasterKey();
    const derived = Buffer.from(
      hkdfSync('sha256', masterKey, tenantId, 'aegis-age-keypair', 32),
    );

    const privateKey = this.bech32Encode('AGE-SECRET-KEY-', derived);
    const publicKey = this.bech32Encode('age', this.x25519PublicFromPrivate(derived));

    return { publicKey, privateKey };
  }

  getAgePrivateKeyForTenant(tenantId: string): string {
    const { publicKey, privateKey } = this.generateAgeKeypair(tenantId);
    return [
      `# created: ${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
      `# public key: ${publicKey}`,
      privateKey,
      '',
    ].join('\n');
  }

  private x25519PublicFromPrivate(privateKeyBytes: Buffer): Buffer {
    const { createPrivateKey, createPublicKey } = require('node:crypto');
    const privKey = createPrivateKey({
      key: this.wrapX25519PrivateKey(privateKeyBytes),
      format: 'der',
      type: 'pkcs8',
    });
    const pubKey = createPublicKey(privKey);
    const rawPub = pubKey.export({ type: 'spki', format: 'der' }) as Buffer;
    // X25519 SPKI DER has 12-byte header, raw public key is the last 32 bytes
    return rawPub.subarray(rawPub.length - 32);
  }

  private wrapX25519PrivateKey(raw32: Buffer): Buffer {
    // PKCS#8 DER wrapper for X25519 private key (RFC 8410)
    // 302e 0201 00300506032b656e 0422 0420 + 32 bytes
    const header = Buffer.from(
      '302e020100300506032b656e04220420',
      'hex',
    );
    return Buffer.concat([header, raw32]);
  }

  private bech32Encode(hrp: string, data: Buffer): string {
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

    const polymod = (values: number[]): number => {
      const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
      let chk = 1;
      for (const v of values) {
        const top = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ v;
        for (let i = 0; i < 5; i++) {
          if ((top >> i) & 1) {
            chk ^= GEN[i];
          }
        }
      }
      return chk;
    };

    const hrpExpand = (h: string): number[] => {
      const result: number[] = [];
      for (let i = 0; i < h.length; i++) {
        result.push(h.charCodeAt(i) >> 5);
      }
      result.push(0);
      for (let i = 0; i < h.length; i++) {
        result.push(h.charCodeAt(i) & 31);
      }
      return result;
    };

    const convert8to5 = (data: Buffer): number[] => {
      const result: number[] = [];
      let acc = 0;
      let bits = 0;
      for (const byte of data) {
        acc = (acc << 8) | byte;
        bits += 8;
        while (bits >= 5) {
          bits -= 5;
          result.push((acc >> bits) & 31);
        }
      }
      if (bits > 0) {
        result.push((acc << (5 - bits)) & 31);
      }
      return result;
    };

    const data5 = convert8to5(data);
    const values = hrpExpand(hrp.toLowerCase()).concat(data5);
    const polymodInput = values.concat([0, 0, 0, 0, 0, 0]);
    const mod = polymod(polymodInput) ^ 1;
    const checksum: number[] = [];
    for (let i = 0; i < 6; i++) {
      checksum.push((mod >> (5 * (5 - i))) & 31);
    }

    let result = hrp + '1';
    for (const v of data5.concat(checksum)) {
      result += CHARSET[v];
    }
    return result;
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
