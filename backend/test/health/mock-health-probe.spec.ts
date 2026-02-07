import { MockHealthProbe } from '../../src/health/mock-health-probe';
import { HealthProbeResult } from '../../src/health/health-probe.interface';

describe('MockHealthProbe', () => {
  let probe: MockHealthProbe;

  beforeEach(() => {
    probe = new MockHealthProbe();
  });

  const tenantInput = {
    id: 'tenant-mock-001',
    containerUrl: 'http://localhost:3000',
  };

  describe('probe', () => {
    it('should return a valid HealthProbeResult with all required fields', async () => {
      const result = await probe.probe(tenantInput);

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('cpuPercent');
      expect(result).toHaveProperty('memoryMb');
      expect(result).toHaveProperty('diskGb');
      expect(result).toHaveProperty('uptime');
    });

    it('should return status as one of: "healthy", "degraded", "down"', async () => {
      // Run multiple times to increase probability of hitting all branches
      const validStatuses: HealthProbeResult['status'][] = [
        'healthy',
        'degraded',
        'down',
      ];

      for (let i = 0; i < 50; i++) {
        const result = await probe.probe(tenantInput);
        expect(validStatuses).toContain(result.status);
      }
    });

    it('should return cpuPercent between 0 and 85 for non-down status', async () => {
      // Force a non-down result by mocking Math.random to return > 0.07
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await probe.probe(tenantInput);

      expect(result.status).not.toBe('down');
      expect(result.cpuPercent).toBeGreaterThanOrEqual(0);
      expect(result.cpuPercent).toBeLessThanOrEqual(85);

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should return memoryMb between 0 and 80 for non-down status', async () => {
      // Force healthy status
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await probe.probe(tenantInput);

      expect(result.status).not.toBe('down');
      expect(result.memoryMb).toBeGreaterThanOrEqual(0);
      expect(result.memoryMb).toBeLessThanOrEqual(80);

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should return diskGb between 15 and 60', async () => {
      // Force healthy status
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await probe.probe(tenantInput);

      expect(result.diskGb).toBeGreaterThanOrEqual(15);
      expect(result.diskGb).toBeLessThanOrEqual(60);

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should return uptime as a positive integer (or 0 for down)', async () => {
      // Force healthy status
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await probe.probe(tenantInput);

      expect(result.uptime).toBeGreaterThanOrEqual(0);
      // Uptime should be a whole number (Math.floor is used)
      expect(Number.isInteger(result.uptime)).toBe(true);

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should return cpuPercent=0, memoryMb=0, uptime=0 when status is "down"', async () => {
      // Force down status: Math.random returning < 0.02 means roll < 2
      jest.spyOn(Math, 'random').mockReturnValue(0.01);

      const result = await probe.probe(tenantInput);

      expect(result.status).toBe('down');
      expect(result.cpuPercent).toBe(0);
      expect(result.memoryMb).toBe(0);
      expect(result.uptime).toBe(0);

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should preserve diskGb when status is "down"', async () => {
      // Force down status
      jest.spyOn(Math, 'random').mockReturnValue(0.01);

      const result = await probe.probe(tenantInput);

      expect(result.status).toBe('down');
      // diskGb should still be in valid range even when down
      expect(result.diskGb).toBeGreaterThanOrEqual(15);
      expect(result.diskGb).toBeLessThanOrEqual(60);

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should handle tenant with null containerUrl', async () => {
      const nullUrlTenant = { id: 'tenant-null', containerUrl: null };

      const result = await probe.probe(nullUrlTenant);

      expect(result).toHaveProperty('status');
      expect(['healthy', 'degraded', 'down']).toContain(result.status);
    });

    it('should produce "degraded" status when roll is between 2 and 7', async () => {
      // Force degraded: Math.random returning value that maps to 2 <= roll < 7
      // roll = Math.random() * 100, so Math.random() = 0.04 => roll = 4
      jest.spyOn(Math, 'random').mockReturnValue(0.04);

      const result = await probe.probe(tenantInput);

      expect(result.status).toBe('degraded');

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should produce "healthy" status when roll is >= 7', async () => {
      // Force healthy: Math.random returning >= 0.07
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await probe.probe(tenantInput);

      expect(result.status).toBe('healthy');

      jest.spyOn(Math, 'random').mockRestore();
    });
  });
});
