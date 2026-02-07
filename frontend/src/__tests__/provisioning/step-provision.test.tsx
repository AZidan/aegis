import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  StepProvision,
  type ProvisionState,
} from '@/components/admin/provisioning/step-provision';
import type { ProvisioningFormData } from '@/lib/validations/provisioning';
import type { TenantProvisioningStatus } from '@/lib/api/provisioning';

// ---------------------------------------------------------------------------
// Mock next/link
// ---------------------------------------------------------------------------

jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({
      children,
      href,
      ...props
    }: {
      children: React.ReactNode;
      href: string;
      [key: string]: unknown;
    }) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultFormData(): ProvisioningFormData {
  return {
    companyName: 'Acme Corp',
    adminEmail: 'admin@acme.com',
    industry: 'technology',
    companySize: '51-200',
    deploymentRegion: 'us-east-1',
    notes: '',
    plan: 'growth',
    billingCycle: 'monthly',
    maxAgents: 10,
    maxSkills: 25,
    storageLimitGb: 100,
  };
}

function renderProvision(
  state: ProvisionState = 'summary',
  options?: {
    provisioningStatus?: TenantProvisioningStatus | null;
    tenantId?: string | null;
    errorMessage?: string | null;
    formData?: Partial<ProvisioningFormData>;
  }
) {
  const formData = { ...defaultFormData(), ...options?.formData };

  render(
    <StepProvision
      formData={formData}
      state={state}
      provisioningStatus={options?.provisioningStatus ?? null}
      tenantId={options?.tenantId ?? null}
      errorMessage={options?.errorMessage ?? null}
    />
  );
}

// ---------------------------------------------------------------------------
// Summary State Tests
// ---------------------------------------------------------------------------

describe('StepProvision - Summary', () => {
  it('should render the summary card heading', () => {
    renderProvision('summary');

    expect(screen.getByText('Provisioning Summary')).toBeInTheDocument();
  });

  it('should display company name in summary', () => {
    renderProvision('summary');

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('should display admin email in summary', () => {
    renderProvision('summary');

    expect(screen.getByText('admin@acme.com')).toBeInTheDocument();
  });

  it('should display the plan name in summary', () => {
    renderProvision('summary');

    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('should display billing cycle in summary', () => {
    renderProvision('summary');

    expect(screen.getByText('Monthly')).toBeInTheDocument();
  });

  it('should display estimated cost', () => {
    renderProvision('summary');

    expect(screen.getByText('$299')).toBeInTheDocument();
    expect(screen.getByText('per month')).toBeInTheDocument();
  });

  it('should show annual billing cost when set to annual', () => {
    renderProvision('summary', {
      formData: { billingCycle: 'annual' },
    });

    expect(screen.getByText('$239')).toBeInTheDocument();
    expect(
      screen.getByText('per month (billed annually)')
    ).toBeInTheDocument();
  });

  it('should show deployment region label', () => {
    renderProvision('summary');

    expect(screen.getByText('US East (Virginia)')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Provisioning State Tests
// ---------------------------------------------------------------------------

describe('StepProvision - Provisioning', () => {
  it('should render provisioning progress heading', () => {
    renderProvision('provisioning', {
      provisioningStatus: {
        step: 'creating_namespace',
        progress: 10,
        message: 'Creating namespace',
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
      },
    });

    expect(screen.getByText('Provisioning in Progress')).toBeInTheDocument();
  });

  it('should display progress percentage', () => {
    renderProvision('provisioning', {
      provisioningStatus: {
        step: 'spinning_container',
        progress: 40,
        message: 'Configuring',
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
      },
    });

    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('should render all five provisioning steps', () => {
    renderProvision('provisioning', {
      provisioningStatus: {
        step: 'creating_namespace',
        progress: 10,
        message: 'Creating',
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
      },
    });

    expect(screen.getByText('Creating tenant container')).toBeInTheDocument();
    expect(screen.getByText('Configuring network')).toBeInTheDocument();
    expect(screen.getByText('Installing base skills')).toBeInTheDocument();
    expect(screen.getByText('Setting up admin account')).toBeInTheDocument();
    expect(screen.getByText('Running health check')).toBeInTheDocument();
  });

  it('should show "Running" for active step and "Waiting" for pending steps', () => {
    renderProvision('provisioning', {
      provisioningStatus: {
        step: 'creating_namespace',
        progress: 10,
        message: 'Creating',
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
      },
    });

    const statuses = screen.getAllByText(/Running|Waiting|Done/);
    expect(statuses[0]).toHaveTextContent('Running');
    expect(statuses[1]).toHaveTextContent('Waiting');
  });

  it('should show "Done" for completed steps', () => {
    renderProvision('provisioning', {
      provisioningStatus: {
        step: 'configuring',
        progress: 60,
        message: 'Installing',
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
      },
    });

    // First two steps should be completed
    const doneStatuses = screen.getAllByText('Done');
    expect(doneStatuses.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Success State Tests
// ---------------------------------------------------------------------------

describe('StepProvision - Success', () => {
  it('should render success message', () => {
    renderProvision('success', {
      tenantId: 'tnt_abc123def456',
    });

    expect(
      screen.getByText('Tenant Provisioned Successfully')
    ).toBeInTheDocument();
  });

  it('should display the tenant ID', () => {
    renderProvision('success', {
      tenantId: 'tnt_abc123def456',
    });

    expect(screen.getByTestId('tenant-id-value')).toHaveTextContent(
      'tnt_abc123def456'
    );
  });

  it('should show View Tenant and Provision Another links', () => {
    renderProvision('success', {
      tenantId: 'tnt_abc123def456',
    });

    const viewLink = screen.getByText('View Tenant');
    expect(viewLink).toBeInTheDocument();
    expect(viewLink.closest('a')).toHaveAttribute(
      'href',
      '/admin/tenants/tnt_abc123def456'
    );

    const provisionLink = screen.getByText('Provision Another');
    expect(provisionLink).toBeInTheDocument();
    expect(provisionLink.closest('a')).toHaveAttribute('href', '/admin/tenants');
  });
});

// ---------------------------------------------------------------------------
// Error State Tests
// ---------------------------------------------------------------------------

describe('StepProvision - Error', () => {
  it('should render error message', () => {
    renderProvision('error', {
      errorMessage: 'Container allocation failed',
    });

    expect(screen.getByText('Provisioning Failed')).toBeInTheDocument();
    expect(
      screen.getByText('Container allocation failed')
    ).toBeInTheDocument();
  });

  it('should show Back to Tenants link on error', () => {
    renderProvision('error', {
      errorMessage: 'Something went wrong',
    });

    const link = screen.getByText('Back to Tenants');
    expect(link.closest('a')).toHaveAttribute('href', '/admin/tenants');
  });
});
