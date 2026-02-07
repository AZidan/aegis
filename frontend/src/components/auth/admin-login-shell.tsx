'use client';

import { useState, useEffect } from 'react';
import { LoginForm } from './login-form';

/**
 * Admin Login Shell - full-page dark background with decorative elements
 * Matches admin-login.html design screen exactly
 */
export function AdminLoginShell() {
  const [sessionSeconds, setSessionSeconds] = useState(15 * 60);

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(sessionSeconds / 60);
  const secs = sessionSeconds % 60;
  const timerText =
    sessionSeconds > 0
      ? `Session expires in ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : 'Session expired';

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-4 py-8 admin-grid-bg overflow-hidden"
      style={{ backgroundColor: '#1e1b4b' }}
    >
      {/* Decorative geometric shapes */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Large circle top-left */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full border border-primary-400/[0.08] float-slow" />
        {/* Square top-right */}
        <div className="absolute top-16 right-20 w-20 h-20 rounded-xl bg-primary-400/[0.05] float-medium" />
        {/* Ring mid-left */}
        <div className="absolute top-1/3 -left-10 w-44 h-44 rounded-full border-2 border-primary-300/[0.06] float-fast" />
        {/* Large circle bottom-right */}
        <div className="absolute -bottom-28 -right-28 w-96 h-96 rounded-full bg-primary-400/[0.04] float-slow" />
        {/* Diamond center-right */}
        <div className="absolute top-1/2 right-32 w-14 h-14 bg-violet-400/[0.06] rotate-45 rounded-md float-medium" />
        {/* Small square bottom-left */}
        <div className="absolute bottom-40 left-20 w-16 h-16 rounded-lg border border-primary-300/[0.07] float-fast" />
        {/* Dot cluster top-center */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary-400/[0.12] pulse-glow" />
        <div
          className="absolute top-28 left-1/2 translate-x-6 w-2 h-2 rounded-full bg-violet-400/[0.10] pulse-glow"
          style={{ animationDelay: '0.5s' }}
        />
        <div
          className="absolute top-20 left-1/2 -translate-x-10 w-2.5 h-2.5 rounded-full bg-primary-300/[0.08] pulse-glow"
          style={{ animationDelay: '1s' }}
        />
        {/* Hexagonal shape bottom-center */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-24 h-24 rounded-2xl bg-primary-400/[0.03] rotate-12 float-medium" />
      </div>

      {/* Session timeout indicator */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-900/60 border border-primary-700/40 backdrop-blur-sm">
          <svg
            className="w-3.5 h-3.5 text-primary-300/70"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span
            className={`text-xs font-medium tracking-wide ${
              sessionSeconds > 0 ? 'text-primary-300/70' : 'text-red-400'
            }`}
          >
            {timerText}
          </span>
        </div>
      </div>

      {/* Shield logo */}
      <div className="relative z-10 flex flex-col items-center mb-8 card-enter">
        <div className="shield-pulse mb-4">
          <svg
            className="w-16 h-16"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M32 4L8 16v16c0 14.4 10.24 27.84 24 32 13.76-4.16 24-17.6 24-32V16L32 4z"
              fill="url(#shieldGrad)"
              stroke="url(#shieldStroke)"
              strokeWidth="1.5"
            />
            <circle cx="32" cy="28" r="5" fill="#c7d2fe" opacity="0.9" />
            <rect x="30" y="32" width="4" height="8" rx="2" fill="#c7d2fe" opacity="0.9" />
            <path
              d="M26 28l4 4 8-8"
              stroke="#1e1b4b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.6"
            />
            <defs>
              <linearGradient
                id="shieldGrad"
                x1="8"
                y1="4"
                x2="56"
                y2="52"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#6366f1" />
                <stop offset="0.5" stopColor="#4f46e5" />
                <stop offset="1" stopColor="#4338ca" />
              </linearGradient>
              <linearGradient
                id="shieldStroke"
                x1="8"
                y1="4"
                x2="56"
                y2="52"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#818cf8" />
                <stop offset="1" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Aegis Platform</h1>
        <p className="text-primary-300/60 text-xs font-medium tracking-widest uppercase mt-1">
          Admin Console
        </p>
      </div>

      {/* Login card */}
      <div
        className="relative z-10 w-full max-w-md card-enter"
        style={{ animationDelay: '0.1s', opacity: 0 }}
      >
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
          <div className="p-8 sm:p-10">
            <LoginForm variant="admin" />
          </div>
        </div>
      </div>

      {/* Security notice footer */}
      <div
        className="relative z-10 mt-8 text-center card-enter"
        style={{ animationDelay: '0.2s', opacity: 0 }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <svg
            className="w-3.5 h-3.5 text-red-400/60"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-red-300/50 font-medium tracking-wide">
            This system is monitored. Unauthorized access is prohibited.
          </p>
        </div>
        <p className="text-[11px] text-primary-400/30 mt-1">
          Aegis Platform v2.1.0 &middot; Secured by TLS 1.3
        </p>
      </div>
    </div>
  );
}
