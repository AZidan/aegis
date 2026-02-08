import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';

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
  usePathname: () => '/dashboard',
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
  ArrowRight: () => <svg data-testid="icon-arrow-right" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
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

const MOCK_STATS = {
  activeAgents: 3,
  totalSlots: 5,
  messagesToday: 847,
  messageTrend: 12,
  skillsInstalled: 14,
  teamMembers: 6,
  planName: 'Professional',
};

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
    skills: [],
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
];

const MOCK_ROLES = [
  { id: 'r1', name: 'pm', label: 'PM', description: 'Product Manager', color: '#8b5cf6', defaultToolCategories: [], sortOrder: 1, isSystem: true },
  { id: 'r2', name: 'engineering', label: 'Engineering', description: 'Engineering', color: '#6366f1', defaultToolCategories: [], sortOrder: 2, isSystem: true },
  { id: 'r3', name: 'operations', label: 'Ops', description: 'Operations', color: '#10b981', defaultToolCategories: [], sortOrder: 3, isSystem: true },
];

const MOCK_ACTIVITY = [
  {
    id: 'a1',
    agentId: 'agent-1',
    agentName: 'Nadia',
    agentAvatarColor: 'bg-violet-100 text-violet-600',
    description: 'updated Jira ticket PRD-142',
    detail: '+2 story points',
    timestamp: '3 min ago',
    type: 'info' as const,
  },
  {
    id: 'a2',
    agentId: 'agent-2',
    agentName: 'Atlas',
    agentAvatarColor: 'bg-indigo-100 text-indigo-600',
    description: 'pushed to',
    detail: 'feat/auth-flow',
    timestamp: '12 min ago',
    type: 'success' as const,
  },
  {
    id: 'a3',
    agentId: 'agent-4',
    agentName: 'Hermes',
    agentAvatarColor: 'bg-orange-100 text-orange-600',
    description: 'failed to sync Google Sheets',
    timestamp: '28 min ago',
    type: 'error' as const,
  },
];

// Mock the hooks
jest.mock('@/lib/hooks/use-agents', () => ({
  useDashboardStats: () => ({
    data: MOCK_STATS,
    isLoading: false,
    error: null,
  }),
  useAgents: () => ({
    data: MOCK_AGENTS,
    isLoading: false,
    error: null,
  }),
  useRoles: () => ({
    data: MOCK_ROLES,
    isLoading: false,
    error: null,
  }),
  useRecentActivity: () => ({
    data: MOCK_ACTIVITY,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardPage', () => {
  // -----------------------------------------------------------------------
  // Welcome Header
  // -----------------------------------------------------------------------

  describe('Welcome Header', () => {
    it('should render welcome greeting', () => {
      render(<DashboardPage />);
      expect(
        screen.getByRole('heading', { name: /good morning, jane/i })
      ).toBeInTheDocument();
    });

    it('should render subtitle text', () => {
      render(<DashboardPage />);
      expect(
        screen.getByText(/what your agents are up to today/i)
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Stats Cards
  // -----------------------------------------------------------------------

  describe('Stats Cards', () => {
    it('should render "Active Agents" stat card', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('should render "Messages Today" stat card', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Messages Today')).toBeInTheDocument();
    });

    it('should render "Skills Installed" stat card', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Skills Installed')).toBeInTheDocument();
    });

    it('should render "Team Members" stat card', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Team Members')).toBeInTheDocument();
    });

    it('should display the active agents count', () => {
      const { container } = render(<DashboardPage />);
      const statValues = container.querySelectorAll('.text-3xl.font-bold');
      const activeAgentsStat = statValues[0];
      expect(activeAgentsStat?.textContent).toContain('3');
      expect(activeAgentsStat?.textContent).toContain('/5');
    });

    it('should display messages count "847"', () => {
      render(<DashboardPage />);
      expect(screen.getByText('847')).toBeInTheDocument();
    });

    it('should display skills installed count "14"', () => {
      render(<DashboardPage />);
      expect(screen.getByText('14')).toBeInTheDocument();
    });

    it('should display team members count "6"', () => {
      render(<DashboardPage />);
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('should render the progress ring for active agents', () => {
      const { container } = render(<DashboardPage />);
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('should render the message trend value', () => {
      const { container } = render(<DashboardPage />);
      const trendSpan = container.querySelector('.font-semibold');
      expect(trendSpan?.textContent).toContain('12');
      expect(screen.getByText('vs yesterday')).toBeInTheDocument();
    });

    it('should display slots remaining footer', () => {
      render(<DashboardPage />);
      expect(
        screen.getByText('2 slots remaining on Professional plan')
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Agent Overview
  // -----------------------------------------------------------------------

  describe('Agent Overview', () => {
    it('should render "Agent Overview" section title', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Agent Overview')).toBeInTheDocument();
    });

    it('should render "View All" link pointing to agents page', () => {
      render(<DashboardPage />);
      const viewAll = screen.getByText('View All');
      const link = viewAll.closest('a');
      expect(link).toHaveAttribute('href', '/dashboard/agents');
    });

    it('should render agent mini-cards with names', () => {
      render(<DashboardPage />);
      const nadiaElements = screen.getAllByText('Nadia');
      expect(nadiaElements.length).toBeGreaterThanOrEqual(1);
      const atlasElements = screen.getAllByText('Atlas');
      expect(atlasElements.length).toBeGreaterThanOrEqual(1);
      const irisElements = screen.getAllByText('Iris');
      expect(irisElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should render agent role badges on mini-cards', () => {
      render(<DashboardPage />);
      expect(screen.getByText('PM')).toBeInTheDocument();
      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.getByText('Ops')).toBeInTheDocument();
    });

    it('should render "Create Agent" CTA card when slots are available', () => {
      render(<DashboardPage />);
      const createTexts = screen.getAllByText('Create Agent');
      expect(createTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Activity Panel
  // -----------------------------------------------------------------------

  describe('Activity Panel', () => {
    it('should render "Recent Activity" heading', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    it('should render activity items with agent names', () => {
      render(<DashboardPage />);
      const nadiaInstances = screen.getAllByText('Nadia');
      expect(nadiaInstances.length).toBeGreaterThanOrEqual(1);
    });

    it('should render "View All Activity" button', () => {
      render(<DashboardPage />);
      expect(screen.getByText('View All Activity')).toBeInTheDocument();
    });

    it('should render activity descriptions', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/updated Jira ticket/)).toBeInTheDocument();
      expect(screen.getByText(/pushed to/)).toBeInTheDocument();
    });

    it('should render activity timestamps', () => {
      render(<DashboardPage />);
      const threeMinElements = screen.getAllByText('3 min ago');
      expect(threeMinElements.length).toBeGreaterThanOrEqual(1);
      const twelveMinElements = screen.getAllByText('12 min ago');
      expect(twelveMinElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should render error activity with action buttons', () => {
      render(<DashboardPage />);
      expect(screen.getByText('View Error')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });
});
