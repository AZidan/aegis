import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentsPage from '@/app/dashboard/agents/page';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/dashboard/agents',
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
  Plus: () => <svg data-testid="icon-plus" />,
  Grid3X3: () => <svg data-testid="icon-grid" />,
  List: () => <svg data-testid="icon-list" />,
  Search: () => <svg data-testid="icon-search" />,
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  Pause: () => <svg data-testid="icon-pause" />,
  Play: () => <svg data-testid="icon-play" />,
  RotateCcw: () => <svg data-testid="icon-restart" />,
  Settings: () => <svg data-testid="icon-settings" />,
  AlertCircle: () => <svg data-testid="icon-alert" />,
  Loader2: () => <svg data-testid="icon-loader" />,
}));

// ---------------------------------------------------------------------------
// Mock hook data
// ---------------------------------------------------------------------------

const MOCK_AGENTS = [
  {
    id: 'agent-1',
    name: 'Nadia',
    description: 'PM Agent',
    role: 'pm',
    model: 'Sonnet 4.5',
    modelTier: 'sonnet' as const,
    thinkingMode: 'extended' as const,
    temperature: 0.3,
    status: 'active' as const,
    avatarColor: '#8b5cf6',
    lastActive: '3 min ago',
    createdAt: 'Jan 15, 2026',
    stats: { messages: 1247, skills: 4, uptime: 99.8 },
    skills: [
      { id: 's1', name: 'Jira Integration', version: 'v2.1', enabled: true },
      { id: 's2', name: 'Amplitude', version: 'v1.3', enabled: true },
      { id: 's3', name: 'Slack Bot', version: 'v2.0', enabled: true },
      { id: 's4', name: 'Sprint Planner', version: 'v1.0', enabled: true },
    ],
    channels: [],
  },
  {
    id: 'agent-2',
    name: 'Atlas',
    description: 'Engineering Agent',
    role: 'engineering',
    model: 'Opus 4',
    modelTier: 'opus' as const,
    thinkingMode: 'extended' as const,
    temperature: 0.2,
    status: 'active' as const,
    avatarColor: '#6366f1',
    lastActive: '1 min ago',
    createdAt: 'Jan 10, 2026',
    stats: { messages: 3210, skills: 5, uptime: 99.5 },
    skills: [],
    channels: [],
  },
  {
    id: 'agent-3',
    name: 'Iris',
    description: 'Ops Agent',
    role: 'operations',
    model: 'Haiku 3.5',
    modelTier: 'haiku' as const,
    thinkingMode: 'fast' as const,
    temperature: 0.5,
    status: 'idle' as const,
    avatarColor: '#10b981',
    lastActive: '12 min ago',
    createdAt: 'Jan 20, 2026',
    stats: { messages: 520, skills: 3, uptime: 98.1 },
    skills: [],
    channels: [],
  },
  {
    id: 'agent-4',
    name: 'Hermes',
    description: 'Support Agent',
    role: 'support',
    model: 'Sonnet 4.5',
    modelTier: 'sonnet' as const,
    thinkingMode: 'standard' as const,
    temperature: 0.4,
    status: 'error' as const,
    avatarColor: '#f59e0b',
    errorMessage: 'Google Sheets API timeout',
    lastActive: '28 min ago',
    createdAt: 'Jan 22, 2026',
    stats: { messages: 89, skills: 2, uptime: 87.5 },
    skills: [],
    channels: [],
  },
];

const MOCK_STATS = {
  activeAgents: 2,
  totalSlots: 6,
  messagesToday: 847,
  messageTrend: 12,
  skillsInstalled: 14,
  teamMembers: 6,
  planName: 'Professional',
};

const MOCK_ROLES = [
  { id: 'r1', name: 'pm', label: 'PM', description: 'Product Manager', color: '#8b5cf6', defaultToolCategories: [], sortOrder: 1, isSystem: true },
  { id: 'r2', name: 'engineering', label: 'Engineering', description: 'Engineering', color: '#6366f1', defaultToolCategories: [], sortOrder: 2, isSystem: true },
  { id: 'r3', name: 'operations', label: 'Ops', description: 'Operations', color: '#10b981', defaultToolCategories: [], sortOrder: 3, isSystem: true },
  { id: 'r4', name: 'support', label: 'Support', description: 'Customer Support', color: '#f59e0b', defaultToolCategories: [], sortOrder: 4, isSystem: true },
];

