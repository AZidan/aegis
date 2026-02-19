'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  PackageCheck,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  FileText,
} from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import {
  ROUTES,
  STORAGE_KEYS,
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_COLLAPSED,
} from '@/lib/constants';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Navigation configuration
// ---------------------------------------------------------------------------

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      {
        label: 'Dashboard',
        href: ROUTES.ADMIN_HOME,
        icon: LayoutDashboard,
      },
      {
        label: 'Tenants',
        href: ROUTES.ADMIN_TENANTS,
        icon: Building2,
      },
{
        label: 'Security',
        href: ROUTES.ADMIN_SECURITY,
        icon: Shield,
      },
      {
        label: 'Audit Logs',
        href: ROUTES.ADMIN_AUDIT,
        icon: FileText,
      },
    ],
  },
  {
    title: 'MARKETPLACE',
    items: [
      {
        label: 'Skill Review',
        href: ROUTES.ADMIN_SKILLS_REVIEW,
        icon: PackageCheck,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sidebar nav item (expanded)
// ---------------------------------------------------------------------------

function SidebarNavItem({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-primary-50 text-primary-700 font-medium'
          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sidebar nav item (collapsed - with tooltip)
// ---------------------------------------------------------------------------

function SidebarNavItemCollapsed({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  const Icon = item.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          className={cn(
            'flex items-center justify-center rounded-lg p-2 transition-colors',
            isActive
              ? 'bg-primary-50 text-primary-700'
              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
          )}
        >
          <Icon className="h-5 w-5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// AdminSidebar component
// ---------------------------------------------------------------------------

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // Persist collapsed state in localStorage
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(next));
      } catch {
        // Silently fail if localStorage is unavailable
      }
      return next;
    });
  }, []);

  const handleSignOut = React.useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch {
      // Silently fail
    }
    router.push(ROUTES.ADMIN_LOGIN);
  }, [router]);

  /**
   * Check if a nav item is active. Exact match for the admin home route,
   * prefix match for all other routes so child pages stay highlighted.
   */
  const isActive = React.useCallback(
    (href: string) => {
      if (href === ROUTES.ADMIN_HOME) {
        return pathname === href;
      }
      return pathname === href || pathname.startsWith(href + '/');
    },
    [pathname]
  );

  const sidebarWidth = collapsed
    ? SIDEBAR_WIDTH_COLLAPSED
    : SIDEBAR_WIDTH_EXPANDED;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-neutral-200 bg-white transition-all duration-200 ease-in-out',
          'hidden lg:flex'
        )}
        style={{ width: sidebarWidth }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Logo section                                                      */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex h-16 items-center gap-3 border-b border-neutral-200 px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500 text-white">
            <Shield className="h-5 w-5" />
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold text-neutral-900 whitespace-nowrap">
              Aegis Admin
            </span>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Navigation sections                                               */}
        {/* ---------------------------------------------------------------- */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-6">
              {/* Section label */}
              {!collapsed && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  {section.title}
                </h3>
              )}

              {/* Nav items */}
              <div className="space-y-1">
                {section.items.map((item) =>
                  collapsed ? (
                    <SidebarNavItemCollapsed
                      key={item.href}
                      item={item}
                      isActive={isActive(item.href)}
                    />
                  ) : (
                    <SidebarNavItem
                      key={item.href}
                      item={item}
                      isActive={isActive(item.href)}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </nav>

        {/* ---------------------------------------------------------------- */}
        {/* Collapse toggle                                                   */}
        {/* ---------------------------------------------------------------- */}
        <div className="px-3 py-2">
          <button
            onClick={toggleCollapsed}
            className="flex w-full items-center justify-center rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Footer: User dropdown                                             */}
        {/* ---------------------------------------------------------------- */}
        <div className="border-t border-neutral-200 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-neutral-100',
                  collapsed && 'justify-center'
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src="" alt="Admin user" />
                  <AvatarFallback className="bg-primary-100 text-primary-700 text-xs">
                    PA
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      Platform Admin
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      admin@aegis.io
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={collapsed ? 'right' : 'top'}
              align="start"
              className="w-56"
            >
              <DropdownMenuItem asChild>
                <Link
                  href="/admin/settings"
                  className="flex cursor-pointer items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
}
