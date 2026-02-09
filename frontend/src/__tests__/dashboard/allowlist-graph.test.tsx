import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AllowlistPage from '@/app/dashboard/agents/allowlist/page';

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
  usePathname: () => '/dashboard/agents/allowlist',
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

// Mock lucide-react icons used across page + child components
jest.mock('lucide-react', () => ({
  Network: () => <svg data-testid="icon-network" />,
  Plus: () => <svg data-testid="icon-plus" />,
  LayoutGrid: () => <svg data-testid="icon-layout-grid" />,
  Table2: () => <svg data-testid="icon-table2" />,
  ArrowLeftRight: () => <svg data-testid="icon-arrow-left-right" />,
  ArrowRight: () => <svg data-testid="icon-arrow-right" />,
  ArrowLeft: () => <svg data-testid="icon-arrow-left" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  X: () => <svg data-testid="icon-x" />,
  Check: () => <svg data-testid="icon-check" />,
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  ChevronUp: () => <svg data-testid="icon-chevron-up" />,
}));

// ---------------------------------------------------------------------------
// Mock @xyflow/react - must be before imports
// ---------------------------------------------------------------------------

jest.mock('@xyflow/react', () => ({
  ReactFlow: ({
    nodes,
    children,
  }: {
    nodes: Array<{ id: string; data: { label: string } }>;
    children?: React.ReactNode;
  }) => (
    <div data-testid="react-flow">
      {nodes?.map((n) => (
        <div key={n.id} data-testid={`flow-node-${n.id}`}>
          {n.data.label}
        </div>
      ))}
      {children}
    </div>
  ),
  Background: () => <div data-testid="flow-background" />,
  Controls: () => <div data-testid="flow-controls" />,
  MiniMap: () => <div data-testid="flow-minimap" />,
  Handle: () => <div />,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  MarkerType: { ArrowClosed: 'arrowclosed' },
  useNodesState: (initial: unknown[]) => [initial, jest.fn(), jest.fn()],
  useEdgesState: (initial: unknown[]) => [initial, jest.fn(), jest.fn()],
}));

// ---------------------------------------------------------------------------
// Mock CSS import
// ---------------------------------------------------------------------------

jest.mock('@xyflow/react/dist/style.css', () => ({}));

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_GRAPH = {
  nodes: [
    { id: 'a1', name: 'Nadia', role: 'pm', status: 'active' },
    { id: 'a2', name: 'Atlas', role: 'engineering', status: 'active' },
    { id: 'a3', name: 'Iris', role: 'operations', status: 'idle' },
  ],
  edges: [
    { source: 'a1', target: 'a2', direction: 'both' as const },
    { source: 'a1', target: 'a3', direction: 'send_only' as const },
  ],
};

// Mock API functions
const mockFetchCommunicationGraph = jest.fn().mockResolvedValue(MOCK_GRAPH);
const mockUpdateAgentAllowlist = jest.fn().mockResolvedValue({ agentId: 'a1', entryCount: 1 });