jest.mock('@/lib/hooks/use-agents', () => ({
  useAgents: () => ({
    data: MOCK_AGENTS,
    isLoading: false,
    error: null,
  }),
  useDashboardStats: () => ({
    data: MOCK_STATS,
    isLoading: false,
    error: null,
  }),
  useRoles: () => ({
    data: MOCK_ROLES,
    isLoading: false,
    error: null,
  }),
  useAgentAction: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentsPage', () => {
  // -----------------------------------------------------------------------
  // Page Header
  // -----------------------------------------------------------------------

  describe('Page Header', () => {
    it('should render "Agents" heading', () => {
      render(<AgentsPage />);
      expect(
        screen.getByRole('heading', { name: 'Agents' })
      ).toBeInTheDocument();
    });

    it('should render page description', () => {
      render(<AgentsPage />);
      expect(
        screen.getByText('Manage your AI agents and their configurations.')
      ).toBeInTheDocument();
    });

    it('should render "Create Agent" button linking to create page', () => {
      render(<AgentsPage />);
      const links = screen.getAllByRole('link', { name: /create agent/i });
      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links[0]).toHaveAttribute('href', '/dashboard/agents/create');
    });
  });

  // -----------------------------------------------------------------------
  // Agent Grid
  // -----------------------------------------------------------------------

  describe('Agent Grid', () => {
    it('should render all mock agent names', () => {
      render(<AgentsPage />);
      expect(screen.getByText('Nadia')).toBeInTheDocument();
      expect(screen.getByText('Atlas')).toBeInTheDocument();
      expect(screen.getByText('Iris')).toBeInTheDocument();
      expect(screen.getByText('Hermes')).toBeInTheDocument();
    });

    it('should render agent role badges', () => {
      render(<AgentsPage />);
      const pmElements = screen.getAllByText('PM');
      expect(pmElements.length).toBeGreaterThanOrEqual(1);
      const engElements = screen.getAllByText('Engineering');
      expect(engElements.length).toBeGreaterThanOrEqual(1);
      const opsElements = screen.getAllByText('Ops');
      expect(opsElements.length).toBeGreaterThanOrEqual(1);
      const supportElements = screen.getAllByText('Support');
      expect(supportElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Empty Slot Cards
  // -----------------------------------------------------------------------

  describe('Empty Slots', () => {
    it('should render empty slot cards for remaining slots', () => {
      render(<AgentsPage />);
      const createAgentTexts = screen.getAllByText('Create Agent');
      // One from the page header link + 2 from empty slots
      expect(createAgentTexts.length).toBeGreaterThanOrEqual(3);
    });

    it('should display slot numbers on empty slots', () => {
      render(<AgentsPage />);
      expect(screen.getByText('Slot 5 of 6')).toBeInTheDocument();
      expect(screen.getByText('Slot 6 of 6')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Usage Bar
  // -----------------------------------------------------------------------

  describe('Usage Bar', () => {
    it('should render agent slots usage', () => {
      render(<AgentsPage />);
      expect(screen.getByText('4/6 slots')).toBeInTheDocument();
    });

    it('should render "Agent Slots" label', () => {
      render(<AgentsPage />);
      expect(screen.getByText('Agent Slots')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  describe('Search', () => {
    it('should render search input with placeholder', () => {
      render(<AgentsPage />);
      expect(
        screen.getByPlaceholderText('Search agents...')
      ).toBeInTheDocument();
    });

    it('should filter agents when searching by name', async () => {
      const user = userEvent.setup();
      render(<AgentsPage />);

      const searchInput = screen.getByPlaceholderText('Search agents...');
      await user.type(searchInput, 'Nadia');

      expect(screen.getByText('Nadia')).toBeInTheDocument();
      expect(screen.queryByText('Atlas')).not.toBeInTheDocument();
      expect(screen.queryByText('Iris')).not.toBeInTheDocument();
      expect(screen.queryByText('Hermes')).not.toBeInTheDocument();
    });

    it('should show "No agents found" when search has no results', async () => {
      const user = userEvent.setup();
      render(<AgentsPage />);

      const searchInput = screen.getByPlaceholderText('Search agents...');
      await user.type(searchInput, 'NonExistentAgent');

      expect(screen.getByText('No agents found')).toBeInTheDocument();
      expect(
        screen.getByText('Try adjusting your search or filters.')
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Filters
  // -----------------------------------------------------------------------

  describe('Filters', () => {
    it('should render status filter dropdown', () => {
      render(<AgentsPage />);
      const statusSelect = screen.getByDisplayValue('All Status');
      expect(statusSelect).toBeInTheDocument();
    });

    it('should render role filter dropdown', () => {
      render(<AgentsPage />);
      const roleSelect = screen.getByDisplayValue('All Roles');
      expect(roleSelect).toBeInTheDocument();
    });

    it('should render status summary chips', () => {
      render(<AgentsPage />);
      expect(screen.getByText(/Active \(2\)/)).toBeInTheDocument();
      expect(screen.getByText(/Idle \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Error \(1\)/)).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // View Toggle
  // -----------------------------------------------------------------------

  describe('View Toggle', () => {
    it('should render grid and list view toggle buttons', () => {
      render(<AgentsPage />);
      expect(screen.getByTitle('Grid view')).toBeInTheDocument();
      expect(screen.getByTitle('List view')).toBeInTheDocument();
    });

    it('should highlight grid view by default', () => {
      render(<AgentsPage />);
      const gridButton = screen.getByTitle('Grid view');
      expect(gridButton.className).toContain('bg-primary-50');
    });

    it('should switch to list view when list button is clicked', async () => {
      const user = userEvent.setup();
      render(<AgentsPage />);

      const listButton = screen.getByTitle('List view');
      await user.click(listButton);

      expect(listButton.className).toContain('bg-primary-50');
    });
  });
});
