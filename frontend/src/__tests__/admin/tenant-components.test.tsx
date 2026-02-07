import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tenant } from '@/lib/api/tenants';
import { StatusBadge } from '@/components/admin/tenants/status-badge';
import { HealthDot } from '@/components/admin/tenants/health-dot';
import { TenantPagination } from '@/components/admin/tenants/pagination';

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
// StatusBadge
// ---------------------------------------------------------------------------
describe('StatusBadge', () => {
  it('should render "Active" label for active status', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should render with emerald background class for active status', () => {
    render(<StatusBadge status="active" />);
    const badge = screen.getByText('Active');
    expect(badge.className).toContain('bg-emerald-50');
  });

  it('should render "Provisioning" label for provisioning status', () => {
    render(<StatusBadge status="provisioning" />);
    expect(screen.getByText('Provisioning')).toBeInTheDocument();
  });

  it('should render with blue background class for provisioning status', () => {
    render(<StatusBadge status="provisioning" />);
    const badge = screen.getByText('Provisioning');
    expect(badge.className).toContain('bg-blue-50');
  });

  it('should render "Suspended" label for suspended status', () => {
    render(<StatusBadge status="suspended" />);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('should render with red background class for suspended status', () => {
    render(<StatusBadge status="suspended" />);
    const badge = screen.getByText('Suspended');
    expect(badge.className).toContain('bg-red-50');
  });

  it('should render "Failed" label for failed status', () => {
    render(<StatusBadge status="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('should render with rose background class for failed status', () => {
    render(<StatusBadge status="failed" />);
    const badge = screen.getByText('Failed');
    expect(badge.className).toContain('bg-rose-50');
  });
});

// ---------------------------------------------------------------------------
// HealthDot
// ---------------------------------------------------------------------------
describe('HealthDot', () => {
  it('should render "Healthy" text for healthy status', () => {
    render(<HealthDot status="healthy" />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('should render a green dot for healthy status', () => {
    const { container } = render(<HealthDot status="healthy" />);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot?.className).toContain('bg-emerald-500');
  });

  it('should render "Degraded" text for degraded status', () => {
    render(<HealthDot status="degraded" />);
    expect(screen.getByText('Degraded')).toBeInTheDocument();
  });

  it('should render a yellow dot for degraded status', () => {
    const { container } = render(<HealthDot status="degraded" />);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot?.className).toContain('bg-yellow-500');
  });

  it('should render "Down" text for down status', () => {
    render(<HealthDot status="down" />);
    expect(screen.getByText('Down')).toBeInTheDocument();
  });

  it('should render a red dot for down status', () => {
    const { container } = render(<HealthDot status="down" />);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot?.className).toContain('bg-red-500');
  });

  it('should render "N/A" text when status is undefined', () => {
    render(<HealthDot />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('should not render a dot element when status is undefined', () => {
    const { container } = render(<HealthDot />);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TenantPagination
// ---------------------------------------------------------------------------
describe('TenantPagination', () => {
  const defaultProps = {
    page: 1,
    totalPages: 5,
    total: 100,
    limit: 20,
    onPageChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show correct "Showing X-Y of Z" text', () => {
    render(<TenantPagination {...defaultProps} />);
    const showingText = screen.getByText(/Showing/).closest('p');
    expect(showingText).toHaveTextContent('Showing 1-20 of 100 tenants');
  });

  it('should show correct range for middle page', () => {
    render(<TenantPagination {...defaultProps} page={3} />);
    // Page 3 with limit 20: showing 41-60
    expect(screen.getByText('41')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('should show correct range for last page with partial results', () => {
    render(<TenantPagination {...defaultProps} page={5} total={95} totalPages={5} />);
    // Page 5 with limit 20, total 95: showing 81-95
    const showingText = screen.getByText(/Showing/).closest('p');
    expect(showingText).toHaveTextContent('Showing 81-95 of 95 tenants');
  });

  it('should disable Previous button on first page', () => {
    render(<TenantPagination {...defaultProps} page={1} />);
    // Previous button is the first button (has a left chevron SVG)
    const buttons = screen.getAllByRole('button');
    const prevButton = buttons[0]; // First button is Previous
    expect(prevButton).toBeDisabled();
  });

  it('should enable Previous button on pages after first', () => {
    render(<TenantPagination {...defaultProps} page={2} />);
    const buttons = screen.getAllByRole('button');
    const prevButton = buttons[0]; // First button is Previous
    expect(prevButton).not.toBeDisabled();
  });

  it('should disable Next button on last page', () => {
    render(<TenantPagination {...defaultProps} page={5} />);
    const buttons = screen.getAllByRole('button');
    const nextButton = buttons[buttons.length - 1]; // Last button is Next
    expect(nextButton).toBeDisabled();
  });

  it('should enable Next button on pages before last', () => {
    render(<TenantPagination {...defaultProps} page={3} />);
    const buttons = screen.getAllByRole('button');
    const nextButton = buttons[buttons.length - 1]; // Last button is Next
    expect(nextButton).not.toBeDisabled();
  });

  it('should call onPageChange with page - 1 when clicking Previous', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    render(<TenantPagination {...defaultProps} page={3} onPageChange={onPageChange} />);

    const buttons = screen.getAllByRole('button');
    const prevButton = buttons[0]; // First button is Previous
    await user.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('should call onPageChange with page + 1 when clicking Next', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    render(<TenantPagination {...defaultProps} page={3} onPageChange={onPageChange} />);

    const buttons = screen.getAllByRole('button');
    const nextButton = buttons[buttons.length - 1]; // Last button is Next
    await user.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('should return null when total is 0', () => {
    const { container } = render(
      <TenantPagination {...defaultProps} total={0} totalPages={0} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
