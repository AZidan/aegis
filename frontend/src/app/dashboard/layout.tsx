'use client';

import React from 'react';
import { TenantSidebar } from '@/components/dashboard/tenant-sidebar';
import {
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_COLLAPSED,
  STORAGE_KEYS,
} from '@/lib/constants';

/**
 * Tenant Dashboard Layout
 * Renders the sidebar and offsets the main content area.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = React.useState(SIDEBAR_WIDTH_EXPANDED);

  // Sync sidebar collapsed state (reads localStorage, polls for changes)
  React.useEffect(() => {
    const sync = () => {
      try {
        const collapsed =
          localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
        setSidebarWidth(
          collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED
        );
      } catch {
        // Silently fail
      }
    };

    sync();
    const interval = setInterval(sync, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50">
      <TenantSidebar />
      <main
        className="transition-all duration-200 ease-in-out"
        style={{ paddingLeft: sidebarWidth }}
      >
        {children}
      </main>
    </div>
  );
}
