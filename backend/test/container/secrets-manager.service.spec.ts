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
});
