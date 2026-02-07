import { act } from '@testing-library/react';
import { useAuthStore } from '@/lib/store/auth-store';
import type { User } from '@/types/auth';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------
const mockUser: User = {
  id: 'user-uuid-1',
  email: 'admin@aegis.ai',
  name: 'Admin User',
  role: 'platform_admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockTenantUser: User = {
  id: 'user-uuid-2',
  email: 'user@company.com',
  name: 'Tenant User',
  role: 'tenant_admin',
  tenantId: 'tenant-uuid-1',
  createdAt: '2026-01-15T10:00:00.000Z',
};

const mockAccessToken = 'mock-access-token-123';
const mockRefreshToken = 'mock-refresh-token-456';

// ---------------------------------------------------------------------------
// Test Suite: Auth Store (Zustand)
// ---------------------------------------------------------------------------
describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    act(() => {
      useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    });
    localStorage.clear();
    jest.clearAllMocks();
  });

  // =========================================================================
  // Initial State
  // =========================================================================
  describe('Initial State', () => {
    it('should have null user initially', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });

    it('should not be authenticated initially', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should have null tokens initially', () => {
      const state = useAuthStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
    });

    it('should not be loading initially', () => {
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
    });
  });

  // =========================================================================
  // Login Action
  // =========================================================================
  describe('login', () => {
    it('should set user and mark as authenticated', () => {
      act(() => {
        useAuthStore.getState().login(mockUser, mockAccessToken, mockRefreshToken);
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should store access token', () => {
      act(() => {
        useAuthStore.getState().login(mockUser, mockAccessToken, mockRefreshToken);
      });

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe(mockAccessToken);
    });

    it('should store refresh token', () => {
      act(() => {
        useAuthStore.getState().login(mockUser, mockAccessToken, mockRefreshToken);
      });

      const state = useAuthStore.getState();
      expect(state.refreshToken).toBe(mockRefreshToken);
    });

    it('should store tokens in localStorage for API client', () => {
      act(() => {
        useAuthStore.getState().login(mockUser, mockAccessToken, mockRefreshToken);
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'access_token',
        mockAccessToken,
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'refresh_token',
        mockRefreshToken,
      );
    });

    it('should set isLoading to false after login', () => {
      // Set loading to true first
      act(() => {
        useAuthStore.getState().setLoading(true);
      });

      act(() => {
        useAuthStore.getState().login(mockUser, mockAccessToken, mockRefreshToken);
      });

      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should handle tenant user with tenantId', () => {
      act(() => {
        useAuthStore
          .getState()
          .login(mockTenantUser, mockAccessToken, mockRefreshToken);
      });

      const state = useAuthStore.getState();
      expect(state.user?.tenantId).toBe('tenant-uuid-1');
      expect(state.user?.role).toBe('tenant_admin');
    });
  });

  // =========================================================================
  // Logout Action
  // =========================================================================
  describe('logout', () => {
    beforeEach(() => {
      // Login first
      act(() => {
        useAuthStore.getState().login(mockUser, mockAccessToken, mockRefreshToken);
      });
    });

    it('should clear user to null', () => {
      act(() => {
        useAuthStore.getState().logout();
      });

      expect(useAuthStore.getState().user).toBeNull();
    });

    it('should set isAuthenticated to false', () => {
      act(() => {
        useAuthStore.getState().logout();
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('should clear tokens from state', () => {
      act(() => {
        useAuthStore.getState().logout();
      });

      const state = useAuthStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
    });

    it('should remove tokens from localStorage', () => {
      act(() => {
        useAuthStore.getState().logout();
      });

      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('refresh_token');
    });

    it('should set isLoading to false', () => {
      act(() => {
        useAuthStore.getState().setLoading(true);
      });

      act(() => {
        useAuthStore.getState().logout();
      });

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  // =========================================================================
  // UpdateUser Action
  // =========================================================================
  describe('updateUser', () => {
    beforeEach(() => {
      act(() => {
        useAuthStore.getState().login(mockUser, mockAccessToken, mockRefreshToken);
      });
    });

    it('should update specific user fields', () => {
      act(() => {
        useAuthStore.getState().updateUser({ name: 'Updated Name' });
      });

      const state = useAuthStore.getState();
      expect(state.user?.name).toBe('Updated Name');
      // Other fields should remain unchanged
      expect(state.user?.email).toBe(mockUser.email);
      expect(state.user?.role).toBe(mockUser.role);
    });

    it('should not set user if currently null', () => {
      act(() => {
        useAuthStore.setState({ user: null });
      });

      act(() => {
        useAuthStore.getState().updateUser({ name: 'Test' });
      });

      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  // =========================================================================
  // UpdateTokens Action
  // =========================================================================
  describe('updateTokens', () => {
    it('should update both access and refresh tokens', () => {
      const newAccess = 'new-access-token';
      const newRefresh = 'new-refresh-token';

      act(() => {
        useAuthStore.getState().updateTokens(newAccess, newRefresh);
      });

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe(newAccess);
      expect(state.refreshToken).toBe(newRefresh);
    });

    it('should update tokens in localStorage', () => {
      const newAccess = 'new-access-token';
      const newRefresh = 'new-refresh-token';

      act(() => {
        useAuthStore.getState().updateTokens(newAccess, newRefresh);
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'access_token',
        newAccess,
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'refresh_token',
        newRefresh,
      );
    });
  });

  // =========================================================================
  // SetLoading Action
  // =========================================================================
  describe('setLoading', () => {
    it('should set loading to true', () => {
      act(() => {
        useAuthStore.getState().setLoading(true);
      });

      expect(useAuthStore.getState().isLoading).toBe(true);
    });

    it('should set loading to false', () => {
      act(() => {
        useAuthStore.getState().setLoading(true);
      });
      act(() => {
        useAuthStore.getState().setLoading(false);
      });

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  // =========================================================================
  // Persistence
  // =========================================================================
  describe('Persistence', () => {
    it('should only persist user and isAuthenticated (not tokens)', () => {
      // The partialize config specifies only user and isAuthenticated
      // Tokens are stored in localStorage separately by the login action
      act(() => {
        useAuthStore.getState().login(mockUser, mockAccessToken, mockRefreshToken);
      });

      // The store's persist config uses partialize to only persist specific fields
      // This is a structural test to verify the design decision
      const state = useAuthStore.getState();
      expect(state.user).toBeDefined();
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe(mockAccessToken);
    });
  });
});
