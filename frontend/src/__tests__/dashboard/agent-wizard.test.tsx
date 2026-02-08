import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentCreatePage from '@/app/dashboard/agents/create/page';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
const mockMutate = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/dashboard/agents/create',
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

jest.mock('lucide-react', () => ({
  ArrowLeft: () => <svg data-testid="icon-arrow-left" />,
  ArrowRight: () => <svg data-testid="icon-arrow-right" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  Check: ({ className }: { className?: string }) => (
    <svg data-testid="check-icon" className={className} />
  ),
  Zap: ({ className }: { className?: string }) => (
    <svg data-testid="icon-zap" className={className} />
  ),
  Brain: ({ className }: { className?: string }) => (
    <svg data-testid="icon-brain" className={className} />
  ),
  Sparkles: ({ className }: { className?: string }) => (
    <svg data-testid="icon-sparkles" className={className} />
  ),
}));

// Mock roles data for StepBasicInfo and StepReview
const MOCK_ROLES = [
  { id: 'r1', name: 'pm', label: 'Product Manager', description: 'Manages product roadmaps and backlogs', color: '#8b5cf6', defaultToolCategories: [], sortOrder: 1, isSystem: true },
  { id: 'r2', name: 'engineering', label: 'Engineering', description: 'Writes and reviews code', color: '#6366f1', defaultToolCategories: [], sortOrder: 2, isSystem: true },
  { id: 'r3', name: 'operations', label: 'Operations', description: 'Handles ops tasks', color: '#10b981', defaultToolCategories: [], sortOrder: 3, isSystem: true },
  { id: 'r4', name: 'support', label: 'Customer Support', description: 'Answers customer questions', color: '#f43f5e', defaultToolCategories: [], sortOrder: 4, isSystem: true },
  { id: 'r5', name: 'data', label: 'Data Analyst', description: 'Runs data queries', color: '#06b6d4', defaultToolCategories: [], sortOrder: 5, isSystem: true },
  { id: 'r6', name: 'custom', label: 'Custom', description: 'Custom role', color: '#f59e0b', defaultToolCategories: [], sortOrder: 6, isSystem: false },
];

