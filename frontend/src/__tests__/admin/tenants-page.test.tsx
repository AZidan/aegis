import React from 'react';
import { render, screen } from '@testing-library/react';
import type { Tenant, TenantListResponse } from '@/lib/api/tenants';
import TenantsPage from '@/app/admin/tenants/page';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/admin/tenants',
}));

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

// Mock useTenantsQuery from the tenants API module
const mockUseTenantsQuery = jest.fn();
jest.mock('@/lib/api/tenants', () => ({
  ...jest.requireActual('@/lib/api/tenants'),
  useTenantsQuery: (...args: unknown[]) => mockUseTenantsQuery(...args),
}));

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function createTenant(overrides?: Partial<Tenant>): Tenant {
  return {
    id: 'test-tenant-1',
    companyName: 'Acme Corp',
    adminEmail: 'admin@acme.com',
    status: 'active',
    plan: 'growth',
    agentCount: 5,
    health: { status: 'healthy', cpu: 45, memory: 60, disk: 30 },
    createdAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}

function createQueryResponse(tenants: Tenant[] = []): TenantListResponse {
  return {
    data: tenants,
    meta: {
      page: 1,
      limit: 20,
      total: tenants.length,
      totalPages: Math.ceil(tenants.length / 20) || 1,
    },
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('TenantsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Loading State
  // -----------------------------------------------------------------------
  describe('Loading State', () => {
    it('should show loading indicator while data is loading', () => {
      mockUseTenantsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      });

      render(<TenantsPage />);
      expect(screen.getByText('Loading tenants...')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Error State
  // -----------------------------------------------------------------------
  describe('Error State', () => {
    it('should show error state when query fails', () => {
      mockUseTenantsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
      });

      render(<TenantsPage />);
      expect(screen.getByText('Failed to load tenants')).toBeInTheDocument();
    });

    it('should display the error message from the Error object', () => {
      mockUseTenantsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Connection timeout'),
      });

      render(<TenantsPage />);
      expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    });

    it('should display a fallback message for non-Error objects', () => {
      mockUseTenantsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: 'something went wrong',
      });

      render(<TenantsPage />);
      expect(
        screen.getByText('An unexpected error occurred.'),
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Page Header
  // -----------------------------------------------------------------------
  describe('Page Header', () => {
    beforeEach(() => {
      mockUseTenantsQuery.mockReturnValue({
        data: createQueryResponse([]),
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('should render "Tenants" page title', () => {
      render(<TenantsPage />);
      expect(
        screen.getByRole('heading', { name: 'Tenants' }),
      ).toBeInTheDocument();
    });

    it('should render page description', () => {
      render(<TenantsPage />);
      expect(
        screen.getByText(
          'Manage all tenant environments and their configurations.',
        ),
      ).toBeInTheDocument();
    });

    it('should render "Provision Tenant" button linking to /admin/tenants/new', () => {
      render(<TenantsPage />);
      const link = screen.getByRole('link', { name: /provision tenant/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/admin/tenants/new');
    });
  });

  // -----------------------------------------------------------------------
  // Filters
  // -----------------------------------------------------------------------
  describe('Filters', () => {
    beforeEach(() => {
      mockUseTenantsQuery.mockReturnValue({
        data: createQueryResponse([]),
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('should render search input with placeholder', () => {
      render(<TenantsPage />);
      expect(
        screen.getByPlaceholderText('Search tenants by name or email...'),
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Loaded State with Data
  // -----------------------------------------------------------------------
  describe('Loaded State with Data', () => {
    it('should render tenant table when data is loaded', () => {
      const tenants = [
        createTenant({ id: 't1', companyName: 'Alpha Corp' }),
        createTenant({ id: 't2', companyName: 'Beta Inc' }),
      ];
      mockUseTenantsQuery.mockReturnValue({
        data: createQueryResponse(tenants),
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<TenantsPage />);
      expect(screen.getByText('Alpha Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    });

    it('should not show loading indicator when data is loaded', () => {
      mockUseTenantsQuery.mockReturnValue({
        data: createQueryResponse([createTenant()]),
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<TenantsPage />);
      expect(screen.queryByText('Loading tenants...')).not.toBeInTheDocument();
    });

    it('should not show error state when data is loaded', () => {
      mockUseTenantsQuery.mockReturnValue({
        data: createQueryResponse([createTenant()]),
        isLoading: false,
        isError: false,
        error: null,
      });

      render(<TenantsPage />);
      expect(
        screen.queryByText('Failed to load tenants'),
      ).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Breadcrumbs
  // -----------------------------------------------------------------------
  describe('Breadcrumbs', () => {
    beforeEach(() => {
      mockUseTenantsQuery.mockReturnValue({
        data: createQueryResponse([]),
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('should render Admin breadcrumb link', () => {
      render(<TenantsPage />);
      const adminLink = screen.getByRole('link', { name: 'Admin' });
      expect(adminLink).toBeInTheDocument();
      expect(adminLink).toHaveAttribute('href', '/admin');
    });
  });
});
