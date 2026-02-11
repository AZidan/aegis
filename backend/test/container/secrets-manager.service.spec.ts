import { SecretsManagerService } from '../../src/container/secrets-manager.service';

describe('SecretsManagerService', () => {
  let service: SecretsManagerService;

  beforeEach(() => {
    service = new SecretsManagerService();
    delete process.env.AEGIS_SECRETS_MASTER_KEY;
  });

  it('should generate a token', () => {
    const token = service.generateToken(16);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(16);
  });

  it('should generate deterministic tenant token', () => {
    const tokenA = service.getGatewayTokenForTenant('tenant-1');
    const tokenB = service.getGatewayTokenForTenant('tenant-1');
    const tokenC = service.getGatewayTokenForTenant('tenant-2');

    expect(tokenA).toBe(tokenB);
    expect(tokenA).not.toBe(tokenC);
  });

  it('should generate deterministic hook token different from gateway token', () => {
    const hookA = service.getHookTokenForTenant('tenant-1');
    const hookB = service.getHookTokenForTenant('tenant-1');
    const hookC = service.getHookTokenForTenant('tenant-2');
    const gwToken = service.getGatewayTokenForTenant('tenant-1');

    expect(hookA).toBe(hookB);
    expect(hookA).not.toBe(hookC);
    expect(hookA).not.toBe(gwToken);
  });

  it('should encrypt and decrypt plaintext', () => {
    const plaintext = 'secret-value';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(encrypted).not.toBe(plaintext);
    expect(decrypted).toBe(plaintext);
  });

  it('should throw in production when master key is missing', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => service.encrypt('value')).toThrow(
        'AEGIS_SECRETS_MASTER_KEY is required outside development/test',
      );
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  describe('generateAgeKeypair', () => {
    it('should return deterministic keypair for same tenant', () => {
      const kp1 = service.generateAgeKeypair('tenant-1');
      const kp2 = service.generateAgeKeypair('tenant-1');

      expect(kp1.publicKey).toBe(kp2.publicKey);
      expect(kp1.privateKey).toBe(kp2.privateKey);
    });

    it('should produce different keypairs for different tenants', () => {
      const kp1 = service.generateAgeKeypair('tenant-1');
      const kp2 = service.generateAgeKeypair('tenant-2');

      expect(kp1.publicKey).not.toBe(kp2.publicKey);
      expect(kp1.privateKey).not.toBe(kp2.privateKey);
    });

    it('should produce properly prefixed bech32 keys', () => {
      const { publicKey, privateKey } = service.generateAgeKeypair('tenant-x');

      expect(publicKey).toMatch(/^age1[a-z0-9]+$/);
      expect(privateKey).toMatch(/^AGE-SECRET-KEY-1[a-z0-9]+$/);
    });
  });

  describe('getAgePrivateKeyForTenant', () => {
    it('should produce age-keygen compatible file content', () => {
      const content = service.getAgePrivateKeyForTenant('tenant-1');
      const lines = content.split('\n');

      expect(lines[0]).toMatch(/^# created: \d{4}-\d{2}-\d{2}T/);
      expect(lines[1]).toMatch(/^# public key: age1[a-z0-9]+$/);
      expect(lines[2]).toMatch(/^AGE-SECRET-KEY-1[a-z0-9]+$/);
      expect(lines[3]).toBe('');
    });

    it('should embed the matching public key from generateAgeKeypair', () => {
      const { publicKey } = service.generateAgeKeypair('tenant-1');
      const content = service.getAgePrivateKeyForTenant('tenant-1');

      expect(content).toContain(`# public key: ${publicKey}`);
    });
  });
});