jest.mock('@/lib/api/messaging', () => ({
  fetchCommunicationGraph: (...args: unknown[]) =>
    mockFetchCommunicationGraph(...args),
  updateAgentAllowlist: (...args: unknown[]) =>
    mockUpdateAgentAllowlist(...args),
  ROLE_COLORS: {
    pm: '#6366f1',
    engineering: '#22c55e',
    operations: '#f59e0b',
    analytics: '#3b82f6',
    support: '#ec4899',
    custom: '#64748b',
  },
  DIRECTION_LABELS: {
    both: 'Both',
    send_only: 'Send Only',
    receive_only: 'Receive Only',
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AllowlistPage', () => {
  beforeEach(() => {
    mockFetchCommunicationGraph.mockResolvedValue(MOCK_GRAPH);
    mockUpdateAgentAllowlist.mockResolvedValue({ agentId: 'a1', entryCount: 1 });
  });

  // 1. Renders loading state initially
  it('should render loading skeleton initially', () => {
    // Return a promise that never resolves to stay in loading state
    mockFetchCommunicationGraph.mockReturnValue(new Promise(() => {}));
    render(<AllowlistPage />, { wrapper: createWrapper() });

    // Loading state shows multiple skeleton divs
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // 2. Renders page title
  it('should render "Communication Rules" heading', async () => {
    render(<AllowlistPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Communication Rules' }),
      ).toBeInTheDocument();
    });
  });

  // 3. Renders graph nodes after data loads
  it('should render graph nodes after data loads', async () => {
    render(<AllowlistPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    expect(screen.getByTestId('flow-node-a1')).toBeInTheDocument();
    expect(screen.getByTestId('flow-node-a2')).toBeInTheDocument();
    expect(screen.getByTestId('flow-node-a3')).toBeInTheDocument();
  });

  // 4. Renders table view when toggled
  it('should render table view when toggled', async () => {
    const user = userEvent.setup();
    render(<AllowlistPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Communication Rules' }),
      ).toBeInTheDocument();
    });

    const tableButton = screen.getByTitle('Table View');
    await user.click(tableButton);

    // Table should show source/target columns
    expect(screen.getByText('Source Agent')).toBeInTheDocument();
    expect(screen.getByText('Target Agent')).toBeInTheDocument();
    expect(screen.getByText('Direction')).toBeInTheDocument();
  });

  // 5. Opens edge modal on "Add Rule" click
  it('should open edge modal on "Add Rule" click', async () => {
    const user = userEvent.setup();
    render(<AllowlistPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Communication Rules' }),
      ).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /add rule/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText('Add Communication Rule'),
      ).toBeInTheDocument();
    });
  });

  // 6. Modal shows source/target dropdowns
  it('should show source and target dropdowns in modal', async () => {
    const user = userEvent.setup();
    render(<AllowlistPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Communication Rules' }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add rule/i }));

    await waitFor(() => {
      expect(screen.getByText('Source Agent')).toBeInTheDocument();
      expect(screen.getByText('Target Agent')).toBeInTheDocument();
    });
  });

  // 7. View toggle switches between graph and table
  it('should toggle between graph and table views', async () => {
    const user = userEvent.setup();
    render(<AllowlistPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    // Switch to table
    await user.click(screen.getByTitle('Table View'));
    expect(screen.queryByTestId('react-flow')).not.toBeInTheDocument();
    expect(screen.getByText('Source Agent')).toBeInTheDocument();

    // Switch back to graph
    await user.click(screen.getByTitle('Graph View'));
    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });

  // 8. Table shows correct columns
  it('should show correct table columns', async () => {
    const user = userEvent.setup();
    render(<AllowlistPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Communication Rules' }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Table View'));

    expect(screen.getByText('Source Agent')).toBeInTheDocument();
    expect(screen.getByText('Target Agent')).toBeInTheDocument();
    expect(screen.getByText('Direction')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  // 9. Delete buttons exist in table rows
  it('should render delete buttons in table rows', async () => {
    const user = userEvent.setup();
    render(<AllowlistPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Communication Rules' }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Table View'));

    const deleteButtons = screen.getAllByRole('button', {
      name: /delete rule/i,
    });
    expect(deleteButtons.length).toBe(2);
  });

  // 10. Graph view renders correct number of nodes
  it('should render correct number of nodes in graph', async () => {
    render(<AllowlistPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    const flowNodes = screen.getAllByTestId(/^flow-node-/);
    expect(flowNodes).toHaveLength(3);
  });

  // 11. Shows summary footer with agent/rule counts
  it('should show summary with agent and rule counts', async () => {
    render(<AllowlistPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/3 agents/)).toBeInTheDocument();
    });

    expect(screen.getByText(/2 rules/)).toBeInTheDocument();
  });
});
