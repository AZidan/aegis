import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TenantSidebar } from '@/components/dashboard/tenant-sidebar';
import { ROUTES, STORAGE_KEYS } from '@/lib/constants';

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

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  LayoutDashboard: ({ className }: { className?: string }) => (
    <svg data-testid="icon-dashboard" className={className} />
  ),
  Bot: ({ className }: { className?: string }) => (
    <svg data-testid="icon-bot" className={className} />
  ),
  Puzzle: ({ className }: { className?: string }) => (
    <svg data-testid="icon-puzzle" className={className} />
  ),
  Users: ({ className }: { className?: string }) => (
    <svg data-testid="icon-users" className={className} />
  ),
  FileText: ({ className }: { className?: string }) => (
    <svg data-testid="icon-filetext" className={className} />
  ),
  Settings: ({ className }: { className?: string }) => (
    <svg data-testid="icon-settings" className={className} />
  ),
  ChevronLeft: ({ className }: { className?: string }) => (
    <svg data-testid="icon-chevron-left" className={className} />
  ),
  ChevronRight: ({ className }: { className?: string }) => (
    <svg data-testid="icon-chevron-right" className={className} />
  ),
  LogOut: ({ className }: { className?: string }) => (
    <svg data-testid="icon-logout" className={className} />
  ),
  Network: ({ className }: { className?: string }) => (
    <svg data-testid="icon-network" className={className} />
  ),
  Layers: ({ className }: { className?: string }) => (
    <svg data-testid="icon-layers" className={className} />
  ),
}));

// Mock Radix UI components used by the sidebar
jest.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="avatar" className={className}>{children}</div>
  ),
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="avatar-fallback" className={className}>{children}</span>
  ),
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    asChild?: boolean;
    className?: string;
  }) => (
    <div data-testid="dropdown-item" onClick={onClick} className={className}>
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
  DropdownMenuTrigger: ({
    children,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div data-testid="dropdown-trigger">{children}</div>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({
    children,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div>{children}</div>,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TenantSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Navigation Items
  // -----------------------------------------------------------------------

  describe('Navigation Items', () => {
    it('should render all workspace nav items', () => {
      render(<TenantSidebar />);
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Agents')).toBeInTheDocument();
      expect(screen.getByText('Skill Marketplace')).toBeInTheDocument();
    });

    it('should render all management nav items', () => {
      render(<TenantSidebar />);
      expect(screen.getByText('Team Members')).toBeInTheDocument();
      expect(screen.getByText('Audit Log')).toBeInTheDocument();
      // "Settings" appears twice: nav item + dropdown menu item
      const settingsElements = screen.getAllByText('Settings');
      expect(settingsElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should render section titles', () => {
      render(<TenantSidebar />);
      expect(screen.getByText('WORKSPACE')).toBeInTheDocument();
      expect(screen.getByText('MANAGEMENT')).toBeInTheDocument();
    });

    it('should render the Dashboard link with correct href', () => {
      render(<TenantSidebar />);
      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveAttribute('href', ROUTES.DASHBOARD);
    });

    it('should render the Agents link with correct href', () => {
      render(<TenantSidebar />);
      const agentsLink = screen.getByText('Agents').closest('a');
      expect(agentsLink).toHaveAttribute('href', ROUTES.AGENTS);
    });
  });

  // -----------------------------------------------------------------------
  // Active State
  // -----------------------------------------------------------------------

  describe('Active State', () => {
    it('should apply active styles to Dashboard when pathname is /dashboard', () => {
      render(<TenantSidebar />);
      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink?.className).toContain('bg-primary-50');
      expect(dashboardLink?.className).toContain('text-primary-600');
    });
  });

  // -----------------------------------------------------------------------
  // Logo / Branding
  // -----------------------------------------------------------------------

  describe('Branding', () => {
    it('should render the company name "Acme Corp"', () => {
      render(<TenantSidebar />);
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('should render the user name "Jane Doe"', () => {
      render(<TenantSidebar />);
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('should render the user role "Tenant Admin"', () => {
      render(<TenantSidebar />);
      expect(screen.getByText('Tenant Admin')).toBeInTheDocument();
    });

    it('should render avatar fallback initials "JD"', () => {
      render(<TenantSidebar />);
      expect(screen.getByText('JD')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Collapse Toggle
  // -----------------------------------------------------------------------

  describe('Collapse Toggle', () => {
    it('should render collapse button with "Collapse sidebar" label', () => {
      render(<TenantSidebar />);
      const button = screen.getByLabelText('Collapse sidebar');
      expect(button).toBeInTheDocument();
    });

    it('should show "Collapse" text when expanded', () => {
      render(<TenantSidebar />);
      expect(screen.getByText('Collapse')).toBeInTheDocument();
    });

    it('should toggle to "Expand sidebar" after clicking collapse', async () => {
      const user = userEvent.setup();
      render(<TenantSidebar />);

      const collapseButton = screen.getByLabelText('Collapse sidebar');
      await user.click(collapseButton);

      expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();
    });

    it('should persist collapsed state in localStorage', async () => {
      const user = userEvent.setup();
      render(<TenantSidebar />);

      const collapseButton = screen.getByLabelText('Collapse sidebar');
      await user.click(collapseButton);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.SIDEBAR_COLLAPSED,
        'true'
      );
    });
  });

  // -----------------------------------------------------------------------
  // Sign Out
  // -----------------------------------------------------------------------

  describe('Sign Out', () => {
    it('should render Sign Out menu item', () => {
      render(<TenantSidebar />);
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });
  });
});
