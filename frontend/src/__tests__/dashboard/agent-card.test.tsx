import React from 'react';
import { render, screen } from '@testing-library/react';
import { AgentCard, EmptySlotCard } from '@/components/dashboard/agents/agent-card';
import type { Agent } from '@/lib/api/agents';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
  Pause: () => <svg data-testid="icon-pause" />,
  Play: () => <svg data-testid="icon-play" />,
  RotateCcw: () => <svg data-testid="icon-restart" />,
  Settings: () => <svg data-testid="icon-settings" />,
  AlertCircle: () => <svg data-testid="icon-alert" />,
  Plus: () => <svg data-testid="icon-plus" />,
}));

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function createAgent(overrides?: Partial<Agent>): Agent {
  return {
    id: 'agent-1',
    name: 'Nadia',
    description: 'PM Agent',
    role: 'pm',
    model: 'Sonnet 4.5',
    modelTier: 'sonnet',
    thinkingMode: 'extended',
    temperature: 0.3,
    status: 'active',
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
    channels: [{ type: 'telegram', handle: '@nadia_pm_bot', connected: true }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AgentCard Tests
// ---------------------------------------------------------------------------

describe('AgentCard', () => {
  // -----------------------------------------------------------------------
  // Basic Rendering
  // -----------------------------------------------------------------------

  describe('Basic Rendering', () => {
    it('should render the agent name', () => {
      render(<AgentCard agent={createAgent()} />);
      expect(screen.getByText('Nadia')).toBeInTheDocument();
    });

    it('should render the role badge with correct label', () => {
      const roles = [
        { id: 'r1', name: 'pm', label: 'PM', description: '', color: '#8b5cf6', defaultToolCategories: [], sortOrder: 1, isSystem: true },
      ];
      render(<AgentCard agent={createAgent({ role: 'pm' })} roles={roles} />);
      expect(screen.getByText('PM')).toBeInTheDocument();
    });

    it('should render the model badge', () => {
      render(<AgentCard agent={createAgent({ model: 'Opus 4' })} />);
      expect(screen.getByText('Opus 4')).toBeInTheDocument();
    });

    it('should render the status label', () => {
      render(<AgentCard agent={createAgent({ status: 'active' })} />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should render the lastActive timestamp', () => {
      render(<AgentCard agent={createAgent({ lastActive: '12 min ago' })} />);
      expect(screen.getByText('12 min ago')).toBeInTheDocument();
    });

    it('should link to agent detail page', () => {
      render(<AgentCard agent={createAgent({ id: 'agent-42' })} />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/dashboard/agents/agent-42');
    });
  });

  // -----------------------------------------------------------------------
  // Status Dot
  // -----------------------------------------------------------------------

  describe('Status Dot', () => {
    it('should render green status dot for active agent', () => {
      const { container } = render(<AgentCard agent={createAgent({ status: 'active' })} />);
      const statusDot = container.querySelector('.bg-emerald-500');
      expect(statusDot).toBeTruthy();
    });

    it('should render amber status dot for idle agent', () => {
      const { container } = render(<AgentCard agent={createAgent({ status: 'idle' })} />);
      const statusDot = container.querySelector('.bg-amber-400');
      expect(statusDot).toBeTruthy();
    });

    it('should render red status dot for error agent', () => {
      const { container } = render(<AgentCard agent={createAgent({ status: 'error' })} />);
      const statusDot = container.querySelector('.bg-red-500');
      expect(statusDot).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  describe('Stats Row', () => {
    it('should render messages count', () => {
      render(<AgentCard agent={createAgent({ stats: { messages: 1247, skills: 4, uptime: 99.8 } })} />);
      expect(screen.getByText('1247')).toBeInTheDocument();
      expect(screen.getByText('Messages')).toBeInTheDocument();
    });

    it('should render skills count', () => {
      render(<AgentCard agent={createAgent({ stats: { messages: 1247, skills: 4, uptime: 99.8 } })} />);
      // The skills count "4" in the stats row
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('Skills')).toBeInTheDocument();
    });

    it('should render uptime percentage with emerald color for high uptime', () => {
      const { container } = render(
        <AgentCard agent={createAgent({ stats: { messages: 100, skills: 2, uptime: 99.8 } })} />
      );
      expect(screen.getByText('99.8%')).toBeInTheDocument();
      const uptimeEl = container.querySelector('.text-emerald-600');
      expect(uptimeEl).toBeTruthy();
    });

    it('should render "--" for 0% uptime', () => {
      render(
        <AgentCard agent={createAgent({ stats: { messages: 100, skills: 2, uptime: 0 } })} />
      );
      expect(screen.getByText('--')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Skill Badges
  // -----------------------------------------------------------------------

  describe('Skill Badges', () => {
    it('should render enabled skill names', () => {
      render(<AgentCard agent={createAgent()} />);
      expect(screen.getByText('Jira Integration')).toBeInTheDocument();
      expect(screen.getByText('Amplitude')).toBeInTheDocument();
      expect(screen.getByText('Slack Bot')).toBeInTheDocument();
      expect(screen.getByText('Sprint Planner')).toBeInTheDocument();
    });

    it('should not render disabled skills', () => {
      const agent = createAgent({
        skills: [
          { id: 's1', name: 'Enabled Skill', version: 'v1', enabled: true },
          { id: 's2', name: 'Disabled Skill', version: 'v1', enabled: false },
        ],
      });
      render(<AgentCard agent={agent} />);
      expect(screen.getByText('Enabled Skill')).toBeInTheDocument();
      expect(screen.queryByText('Disabled Skill')).not.toBeInTheDocument();
    });

    it('should show at most 4 skill badges', () => {
      const agent = createAgent({
        skills: [
          { id: 's1', name: 'Skill A', version: 'v1', enabled: true },
          { id: 's2', name: 'Skill B', version: 'v1', enabled: true },
          { id: 's3', name: 'Skill C', version: 'v1', enabled: true },
          { id: 's4', name: 'Skill D', version: 'v1', enabled: true },
          { id: 's5', name: 'Skill E', version: 'v1', enabled: true },
        ],
      });
      render(<AgentCard agent={agent} />);
      expect(screen.getByText('Skill A')).toBeInTheDocument();
      expect(screen.getByText('Skill D')).toBeInTheDocument();
      expect(screen.queryByText('Skill E')).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Error State
  // -----------------------------------------------------------------------

  describe('Error State', () => {
    it('should render error message banner for agent with error status', () => {
      const agent = createAgent({
        status: 'error',
        errorMessage: 'Google Sheets API timeout',
      });
      render(<AgentCard agent={agent} />);
      expect(screen.getByText('Google Sheets API timeout')).toBeInTheDocument();
    });

    it('should not render error banner for active agent', () => {
      const agent = createAgent({ status: 'active', errorMessage: undefined });
      render(<AgentCard agent={agent} />);
      expect(screen.queryByText('Google Sheets API timeout')).not.toBeInTheDocument();
    });

    it('should render error border styling', () => {
      const agent = createAgent({ status: 'error', errorMessage: 'Error' });
      const { container } = render(<AgentCard agent={agent} />);
      const link = container.querySelector('a');
      expect(link?.className).toContain('border-red-200');
    });
  });

  // -----------------------------------------------------------------------
  // Suspended State
  // -----------------------------------------------------------------------

  describe('Suspended State', () => {
    it('should apply reduced opacity for suspended agents', () => {
      const agent = createAgent({ status: 'suspended' });
      const { container } = render(<AgentCard agent={agent} />);
      const link = container.querySelector('a');
      expect(link?.className).toContain('opacity-55');
    });
  });

  // -----------------------------------------------------------------------
  // Quick Actions
  // -----------------------------------------------------------------------

  describe('Quick Actions', () => {
    it('should render Pause button for active agents', () => {
      render(<AgentCard agent={createAgent({ status: 'active' })} />);
      expect(screen.getByTitle('Pause')).toBeInTheDocument();
    });

    it('should render Resume button for idle agents', () => {
      render(<AgentCard agent={createAgent({ status: 'idle' })} />);
      expect(screen.getByTitle('Resume')).toBeInTheDocument();
    });

    it('should render Resume button for suspended agents', () => {
      render(<AgentCard agent={createAgent({ status: 'suspended' })} />);
      expect(screen.getByTitle('Resume')).toBeInTheDocument();
    });

    it('should render Restart button for non-suspended agents', () => {
      render(<AgentCard agent={createAgent({ status: 'active' })} />);
      expect(screen.getByTitle('Restart')).toBeInTheDocument();
    });

    it('should not render Restart button for suspended agents', () => {
      render(<AgentCard agent={createAgent({ status: 'suspended' })} />);
      expect(screen.queryByTitle('Restart')).not.toBeInTheDocument();
    });

    it('should render Configure button', () => {
      render(<AgentCard agent={createAgent()} />);
      expect(screen.getByTitle('Configure')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// EmptySlotCard Tests
// ---------------------------------------------------------------------------

describe('EmptySlotCard', () => {
  it('should render "Create Agent" text', () => {
    render(<EmptySlotCard slotNumber={5} totalSlots={6} />);
    expect(screen.getByText('Create Agent')).toBeInTheDocument();
  });

  it('should display slot number and total', () => {
    render(<EmptySlotCard slotNumber={5} totalSlots={6} />);
    expect(screen.getByText('Slot 5 of 6')).toBeInTheDocument();
  });

  it('should link to the agent creation page', () => {
    render(<EmptySlotCard slotNumber={5} totalSlots={6} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/dashboard/agents/create');
  });
});
