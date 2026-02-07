import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tenant } from '@/lib/api/tenants';
import { TenantTable } from '@/components/admin/tenants/tenant-table';

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

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('TenantTable', () => {
  const defaultProps = {
    tenants: [createTenant()],
    sortField: undefined,
    sortDirection: undefined as 'asc' | 'desc' | undefined,
    onSortChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Column Headers
  // -----------------------------------------------------------------------
  describe('Column Headers', () => {
    it('should render Company column header', () => {
      render(<TenantTable {...defaultProps} />);
      expect(screen.getByText('Company')).toBeInTheDocument();
    });

    it('should render Status column header', () => {
      render(<TenantTable {...defaultProps} />);
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('should render Plan column header', () => {
      render(<TenantTable {...defaultProps} />);
      expect(screen.getByText('Plan')).toBeInTheDocument();
    });

    it('should render Agents column header', () => {
      render(<TenantTable {...defaultProps} />);
      expect(screen.getByText('Agents')).toBeInTheDocument();
    });

    it('should render Health column header', () => {
      render(<TenantTable {...defaultProps} />);
      expect(screen.getByText('Health')).toBeInTheDocument();
    });

    it('should render Created column header', () => {
      render(<TenantTable {...defaultProps} />);
      expect(screen.getByText('Created')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Data Rendering
  // -----------------------------------------------------------------------
  describe('Data Rendering', () => {
    it('should render tenant company name', () => {
      render(<TenantTable {...defaultProps} />);
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('should render tenant admin email', () => {
      render(<TenantTable {...defaultProps} />);
      expect(screen.getByText('admin@acme.com')).toBeInTheDocument();
    });

    it('should render tenant status badge', () => {
      render(<TenantTable {...defaultProps} />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should render formatted plan name', () => {
      render(<TenantTable {...defaultProps} />);
      expect(screen.getByText('Growth')).toBeInTheDocument();
    });

    it('should render agent count', () => {
      render(<TenantTable {...defaultProps} />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render health status', () => {
      render(<TenantTable {...defaultProps} />);
      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });

    it('should render formatted date', () => {
      render(<TenantTable {...defaultProps} />);
      // DATE_FORMATS.SHORT is 'MMM d, yyyy' => 'Jan 15, 2026'
      expect(screen.getByText('Jan 15, 2026')).toBeInTheDocument();
    });

    it('should render multiple tenants', () => {
      const tenants = [
        createTenant({ id: 't1', companyName: 'Alpha Corp' }),
        createTenant({ id: 't2', companyName: 'Beta Inc' }),
      ];
      render(<TenantTable {...defaultProps} tenants={tenants} />);
      expect(screen.getByText('Alpha Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Empty State
  // -----------------------------------------------------------------------
  describe('Empty State', () => {
    it('should show empty state when tenants array is empty', () => {
      render(<TenantTable {...defaultProps} tenants={[]} />);
      expect(screen.getByText('No tenants found')).toBeInTheDocument();
    });

    it('should show descriptive message in empty state', () => {
      render(<TenantTable {...defaultProps} tenants={[]} />);
      expect(
        screen.getByText('No tenants match your search criteria.'),
      ).toBeInTheDocument();
    });

    it('should not render table headers in empty state', () => {
      render(<TenantTable {...defaultProps} tenants={[]} />);
      expect(screen.queryByText('Company')).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Sorting
  // -----------------------------------------------------------------------
  describe('Sorting', () => {
    it('should call onSortChange when clicking Company header', async () => {
      const user = userEvent.setup();
      const onSortChange = jest.fn();
      render(<TenantTable {...defaultProps} onSortChange={onSortChange} />);

      await user.click(screen.getByText('Company'));
      expect(onSortChange).toHaveBeenCalledWith('company_name');
    });

    it('should call onSortChange when clicking Created header', async () => {
      const user = userEvent.setup();
      const onSortChange = jest.fn();
      render(<TenantTable {...defaultProps} onSortChange={onSortChange} />);

      await user.click(screen.getByText('Created'));
      expect(onSortChange).toHaveBeenCalledWith('created_at');
    });

    it('should call onSortChange when clicking Agents header', async () => {
      const user = userEvent.setup();
      const onSortChange = jest.fn();
      render(<TenantTable {...defaultProps} onSortChange={onSortChange} />);

      await user.click(screen.getByText('Agents'));
      expect(onSortChange).toHaveBeenCalledWith('agent_count');
    });
  });

  // -----------------------------------------------------------------------
  // Row Navigation
  // -----------------------------------------------------------------------
  describe('Row Navigation', () => {
    it('should navigate to tenant detail page when row is clicked', async () => {
      const user = userEvent.setup();
      render(<TenantTable {...defaultProps} />);

      // Click on the row containing the tenant data
      await user.click(screen.getByText('Acme Corp'));
      expect(mockPush).toHaveBeenCalledWith('/admin/tenants/test-tenant-1');
    });
  });
});
