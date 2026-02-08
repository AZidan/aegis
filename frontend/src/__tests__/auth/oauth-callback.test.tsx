import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReplace = jest.fn();
const mockRouter = {
  push: jest.fn(),
  replace: mockReplace,
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

let searchParamsMap = new Map<string, string>();

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => ({
    get: (key: string) => searchParamsMap.get(key) ?? null,
  }),
}));

const mockLogin = jest.fn();
jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: (selector: (s: { login: typeof mockLogin }) => unknown) =>
    selector({ login: mockLogin }),
}));

const mockLoginOAuth = jest.fn();
jest.mock('@/lib/api/auth', () => ({
  loginOAuth: (...args: unknown[]) => mockLoginOAuth(...args),
}));

jest.mock('@/lib/constants', () => ({
  OAUTH_REDIRECT_URI: 'http://localhost:3001/auth/callback',
  ROUTES: { LOGIN: '/login', DASHBOARD: '/dashboard' },
}));

// We test the default export which wraps content in Suspense
import OAuthCallbackPage from '@/app/auth/callback/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setSearchParams(params: Record<string, string>) {
  searchParamsMap = new Map(Object.entries(params));
}

const fakeUser = {
  id: 'u1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'tenant_admin' as const,
  tenantId: 't1',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OAuthCallbackPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchParamsMap = new Map();
    sessionStorage.clear();
  });

  it('renders loading spinner while exchanging code', () => {
    setSearchParams({ code: 'abc123' });
    sessionStorage.setItem('oauth_provider', 'google');
    mockLoginOAuth.mockReturnValue(new Promise(() => {})); // never resolves

    render(<OAuthCallbackPage />);

    expect(screen.getByText('Completing sign in...')).toBeInTheDocument();
  });

  it('calls loginOAuth with correct params and redirects on success', async () => {
    setSearchParams({ code: 'abc123' });
    sessionStorage.setItem('oauth_provider', 'github');
    mockLoginOAuth.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 3600,
      user: fakeUser,
    });

    render(<OAuthCallbackPage />);

    await waitFor(() => {
      expect(mockLoginOAuth).toHaveBeenCalledWith({
        provider: 'github',
        code: 'abc123',
        redirectUri: 'http://localhost:3001/auth/callback',
      });
    });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1', email: 'test@example.com', role: 'tenant_admin' }),
        'at',
        'rt',
      );
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error when no code param is present', () => {
    setSearchParams({});

    render(<OAuthCallbackPage />);

    expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
    expect(screen.getByText('No authorization code received from provider.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Login' })).toHaveAttribute('href', '/login');
  });

  it('shows error when provider is missing from sessionStorage', () => {
    setSearchParams({ code: 'abc123' });
    // No sessionStorage.setItem

    render(<OAuthCallbackPage />);

    expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
    expect(
      screen.getByText('Unable to determine OAuth provider. Please try again.')
    ).toBeInTheDocument();
  });

  it('shows error on API failure', async () => {
    setSearchParams({ code: 'bad-code' });
    sessionStorage.setItem('oauth_provider', 'google');
    mockLoginOAuth.mockRejectedValue({
      response: { data: { message: 'Invalid authorization code' } },
    });

    render(<OAuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      expect(screen.getByText('Invalid authorization code')).toBeInTheDocument();
    });
  });
});
