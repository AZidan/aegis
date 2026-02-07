import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '@/components/auth/register-form';

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
  usePathname: () => '/register',
  useSearchParams: () => new URLSearchParams(),
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

const mockRegisterApi = jest.fn();
jest.mock('@/lib/api/auth', () => ({
  register: (...args: unknown[]) => mockRegisterApi(...args),
}));

const mockStoreLogin = jest.fn();
jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: () => ({
    login: mockStoreLogin,
    user: null,
    isAuthenticated: false,
  }),
}));

jest.mock('@/components/auth/oauth-buttons', () => ({
  OAuthButtons: ({ mode, disabled }: { mode: string; disabled: boolean }) => (
    <div data-testid="oauth-buttons" data-mode={mode} data-disabled={disabled}>
      OAuth Buttons
    </div>
  ),
}));

jest.mock('@/components/auth/password-input', () => ({
  PasswordInput: React.forwardRef(function MockPasswordInput(
    props: {
      id: string;
      label: string;
      error?: string;
      [key: string]: unknown;
    },
    ref: React.ForwardedRef<HTMLInputElement>,
  ) {
    const { id, label, error, ...rest } = props;
    return (
      <div>
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          ref={ref}
          type="password"
          aria-invalid={error ? 'true' : 'false'}
          {...rest}
        />
        {error && <p role="alert">{error}</p>}
      </div>
    );
  }),
}));

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('RegisterForm', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Rendering
  // =========================================================================
  describe('Rendering', () => {
    it('should render full name input', () => {
      render(<RegisterForm />);
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    it('should render email input', () => {
      render(<RegisterForm />);
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    it('should render password input', () => {
      render(<RegisterForm />);
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    });

    it('should render confirm password input', () => {
      render(<RegisterForm />);
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('should render terms of service checkbox', () => {
      render(<RegisterForm />);
      expect(
        screen.getByRole('checkbox'),
      ).toBeInTheDocument();
    });

    it('should render create account button', () => {
      render(<RegisterForm />);
      expect(
        screen.getByRole('button', { name: /create account/i }),
      ).toBeInTheDocument();
    });

    it('should render sign in link', () => {
      render(<RegisterForm />);
      expect(
        screen.getByRole('link', { name: /sign in/i }),
      ).toBeInTheDocument();
    });

    it('should render OAuth buttons in register mode', () => {
      render(<RegisterForm />);
      expect(screen.getByTestId('oauth-buttons')).toHaveAttribute(
        'data-mode',
        'register',
      );
    });

    it('should render terms of service and privacy policy links', () => {
      render(<RegisterForm />);
      expect(
        screen.getByRole('link', { name: /terms of service/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /privacy policy/i }),
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Validation
  // =========================================================================
  describe('Validation', () => {
    it('should show name validation error on empty submit', async () => {
      render(<RegisterForm />);

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
      });
    });

    it('should show error for name shorter than 2 characters', async () => {
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), 'A');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/name must be at least 2 characters/i),
        ).toBeInTheDocument();
      });
    });

    it('should show error for invalid email format', async () => {
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(
        screen.getByLabelText(/email address/i),
        'not-an-email',
      );
      await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!@');
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'ValidPass123!@',
      );
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      });
    });

    it('should show error for password without uppercase letter', async () => {
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(
        screen.getByLabelText(/email address/i),
        'john@example.com',
      );
      await user.type(screen.getByLabelText(/^password$/i), 'lowercase123!@');
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'lowercase123!@',
      );
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/must contain at least one uppercase letter/i),
        ).toBeInTheDocument();
      });
    });

    it('should show error for password without special character', async () => {
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(
        screen.getByLabelText(/email address/i),
        'john@example.com',
      );
      await user.type(screen.getByLabelText(/^password$/i), 'NoSpecial123AB');
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'NoSpecial123AB',
      );
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/must contain at least one special character/i),
        ).toBeInTheDocument();
      });
    });

    it('should show error when passwords do not match', async () => {
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(
        screen.getByLabelText(/email address/i),
        'john@example.com',
      );
      await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!@');
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'DifferentPass123!@',
      );

      // Need to also check the terms checkbox
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/passwords do not match/i),
        ).toBeInTheDocument();
      });
    });

    it('should show error when terms not accepted', async () => {
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(
        screen.getByLabelText(/email address/i),
        'john@example.com',
      );
      await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!@');
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'ValidPass123!@',
      );
      // Do NOT click terms checkbox
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/must accept the terms/i),
        ).toBeInTheDocument();
      });
    });

    it('should not call register API when validation fails', async () => {
      render(<RegisterForm />);

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockRegisterApi).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // Successful Registration
  // =========================================================================
  describe('Successful Registration', () => {
    const validRegistration = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'ValidPass123!@',
    };

    const mockSuccessResponse = {
      user: {
        id: 'new-user-uuid',
        email: validRegistration.email,
        name: validRegistration.name,
        role: 'tenant_admin' as const,
        tenantId: 'tenant-uuid',
        createdAt: '2026-02-06T10:00:00.000Z',
      },
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    };

    it('should call register API with name, email, and password', async () => {
      mockRegisterApi.mockResolvedValue(mockSuccessResponse);
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), validRegistration.name);
      await user.type(
        screen.getByLabelText(/email address/i),
        validRegistration.email,
      );
      await user.type(
        screen.getByLabelText(/^password$/i),
        validRegistration.password,
      );
      await user.type(
        screen.getByLabelText(/confirm password/i),
        validRegistration.password,
      );
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockRegisterApi).toHaveBeenCalledWith({
          name: validRegistration.name,
          email: validRegistration.email,
          password: validRegistration.password,
        });
      });
    });

    it('should update auth store on successful registration', async () => {
      mockRegisterApi.mockResolvedValue(mockSuccessResponse);
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), validRegistration.name);
      await user.type(
        screen.getByLabelText(/email address/i),
        validRegistration.email,
      );
      await user.type(
        screen.getByLabelText(/^password$/i),
        validRegistration.password,
      );
      await user.type(
        screen.getByLabelText(/confirm password/i),
        validRegistration.password,
      );
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockStoreLogin).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'new-user-uuid',
            email: validRegistration.email,
            name: validRegistration.name,
          }),
          'new-access-token',
          'new-refresh-token',
        );
      });
    });

    it('should redirect to dashboard after successful registration', async () => {
      mockRegisterApi.mockResolvedValue(mockSuccessResponse);
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), validRegistration.name);
      await user.type(
        screen.getByLabelText(/email address/i),
        validRegistration.email,
      );
      await user.type(
        screen.getByLabelText(/^password$/i),
        validRegistration.password,
      );
      await user.type(
        screen.getByLabelText(/confirm password/i),
        validRegistration.password,
      );
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  // =========================================================================
  // Loading State
  // =========================================================================
  describe('Loading State', () => {
    it('should show loading indicator during submission', async () => {
      let resolveRegister: (value: unknown) => void;
      const registerPromise = new Promise((resolve) => {
        resolveRegister = resolve;
      });
      mockRegisterApi.mockReturnValue(registerPromise);

      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(
        screen.getByLabelText(/email address/i),
        'john@example.com',
      );
      await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!@');
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'ValidPass123!@',
      );
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/creating account/i)).toBeInTheDocument();
      });

      await act(async () => {
        resolveRegister!({
          user: {
            id: '1',
            email: 'john@example.com',
            name: 'John Doe',
            role: 'tenant_admin',
            createdAt: '2026-01-01',
          },
          accessToken: 'token',
          refreshToken: 'refresh',
        });
      });
    });

    it('should disable submit button during submission', async () => {
      let resolveRegister: (value: unknown) => void;
      const registerPromise = new Promise((resolve) => {
        resolveRegister = resolve;
      });
      mockRegisterApi.mockReturnValue(registerPromise);

      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(
        screen.getByLabelText(/email address/i),
        'john@example.com',
      );
      await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!@');
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'ValidPass123!@',
      );
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
      });

      await act(async () => {
        resolveRegister!({
          user: {
            id: '1',
            email: 'john@example.com',
            name: 'John Doe',
            role: 'tenant_admin',
            createdAt: '2026-01-01',
          },
          accessToken: 'token',
          refreshToken: 'refresh',
        });
      });
    });
  });

  // =========================================================================
  // Error Handling
  // =========================================================================
  describe('Error Handling', () => {
    it('should display conflict error for existing email (409)', async () => {
      mockRegisterApi.mockRejectedValue({
        response: { status: 409 },
      });
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(
        screen.getByLabelText(/email address/i),
        'existing@example.com',
      );
      await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!@');
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'ValidPass123!@',
      );
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/account with this email already exists/i),
        ).toBeInTheDocument();
      });
    });

    it('should display custom error message from API', async () => {
      mockRegisterApi.mockRejectedValue({
        response: {
          status: 500,
          data: {
            error: { message: 'Registration is currently disabled' },
          },
        },
      });
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(
        screen.getByLabelText(/email address/i),
        'john@example.com',
      );
      await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!@');
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'ValidPass123!@',
      );
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(
          screen.getByText('Registration is currently disabled'),
        ).toBeInTheDocument();
      });
    });

    it('should display generic error for unknown errors', async () => {
      mockRegisterApi.mockRejectedValue(new Error('Network error'));
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(
        screen.getByLabelText(/email address/i),
        'john@example.com',
      );
      await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!@');
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'ValidPass123!@',
      );
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/unexpected error occurred/i),
        ).toBeInTheDocument();
      });
    });

    it('should display server error in an alert role element', async () => {
      mockRegisterApi.mockRejectedValue({
        response: { status: 409 },
      });
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(
        screen.getByLabelText(/email address/i),
        'existing@example.com',
      );
      await user.type(screen.getByLabelText(/^password$/i), 'ValidPass123!@');
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'ValidPass123!@',
      );
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Password Strength Indicator
  // =========================================================================
  describe('Password Strength', () => {
    it('should show password requirements checklist when password is entered', async () => {
      render(<RegisterForm />);

      await user.type(screen.getByLabelText(/^password$/i), 'a');

      await waitFor(() => {
        expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/one uppercase letter/i)).toBeInTheDocument();
        expect(screen.getByText(/one lowercase letter/i)).toBeInTheDocument();
        expect(screen.getByText(/one number/i)).toBeInTheDocument();
        expect(screen.getByText(/one special character/i)).toBeInTheDocument();
      });
    });

    it('should not show requirements checklist when password is empty', () => {
      render(<RegisterForm />);

      expect(screen.queryByText(/at least 8 characters/i)).not.toBeInTheDocument();
    });
  });
});
