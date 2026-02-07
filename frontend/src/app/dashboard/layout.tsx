import React from 'react';

/**
 * Tenant Dashboard Layout
 * Will include sidebar navigation, header, etc.
 * To be implemented in Sprint 7
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Tenant Sidebar will go here */}
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
