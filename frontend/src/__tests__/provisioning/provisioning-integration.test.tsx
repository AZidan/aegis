import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProvisionTenantPage from '@/app/admin/tenants/new/page';

/**
 * Provisioning Integration Tests
 *
 * Tests the full wizard flow from step 1 through provisioning completion.
 * Mocks the API layer (axios) and next/navigation.
 *
 * Test cases:
 * - Full happy path: fill steps 1 & 2 -> provision -> poll -> success
 * - Validation prevents advancing: missing required fields
 * - API error handling: 409 (duplicate), 500 (server error)
 * - Polling shows progress through each step
 * - Failed provisioning: poll returns failed -> error state
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/navigation
const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/admin/tenants/new',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link
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

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Check: () => <svg data-testid="check-icon" />,
  ChevronLeft: () => <svg data-testid="chevron-left" />,
  ChevronRight: () => <svg data-testid="chevron-right" />,
  Copy: () => <svg data-testid="copy-icon" />,
  CheckCircle2: () => <svg data-testid="check-circle-icon" />,
  Loader2: () => <svg data-testid="loader-icon" />,
  Plus: () => <svg data-testid="plus-icon" />,
  AlertCircle: () => <svg data-testid="alert-icon" />,
}));

// Mock the API client module
const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('@/lib/api/client', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function renderWizard() {
  const queryClient = createQueryClient();
  const user = userEvent.setup();

  render(
    <QueryClientProvider client={queryClient}>
      <ProvisionTenantPage />
    </QueryClientProvider>,
  );

  return { user, queryClient };
}

async function fillStep1(user: ReturnType<typeof userEvent.setup>) {
  // Fill company name
  const companyInput = screen.getByLabelText(/company name/i);
  await user.clear(companyInput);
  await user.type(companyInput, 'Integration Test Corp');

  // Fill admin email
  const emailInput = screen.getByLabelText(/admin email/i);
  await user.clear(emailInput);
  await user.type(emailInput, 'admin@integration.com');

  // Select deployment region
  const regionSelect = screen.getByLabelText(/deployment region/i);
  await user.selectOptions(regionSelect, 'us-east-1');
}

async function advanceToStep2(user: ReturnType<typeof userEvent.setup>) {
  const nextButton = screen.getByTestId('next-button');
  await user.click(nextButton);
}

async function advanceToStep3(user: ReturnType<typeof userEvent.setup>) {
  const nextButton = screen.getByTestId('next-button');
  await user.click(nextButton);
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Provisioning Wizard Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockReset();
    mockGet.mockReset();
  });

  // ==========================================================================
  // Full happy path
  // ==========================================================================
  describe('full happy path', () => {
    it('should complete the full wizard flow: fill step 1 -> step 2 -> provision -> success', async () => {
      // Set up API mocks
      mockPost.mockResolvedValueOnce({
        data: {
          id: 'new-tenant-uuid',
          companyName: 'Integration Test Corp',
          adminEmail: 'admin@integration.com',
          status: 'provisioning',
          plan: 'growth',
          inviteLink: 'https://app.aegis.ai/invite/new-tenant-uuid',
          createdAt: '2026-02-07T12:00:00.000Z',
        },
      });

      // Poll responses: provisioning -> active
      mockGet
        .mockResolvedValueOnce({
          data: {
            id: 'new-tenant-uuid',
            status: 'provisioning',
            provisioning: {
              step: 'creating_namespace',
              progress: 10,
              message: 'Creating namespace...',
              attemptNumber: 1,
              startedAt: '2026-02-07T12:00:00.000Z',
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            id: 'new-tenant-uuid',
            status: 'active',
            plan: 'growth',
          },
        });

      const { user } = renderWizard();

      // Step 1: Fill company details
      await fillStep1(user);
      await advanceToStep2(user);

      // Should now be on step 2
      await waitFor(() => {
        expect(screen.getByText('Plan & Limits')).toBeInTheDocument();
      });

      // Step 2: Plan is pre-selected as 'growth', advance to step 3
      await advanceToStep3(user);

      // Should now be on step 3 (summary)
      await waitFor(() => {
        expect(screen.getByText('Provisioning Summary')).toBeInTheDocument();
      });

      // Click provision
      const provisionButton = screen.getByTestId('provision-button');
      await user.click(provisionButton);

      // API should be called
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/admin/tenants',
          expect.objectContaining({
            companyName: 'Integration Test Corp',
            adminEmail: 'admin@integration.com',
            plan: 'growth',
          }),
        );
      });

      // Should show provisioning progress
      await waitFor(() => {
        expect(
          screen.getByText('Provisioning in Progress'),
        ).toBeInTheDocument();
      });

      // Wait for success state (polling returns active)
      await waitFor(
        () => {
          expect(
            screen.getByText('Tenant Provisioned Successfully'),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });
  });

  // ==========================================================================
  // Validation prevents advancing
  // ==========================================================================
  describe('validation prevents advancing', () => {
    it('should show errors and not advance when required fields are empty on step 1', async () => {
      const { user } = renderWizard();

      // Try to advance without filling anything
      const nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);

      // Should still be on step 1 (errors shown)
      await waitFor(() => {
        // Company name error
        expect(
          screen.getByText(/company name must be at least 3 characters/i),
        ).toBeInTheDocument();
      });

      // Should not advance to step 2
      expect(
        screen.queryByText('Provisioning Summary'),
      ).not.toBeInTheDocument();
    });

    it('should show email validation error for invalid email', async () => {
      const { user } = renderWizard();

      // Fill company name but invalid email
      const companyInput = screen.getByLabelText(/company name/i);
      await user.type(companyInput, 'Valid Company');

      const emailInput = screen.getByLabelText(/admin email/i);
      await user.type(emailInput, 'not-an-email');

      const regionSelect = screen.getByLabelText(/deployment region/i);
      await user.selectOptions(regionSelect, 'us-east-1');

      const nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);

      // Should show email validation error
      await waitFor(() => {
        expect(
          screen.getByText(/valid email/i),
        ).toBeInTheDocument();
      });
    });

    it('should show deployment region error when not selected', async () => {
      const { user } = renderWizard();

      // Fill company name and email but not region
      const companyInput = screen.getByLabelText(/company name/i);
      await user.type(companyInput, 'Valid Company');

      const emailInput = screen.getByLabelText(/admin email/i);
      await user.type(emailInput, 'admin@valid.com');

      const nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);

      // Should show region required error
      await waitFor(() => {
        expect(
          screen.getByText(/deployment region is required/i),
        ).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // API error handling: 409 Conflict
  // ==========================================================================
  describe('API error handling', () => {
    it('should show error state when API returns 409 (duplicate company)', async () => {
      // Mock API to reject with 409
      mockPost.mockRejectedValueOnce(
        new Error('Company name already exists'),
      );

      const { user } = renderWizard();

      // Complete step 1
      await fillStep1(user);
      await advanceToStep2(user);

      // Complete step 2
      await waitFor(() => {
        expect(screen.getByText('Plan & Limits')).toBeInTheDocument();
      });
      await advanceToStep3(user);

      // Click provision
      await waitFor(() => {
        expect(screen.getByText('Provisioning Summary')).toBeInTheDocument();
      });
      const provisionButton = screen.getByTestId('provision-button');
      await user.click(provisionButton);

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText('Provisioning Failed')).toBeInTheDocument();
        expect(
          screen.getByText('Company name already exists'),
        ).toBeInTheDocument();
      });
    });

    it('should show generic error state when API returns 500', async () => {
      // Mock API to reject with generic error
      mockPost.mockRejectedValueOnce(new Error('Internal Server Error'));

      const { user } = renderWizard();

      // Complete steps
      await fillStep1(user);
      await advanceToStep2(user);
      await waitFor(() => {
        expect(screen.getByText('Plan & Limits')).toBeInTheDocument();
      });
      await advanceToStep3(user);
      await waitFor(() => {
        expect(screen.getByText('Provisioning Summary')).toBeInTheDocument();
      });

      const provisionButton = screen.getByTestId('provision-button');
      await user.click(provisionButton);

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText('Provisioning Failed')).toBeInTheDocument();
      });
    });

    it('should show fallback error message when error is not an Error instance', async () => {
      // Mock API to reject with non-Error
      mockPost.mockRejectedValueOnce('Unknown failure');

      const { user } = renderWizard();

      // Complete steps
      await fillStep1(user);
      await advanceToStep2(user);
      await waitFor(() => {
        expect(screen.getByText('Plan & Limits')).toBeInTheDocument();
      });
      await advanceToStep3(user);
      await waitFor(() => {
        expect(screen.getByText('Provisioning Summary')).toBeInTheDocument();
      });

      const provisionButton = screen.getByTestId('provision-button');
      await user.click(provisionButton);

      // Should show fallback error message
      await waitFor(() => {
        expect(screen.getByText('Provisioning Failed')).toBeInTheDocument();
        expect(
          screen.getByText('Failed to create tenant. Please try again.'),
        ).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Polling shows progress
  // ==========================================================================
  describe('polling shows progress', () => {
    it('should update UI as polling returns different provisioning steps', async () => {
      // Initial create response
      mockPost.mockResolvedValueOnce({
        data: {
          id: 'poll-tenant-uuid',
          companyName: 'Poll Test Corp',
          adminEmail: 'admin@poll.com',
          status: 'provisioning',
          plan: 'growth',
          inviteLink: 'https://app.aegis.ai/invite/poll-tenant-uuid',
          createdAt: '2026-02-07T12:00:00.000Z',
        },
      });

      // Sequential poll responses: step 1 -> step 3
      mockGet
        .mockResolvedValueOnce({
          data: {
            id: 'poll-tenant-uuid',
            status: 'provisioning',
            provisioning: {
              step: 'creating_namespace',
              progress: 10,
              message: 'Creating namespace...',
              attemptNumber: 1,
              startedAt: '2026-02-07T12:00:00.000Z',
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            id: 'poll-tenant-uuid',
            status: 'provisioning',
            provisioning: {
              step: 'configuring',
              progress: 50,
              message: 'Configuring container...',
              attemptNumber: 1,
              startedAt: '2026-02-07T12:00:00.000Z',
            },
          },
        })
        .mockResolvedValue({
          data: {
            id: 'poll-tenant-uuid',
            status: 'active',
            plan: 'growth',
          },
        });

      const { user } = renderWizard();

      // Navigate to step 3 and provision
      await fillStep1(user);
      await advanceToStep2(user);
      await waitFor(() => {
        expect(screen.getByText('Plan & Limits')).toBeInTheDocument();
      });
      await advanceToStep3(user);
      await waitFor(() => {
        expect(screen.getByText('Provisioning Summary')).toBeInTheDocument();
      });

      const provisionButton = screen.getByTestId('provision-button');
      await user.click(provisionButton);

      // Should show provisioning in progress
      await waitFor(() => {
        expect(
          screen.getByText('Provisioning in Progress'),
        ).toBeInTheDocument();
      });

      // Eventually should show success
      await waitFor(
        () => {
          expect(
            screen.getByText('Tenant Provisioned Successfully'),
          ).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });
  });

  // ==========================================================================
  // Failed provisioning
  // ==========================================================================
  describe('failed provisioning', () => {
    it('should show error state when polling returns status "failed" with failedReason', async () => {
      // Create succeeds
      mockPost.mockResolvedValueOnce({
        data: {
          id: 'fail-tenant-uuid',
          companyName: 'Fail Test Corp',
          adminEmail: 'admin@fail.com',
          status: 'provisioning',
          plan: 'growth',
          inviteLink: 'https://app.aegis.ai/invite/fail-tenant-uuid',
          createdAt: '2026-02-07T12:00:00.000Z',
        },
      });

      // Poll returns failed
      mockGet.mockResolvedValue({
        data: {
          id: 'fail-tenant-uuid',
          status: 'failed',
          provisioning: {
            step: 'failed',
            progress: 40,
            message: 'Provisioning failed after 3 attempts.',
            attemptNumber: 3,
            startedAt: '2026-02-07T12:00:00.000Z',
            failedReason: 'Container health check timeout',
          },
        },
      });

      const { user } = renderWizard();

      // Navigate to step 3 and provision
      await fillStep1(user);
      await advanceToStep2(user);
      await waitFor(() => {
        expect(screen.getByText('Plan & Limits')).toBeInTheDocument();
      });
      await advanceToStep3(user);
      await waitFor(() => {
        expect(screen.getByText('Provisioning Summary')).toBeInTheDocument();
      });

      const provisionButton = screen.getByTestId('provision-button');
      await user.click(provisionButton);

      // Should show error state with failed reason
      await waitFor(
        () => {
          expect(screen.getByText('Provisioning Failed')).toBeInTheDocument();
          expect(
            screen.getByText('Container health check timeout'),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });

    it('should show fallback error message when failedReason is not provided', async () => {
      // Create succeeds
      mockPost.mockResolvedValueOnce({
        data: {
          id: 'fail2-tenant-uuid',
          companyName: 'Fail2 Test Corp',
          adminEmail: 'admin@fail2.com',
          status: 'provisioning',
          plan: 'starter',
          inviteLink: 'https://app.aegis.ai/invite/fail2-tenant-uuid',
          createdAt: '2026-02-07T12:00:00.000Z',
        },
      });

      // Poll returns failed without failedReason
      mockGet.mockResolvedValue({
        data: {
          id: 'fail2-tenant-uuid',
          status: 'failed',
          provisioning: {
            step: 'failed',
            progress: 20,
            message: 'Provisioning failed.',
            attemptNumber: 3,
            startedAt: '2026-02-07T12:00:00.000Z',
          },
        },
      });

      const { user } = renderWizard();

      // Navigate to step 3 and provision
      await fillStep1(user);
      await advanceToStep2(user);
      await waitFor(() => {
        expect(screen.getByText('Plan & Limits')).toBeInTheDocument();
      });
      await advanceToStep3(user);
      await waitFor(() => {
        expect(screen.getByText('Provisioning Summary')).toBeInTheDocument();
      });

      const provisionButton = screen.getByTestId('provision-button');
      await user.click(provisionButton);

      // Should show error state with fallback message
      await waitFor(
        () => {
          expect(screen.getByText('Provisioning Failed')).toBeInTheDocument();
          expect(
            screen.getByText(
              'Provisioning failed after multiple attempts.',
            ),
          ).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });
  });

  // ==========================================================================
  // Navigation state management
  // ==========================================================================
  describe('navigation state management', () => {
    it('should show Back to Tenants link on error state', async () => {
      mockPost.mockRejectedValueOnce(new Error('Server error'));

      const { user } = renderWizard();

      await fillStep1(user);
      await advanceToStep2(user);
      await waitFor(() => {
        expect(screen.getByText('Plan & Limits')).toBeInTheDocument();
      });
      await advanceToStep3(user);
      await waitFor(() => {
        expect(screen.getByText('Provisioning Summary')).toBeInTheDocument();
      });

      const provisionButton = screen.getByTestId('provision-button');
      await user.click(provisionButton);

      await waitFor(() => {
        const backLink = screen.getByText('Back to Tenants');
        expect(backLink.closest('a')).toHaveAttribute(
          'href',
          '/admin/tenants',
        );
      });
    });
  });
});
