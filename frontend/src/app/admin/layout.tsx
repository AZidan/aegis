'use client';

import * as React from 'react';

import { AdminSidebar } from '@/components/admin/admin-sidebar';
import {
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_COLLAPSED,
  STORAGE_KEYS,
} from '@/lib/constants';

/**
 * Platform Admin Layout
 * Contains the sidebar navigation and main content area.
 * Sidebar is hidden on mobile (< lg breakpoint).
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read sidebar collapsed state to match the sidebar component's state
  const [collapsed, setCollapsed] = React.useState(false);

  // Sync with localStorage on mount and when storage changes
  React.useEffect(() => {
    const readState = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
        setCollapsed(stored === 'true');
      } catch {
        // Silently fail
      }
    };

    readState();

    // Listen for storage changes (from the sidebar toggle or other tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.SIDEBAR_COLLAPSED) {
        setCollapsed(e.newValue === 'true');
      }
    };

    // Also listen for same-tab changes via a custom interval
    // since StorageEvent only fires across tabs
    const interval = setInterval(readState, 200);

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const sidebarWidth = collapsed
    ? SIDEBAR_WIDTH_COLLAPSED
    : SIDEBAR_WIDTH_EXPANDED;

  return (
    <div className="min-h-screen bg-neutral-50">
      <AdminSidebar />
      <main
        className="min-h-screen transition-all duration-200 ease-in-out lg:p-0"
        style={{ marginLeft: 0 }}
      >
        {/* On lg+ screens, offset main content by sidebar width */}
        <div
          className="hidden lg:block"
          style={{ marginLeft: sidebarWidth }}
        >
          <div className="p-6">{children}</div>
        </div>
        {/* On smaller screens, full width (sidebar is hidden) */}
        <div className="block lg:hidden">
          <div className="p-4">{children}</div>
        </div>
      </main>
    </div>
  );
}
