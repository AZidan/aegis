import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentDetailHeader } from '@/components/dashboard/agents/agent-detail-header';
import type { AgentDetail } from '@/lib/api/agents';

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
  Trash2: () => <svg data-testid="icon-trash" />,
  ChevronRight: () => <svg data-testid="icon-chevron-right" />,
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
}));

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function createAgentDetail(overrides?: Partial<AgentDetail>): AgentDetail {
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
    ],
    channels: [{ type: 'telegram', handle: '@nadia_pm_bot', connected: true }],
    metrics: {
      tasksCompletedToday: 12,
      tasksCompletedTrend: 3,
      avgResponseTime: 1.5,
      avgResponseTimeTrend: -0.2,
      successRate: 99.2,
      uptime: 99.8,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentDetailHeader', () => {
  // -----------------------------------------------------------------------
  // Breadcrumb
  // -----------------------------------------------------------------------

  describe('Breadcrumb', () => {
    it('should render "Agents" breadcrumb link', () => {
      render(<AgentDetailHeader agent={createAgentDetail()} />);
      const agentsLink = screen.getByText('Agents');
      expect(agentsLink.closest('a')).toHaveAttribute('href', '/dashboard/agents');
    });

    it('should render agent name in breadcrumb', () => {
      render(<AgentDetailHeader agent={createAgentDetail({ name: 'Atlas' })} />);
      // "Atlas" appears in breadcrumb (span) and in the heading (h1)
      const allAtlas = screen.getAllByText('Atlas');
      expect(allAtlas.length).toBe(2);
      // The breadcrumb one is a span
      const breadcrumbName = allAtlas.find((el) => el.tagName === 'SPAN');
      expect(breadcrumbName).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Agent Info
  // -----------------------------------------------------------------------

  describe('Agent Info', () => {
    it('should render the agent name as heading', () => {
      render(<AgentDetailHeader agent={createAgentDetail({ name: 'Nadia' })} />);
      expect(screen.getByRole('heading', { name: 'Nadia' })).toBeInTheDocument();
    });

    it('should render the role badge with "Agent" suffix', () => {
      const roles = [
        { id: 'r1', name: 'pm', label: 'PM', description: '', color: '#8b5cf6', defaultToolCategories: [], sortOrder: 1, isSystem: true },
      ];
      render(<AgentDetailHeader agent={createAgentDetail({ role: 'pm' })} roles={roles} />);
      expect(screen.getByText('PM Agent')).toBeInTheDocument();
    });

    it('should render the status label', () => {
      render(<AgentDetailHeader agent={createAgentDetail({ status: 'active' })} />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should render the model name', () => {
      render(<AgentDetailHeader agent={createAgentDetail({ model: 'Sonnet 4.5' })} />);
      expect(screen.getByText('Sonnet 4.5')).toBeInTheDocument();
    });

    it('should render the creation date', () => {
      render(
        <AgentDetailHeader agent={createAgentDetail({ createdAt: 'Jan 15, 2026' })} />
      );
      expect(screen.getByText(/Jan 15, 2026/)).toBeInTheDocument();
    });

    it('should render the last active time', () => {
      render(
        <AgentDetailHeader agent={createAgentDetail({ lastActive: '3 min ago' })} />
      );
      expect(screen.getByText('3 min ago')).toBeInTheDocument();
    });

    it('should render avatar with the first letter of the name', () => {
      const { container } = render(
        <AgentDetailHeader agent={createAgentDetail({ name: 'Nadia' })} />
      );
      const avatar = container.querySelector('.rounded-full.text-white');
      expect(avatar?.textContent).toBe('N');
    });
  });

  // -----------------------------------------------------------------------
  // Action Buttons
  // -----------------------------------------------------------------------

  describe('Action Buttons', () => {
    it('should render Pause button for active agents', () => {
      render(
        <AgentDetailHeader agent={createAgentDetail({ status: 'active' })} />
      );
      expect(screen.getByText('Pause')).toBeInTheDocument();
    });

    it('should not render Pause button for idle agents', () => {
      render(
        <AgentDetailHeader agent={createAgentDetail({ status: 'idle' })} />
      );
      expect(screen.queryByText('Pause')).not.toBeInTheDocument();
    });

    it('should render Resume button for idle agents', () => {
      render(
        <AgentDetailHeader agent={createAgentDetail({ status: 'idle' })} />
      );
      expect(screen.getByText('Resume')).toBeInTheDocument();
    });

    it('should render Resume button for suspended agents', () => {
      render(
        <AgentDetailHeader agent={createAgentDetail({ status: 'suspended' })} />
      );
      expect(screen.getByText('Resume')).toBeInTheDocument();
    });

    it('should always render Restart button', () => {
      render(
        <AgentDetailHeader agent={createAgentDetail({ status: 'active' })} />
      );
      expect(screen.getByText('Restart')).toBeInTheDocument();
    });

    it('should always render Delete button', () => {
      render(
        <AgentDetailHeader agent={createAgentDetail()} />
      );
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should call onAction with "pause" when Pause is clicked', async () => {
      const user = userEvent.setup();
      const onAction = jest.fn();
      render(
        <AgentDetailHeader
          agent={createAgentDetail({ status: 'active' })}
          onAction={onAction}
        />
      );

      await user.click(screen.getByText('Pause'));
      expect(onAction).toHaveBeenCalledWith('pause');
    });

    it('should call onAction with "resume" when Resume is clicked', async () => {
      const user = userEvent.setup();
      const onAction = jest.fn();
      render(
        <AgentDetailHeader
          agent={createAgentDetail({ status: 'idle' })}
          onAction={onAction}
        />
      );

      await user.click(screen.getByText('Resume'));
      expect(onAction).toHaveBeenCalledWith('resume');
    });

    it('should call onAction with "restart" when Restart is clicked', async () => {
      const user = userEvent.setup();
      const onAction = jest.fn();
      render(
        <AgentDetailHeader
          agent={createAgentDetail({ status: 'active' })}
          onAction={onAction}
        />
      );

      await user.click(screen.getByText('Restart'));
      expect(onAction).toHaveBeenCalledWith('restart');
    });
  });

  // -----------------------------------------------------------------------
  // Delete Modal
  // -----------------------------------------------------------------------

  describe('Delete Modal', () => {
    it('should not show delete modal by default', () => {
      render(<AgentDetailHeader agent={createAgentDetail()} />);
      expect(screen.queryByText('Delete Agent')).not.toBeInTheDocument();
    });

    it('should show delete modal when Delete button is clicked', async () => {
      const user = userEvent.setup();
      render(<AgentDetailHeader agent={createAgentDetail({ name: 'Nadia' })} />);

      await user.click(screen.getByText('Delete'));

      // "Delete Agent" appears as both heading and confirm button in the modal
      const deleteAgentTexts = screen.getAllByText('Delete Agent');
      expect(deleteAgentTexts.length).toBe(2); // heading + button
      expect(screen.getByText('This action cannot be undone')).toBeInTheDocument();
      expect(screen.getByText(/permanently delete/)).toBeInTheDocument();
    });

    it('should display agent name in the delete confirmation text', async () => {
      const user = userEvent.setup();
      render(
        <AgentDetailHeader agent={createAgentDetail({ name: 'Atlas' })} />
      );

      await user.click(screen.getByText('Delete'));

      // "Atlas" appears in breadcrumb, heading, and modal body (bold)
      const allAtlas = screen.getAllByText('Atlas');
      expect(allAtlas.length).toBeGreaterThanOrEqual(3);
    });

    it('should close delete modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<AgentDetailHeader agent={createAgentDetail()} />);

      await user.click(screen.getByText('Delete'));
      expect(screen.getByText('This action cannot be undone')).toBeInTheDocument();

      await user.click(screen.getByText('Cancel'));
      // After cancel, the "This action cannot be undone" should disappear
      expect(screen.queryByText('This action cannot be undone')).not.toBeInTheDocument();
    });

    it('should call onDelete when modal confirm is clicked', async () => {
      const user = userEvent.setup();
      const onDelete = jest.fn();
      render(
        <AgentDetailHeader agent={createAgentDetail()} onDelete={onDelete} />
      );

      // Click the initial Delete button to open the modal
      await user.click(screen.getByText('Delete'));

      // Find the "Delete Agent" button in the modal (not the header)
      const modalButtons = screen.getAllByText('Delete Agent');
      // The last one is the confirm button in the modal
      await user.click(modalButtons[modalButtons.length - 1]);

      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });
});
