import { DockerHealthProbe } from '../../src/health/docker-health-probe';

describe('DockerHealthProbe', () => {
  let probe: DockerHealthProbe;
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    probe = new DockerHealthProbe();
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
  });

  it('returns healthy payload values', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'healthy',
        cpuPercent: 12,
        memoryMb: 256,
        diskGb: 1.2,
        uptime: 120,
      }),
    });

    const result = await probe.probe({ id: 'tenant-1', containerUrl: 'http://oclaw' });
    expect(result).toEqual({
      status: 'healthy',
      cpuPercent: 12,
      memoryMb: 256,
      diskGb: 1.2,
      uptime: 120,
    });
  });

  it('maps degraded status', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'degraded', cpu: 90, memory: 1024, disk: 15, uptime: 3600 }),
    });

    const result = await probe.probe({ id: 'tenant-1', containerUrl: 'http://oclaw' });
    expect(result.status).toBe('degraded');
    expect(result.cpuPercent).toBe(90);
  });

  it('returns down on timeout/abort', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted'));

    const result = await probe.probe({ id: 'tenant-1', containerUrl: 'http://oclaw' });
    expect(result.status).toBe('down');
  });

  it('returns down on connection failure', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const result = await probe.probe({ id: 'tenant-1', containerUrl: 'http://oclaw' });
    expect(result).toEqual({
      status: 'down',
      cpuPercent: 0,
      memoryMb: 0,
      diskGb: 0,
      uptime: 0,
    });
  });
});
