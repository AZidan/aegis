import React from 'react';

/**
 * Platform Admin Layout
 * Will include sidebar navigation, header, etc.
 * To be implemented in Sprint 7
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Admin Sidebar will go here */}
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
