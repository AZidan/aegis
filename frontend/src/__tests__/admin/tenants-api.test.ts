import { fetchTenants } from '@/lib/api/tenants';
import type { TenantListParams } from '@/lib/api/tenants';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGet = jest.fn();

jest.mock('@/lib/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('fetchTenants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({
      data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    });
  });

  it('should call api.get with /admin/tenants URL', async () => {
    await fetchTenants();

    expect(mockGet).toHaveBeenCalledWith(
      '/admin/tenants',
      expect.any(Object),
    );
  });

  it('should send { include: "all" } when called without params', async () => {
    await fetchTenants();

    expect(mockGet).toHaveBeenCalledWith('/admin/tenants', {
      params: { include: 'all' },
    });
  });

  it('should send { include: "all" } when called with empty params object', async () => {
    await fetchTenants({});

    expect(mockGet).toHaveBeenCalledWith('/admin/tenants', {
      params: { include: 'all' },
    });
  });

  it('should pass page, limit, status, and plan when provided', async () => {
    const params: TenantListParams = {
      page: 2,
      limit: 10,
      status: 'active',
      plan: 'growth',
    };

    await fetchTenants(params);

    expect(mockGet).toHaveBeenCalledWith('/admin/tenants', {
      params: expect.objectContaining({
        page: 2,
        limit: 10,
        status: 'active',
        plan: 'growth',
        include: 'all',
      }),
    });
  });

  it('should strip undefined params and not include them in the request', async () => {
    const params: TenantListParams = {
      page: 1,
      status: undefined,
      plan: undefined,
      search: undefined,
    };

    await fetchTenants(params);

    const sentParams = mockGet.mock.calls[0][1].params;
    expect(sentParams).not.toHaveProperty('status');
    expect(sentParams).not.toHaveProperty('plan');
    expect(sentParams).not.toHaveProperty('search');
    expect(sentParams).toHaveProperty('page', 1);
  });

  it('should strip empty search string', async () => {
    await fetchTenants({ search: '' });

    const sentParams = mockGet.mock.calls[0][1].params;
    expect(sentParams).not.toHaveProperty('search');
  });

  it('should include search when it is a non-empty string', async () => {
    await fetchTenants({ search: 'acme' });

    const sentParams = mockGet.mock.calls[0][1].params;
    expect(sentParams.search).toBe('acme');
  });

  it('should format sort as "field:direction"', async () => {
    await fetchTenants({ sortField: 'company_name', sortDirection: 'desc' });

    const sentParams = mockGet.mock.calls[0][1].params;
    expect(sentParams.sort).toBe('company_name:desc');
  });

  it('should default sort direction to "asc" when sortField is provided but sortDirection is not', async () => {
    await fetchTenants({ sortField: 'created_at' });

    const sentParams = mockGet.mock.calls[0][1].params;
    expect(sentParams.sort).toBe('created_at:asc');
  });

  it('should not include sort param when sortField is not provided', async () => {
    await fetchTenants({ page: 1 });

    const sentParams = mockGet.mock.calls[0][1].params;
    expect(sentParams).not.toHaveProperty('sort');
  });

  it('should default include to "all" when include is not specified', async () => {
    await fetchTenants({ page: 1 });

    const sentParams = mockGet.mock.calls[0][1].params;
    expect(sentParams.include).toBe('all');
  });

  it('should allow overriding include to "health"', async () => {
    await fetchTenants({ include: 'health' });

    const sentParams = mockGet.mock.calls[0][1].params;
    expect(sentParams.include).toBe('health');
  });

  it('should return the data property from the API response', async () => {
    const mockResponse = {
      data: {
        data: [{ id: 't1', companyName: 'Test' }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    mockGet.mockResolvedValue(mockResponse);

    const result = await fetchTenants();

    expect(result).toEqual(mockResponse.data);
  });
});
