'use client';

import { LoginForm } from './login-form';

/**
 * Tenant Login Shell - split layout matching login.html design screen
 * Left panel: gradient with brand content (hidden on mobile)
 * Right panel: white background with login form
 */
export function TenantLoginShell() {
  return (
    <div className="flex min-h-screen bg-white">
      {/* ================================================================ */}
      {/* LEFT PANEL - Brand / Gradient                                    */}
      {/* Hidden on mobile (< lg), 50% width on desktop                   */}
      {/* ================================================================ */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center px-12"
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 50%, #7c3aed 100%)',
        }}
      >
        {/* Decorative geometric shapes */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full border border-white/10 tenant-float-slow" />
          <div className="absolute top-20 right-12 w-24 h-24 rounded-2xl bg-white/5 tenant-float-medium" />
          <div className="absolute top-1/3 -left-8 w-40 h-40 rounded-full border-2 border-white/[0.07] tenant-float-fast" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-white/[0.04] tenant-float-slow" />
          <div className="absolute top-1/2 right-24 w-16 h-16 bg-white/[0.06] rotate-45 rounded-md tenant-float-medium" />
          <div className="absolute bottom-32 left-16 w-20 h-20 rounded-xl border border-white/[0.08] tenant-float-fast" />
          <div className="absolute top-16 left-1/3 w-3 h-3 rounded-full bg-white/10 tenant-float-medium" />
          <div className="absolute top-24 left-[38%] w-2 h-2 rounded-full bg-white/[0.15] tenant-float-fast" />
          {/* Gradient overlay at bottom for depth */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/10 to-transparent" />
        </div>

        {/* Centered brand content */}
        <div className="relative z-10 text-center max-w-md">
          {/* Shield logo */}
          <div className="mx-auto mb-8 w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg shadow-black/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-10 h-10 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" strokeWidth="2" />
            </svg>
          </div>

          {/* Brand name */}
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">
            Aegis Platform
          </h1>

          {/* Tagline */}
          <p className="text-lg text-white/70 mb-12 leading-relaxed">
            Deploy AI Agent Teams with
            <br />
            Enterprise Security
          </p>

          {/* Feature bullets */}
          <div className="space-y-4 text-left inline-block">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                <svg
                  className="w-3.5 h-3.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-white/80 text-sm font-medium">
                Container-level tenant isolation
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                <svg
                  className="w-3.5 h-3.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-white/80 text-sm font-medium">Verified skill marketplace</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                <svg
                  className="w-3.5 h-3.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-white/80 text-sm font-medium">Full audit trails</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* RIGHT PANEL - Login Form                                         */}
      {/* Full width on mobile, 50% on desktop                            */}
      {/* ================================================================ */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 sm:px-12 py-12 bg-white relative">
        {/* Mobile-only brand header (visible < lg) */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" strokeWidth="2.5" />
            </svg>
          </div>
          <span className="text-xl font-bold text-neutral-900">Aegis Platform</span>
        </div>

        {/* Login card content */}
        <div className="w-full max-w-md">
          <LoginForm variant="tenant" />
        </div>

        {/* Footer */}
        <p className="absolute bottom-6 text-xs text-neutral-400">
          &copy; {new Date().getFullYear()} Aegis Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
}