jest.mock('@/lib/hooks/use-agents', () => ({
  useRoles: () => ({
    data: MOCK_ROLES,
    isLoading: false,
    error: null,
  }),
  useCreateAgent: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentCreatePage (Wizard)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Page Header
  // -----------------------------------------------------------------------

  describe('Page Header', () => {
    it('should render "Create New Agent" heading', () => {
      render(<AgentCreatePage />);
      expect(
        screen.getByRole('heading', { name: 'Create New Agent' })
      ).toBeInTheDocument();
    });

    it('should render subtitle with total steps', () => {
      render(<AgentCreatePage />);
      expect(screen.getByText(/Set up a new AI agent in 5 steps/)).toBeInTheDocument();
    });

    it('should render "Back to Agents" button', () => {
      render(<AgentCreatePage />);
      expect(screen.getByText('Back to Agents')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Step 1: Basic Info
  // -----------------------------------------------------------------------

  describe('Step 1: Basic Info', () => {
    it('should render step 1 content by default', () => {
      render(<AgentCreatePage />);
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(
        screen.getByText('Set up the agent identity and role.')
      ).toBeInTheDocument();
    });

    it('should render agent name input', () => {
      render(<AgentCreatePage />);
      expect(
        screen.getByPlaceholderText('e.g. Nadia, Atlas, Iris')
      ).toBeInTheDocument();
    });

    it('should render description textarea', () => {
      render(<AgentCreatePage />);
      expect(
        screen.getByPlaceholderText('What will this agent help with?')
      ).toBeInTheDocument();
    });

    it('should render role selection cards from API', () => {
      render(<AgentCreatePage />);
      expect(screen.getByText('Product Manager')).toBeInTheDocument();
      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.getByText('Operations')).toBeInTheDocument();
      expect(screen.getByText('Customer Support')).toBeInTheDocument();
      expect(screen.getByText('Data Analyst')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('should render avatar color selection', () => {
      render(<AgentCreatePage />);
      expect(screen.getByText('Avatar Color')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Navigation: Previous / Next
  // -----------------------------------------------------------------------

  describe('Navigation', () => {
    it('should render Previous button as disabled on step 1', () => {
      render(<AgentCreatePage />);
      const prevButton = screen.getByText('Previous').closest('button');
      expect(prevButton).toBeDisabled();
    });

    it('should render Next button', () => {
      render(<AgentCreatePage />);
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    it('should disable Next button when name and role are not set', () => {
      render(<AgentCreatePage />);
      const nextButton = screen.getByText('Next').closest('button');
      expect(nextButton).toBeDisabled();
    });

    it('should enable Next button after filling name and selecting role', async () => {
      const user = userEvent.setup();
      render(<AgentCreatePage />);

      const nameInput = screen.getByPlaceholderText('e.g. Nadia, Atlas, Iris');
      await user.type(nameInput, 'TestAgent');

      // Select a role (role cards rendered from mock API data)
      await user.click(screen.getByText('Engineering'));

      const nextButton = screen.getByText('Next').closest('button');
      expect(nextButton).not.toBeDisabled();
    });

    it('should advance to step 2 when Next is clicked', async () => {
      const user = userEvent.setup();
      render(<AgentCreatePage />);

      const nameInput = screen.getByPlaceholderText('e.g. Nadia, Atlas, Iris');
      await user.type(nameInput, 'TestAgent');
      await user.click(screen.getByText('Engineering'));

      await user.click(screen.getByText('Next'));

      // Step 2 content should be visible
      expect(screen.getByText('Model & Config')).toBeInTheDocument();
    });

    it('should go back to step 1 when Previous is clicked from step 2', async () => {
      const user = userEvent.setup();
      render(<AgentCreatePage />);

      const nameInput = screen.getByPlaceholderText('e.g. Nadia, Atlas, Iris');
      await user.type(nameInput, 'TestAgent');
      await user.click(screen.getByText('Engineering'));
      await user.click(screen.getByText('Next'));

      await user.click(screen.getByText('Previous'));

      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Step 2: Model Config
  // -----------------------------------------------------------------------

  describe('Step 2: Model Config', () => {
    async function navigateToStep2() {
      const user = userEvent.setup();
      render(<AgentCreatePage />);

      const nameInput = screen.getByPlaceholderText('e.g. Nadia, Atlas, Iris');
      await user.type(nameInput, 'TestAgent');
      await user.click(screen.getByText('Engineering'));
      await user.click(screen.getByText('Next'));

      return user;
    }

    it('should render step 2 stepper label as active', async () => {
      await navigateToStep2();
      expect(screen.getByText('Model & Config')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Step Navigation (stepper clicks)
  // -----------------------------------------------------------------------

  describe('Stepper Navigation', () => {
    it('should navigate to a completed step via stepper click', async () => {
      const user = userEvent.setup();
      render(<AgentCreatePage />);

      const nameInput = screen.getByPlaceholderText('e.g. Nadia, Atlas, Iris');
      await user.type(nameInput, 'TestAgent');
      await user.click(screen.getByText('Engineering'));
      await user.click(screen.getByText('Next'));

      const step1Label = screen.getByText('Basic Info');
      const step1Container = step1Label.closest('[class*="cursor-pointer"]');
      if (step1Container) {
        await user.click(step1Container);
      }

      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Step 5: Review
  // -----------------------------------------------------------------------

  describe('Step 5: Review', () => {
    async function navigateToStep5() {
      const user = userEvent.setup();
      render(<AgentCreatePage />);

      // Step 1: fill name + role
      const nameInput = screen.getByPlaceholderText('e.g. Nadia, Atlas, Iris');
      await user.type(nameInput, 'TestAgent');
      await user.click(screen.getByText('Engineering'));
      await user.click(screen.getByText('Next'));

      // Step 2: just advance
      await user.click(screen.getByText('Next'));

      // Step 3: just advance
      await user.click(screen.getByText('Next'));

      // Step 4: just advance (Coming Soon page)
      await user.click(screen.getByText('Next'));

      return user;
    }

    it('should render "Review & Create" heading on step 5', async () => {
      await navigateToStep5();
      expect(screen.getByText('Review & Create')).toBeInTheDocument();
    });

    it('should display the agent name in the review', async () => {
      await navigateToStep5();
      expect(screen.getByText('TestAgent')).toBeInTheDocument();
    });

    it('should render "Create Agent" button instead of "Next" on step 5', async () => {
      await navigateToStep5();
      expect(screen.getByText('Create Agent')).toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });

    it('should render "Edit" links in review sections', async () => {
      await navigateToStep5();
      const editLinks = screen.getAllByText('Edit');
      // Basic Info, Model Config, Tool Policy (channel section removed)
      expect(editLinks.length).toBe(3);
    });

    it('should navigate back to step 1 when Basic Information Edit is clicked', async () => {
      const user = await navigateToStep5();

      const basicInfoButton = screen.getByText('Basic Information');
      await user.click(basicInfoButton);

      expect(
        screen.getByPlaceholderText('e.g. Nadia, Atlas, Iris')
      ).toBeInTheDocument();
    });
  });
});
