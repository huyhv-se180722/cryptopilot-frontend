// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Outlet } from 'react-router-dom';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { VerifyEmailResult } from './components/VerifyEmailResult';
import { ResetPasswordForm } from './components/ResetPasswordForm';
import { GuestOnlyRoute } from '../../app/router/GuestOnlyRoute';
import { ServiceError } from '../../services/api/errors';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

function refusal(
  status: number,
  code: string,
  messageCode: string,
  fieldErrors = {},
) {
  return new ServiceError('refused', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs: [],
    fieldErrors,
  });
}

const guestRoutes = (element: React.ReactElement, path: string) => [
  {
    element: <GuestOnlyRoute />,
    children: [{ element: <Outlet />, children: [page(path, element)] }],
  },
  page('/dashboard', <h1>Dashboard home</h1>),
  page('/verify-email', <VerifyEmailResult />),
];

describe('SCR-04 sign in', () => {
  it('shows required-field messages before calling the server', async () => {
    const auth = fakeAuth({ login: vi.fn() });
    await renderRoutes(guestRoutes(<LoginForm />, '/login'), '/login', auth);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sign in' }),
    );
    expect(
      await screen.findByText('The email address field is required.'),
    ).toBeTruthy();
    expect(screen.getByText('The password field is required.')).toBeTruthy();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('reports wrong credentials without naming the field (MSG08)', async () => {
    const auth = fakeAuth({
      login: async () => {
        throw refusal(401, 'INVALID_CREDENTIALS', 'MSG08');
      },
    });
    await renderRoutes(guestRoutes(<LoginForm />, '/login'), '/login', auth);
    await userEvent.type(
      await screen.findByLabelText('Email address'),
      'a@b.test',
    );
    await userEvent.type(screen.getByLabelText('Password'), 'whatever');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText(
        'Incorrect email or password. Please check again.',
      ),
    ).toBeTruthy();
  });

  it('offers resend for an unverified account (MSG11)', async () => {
    const auth = fakeAuth({
      login: async () => {
        throw refusal(403, 'EMAIL_NOT_VERIFIED', 'MSG11');
      },
    });
    await renderRoutes(guestRoutes(<LoginForm />, '/login'), '/login', auth);
    await userEvent.type(
      await screen.findByLabelText('Email address'),
      'a@b.test',
    );
    await userEvent.type(screen.getByLabelText('Password'), 'whatever');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByRole('link', { name: 'Resend verification email' }),
    ).toBeTruthy();
  });

  it('sends the trader to the dashboard after signing in', async () => {
    const login = vi.fn(async () => testTrader);
    await renderRoutes(
      guestRoutes(<LoginForm />, '/login'),
      '/login',
      fakeAuth({ login }),
    );
    await userEvent.type(
      await screen.findByLabelText('Email address'),
      'trader@example.test',
    );
    await userEvent.type(screen.getByLabelText('Password'), 'Abcdef12');
    await userEvent.click(screen.getByLabelText('Remember me for 30 days'));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Dashboard home')).toBeTruthy();
    expect(login).toHaveBeenCalledWith({
      email: 'trader@example.test',
      password: 'Abcdef12',
      rememberMe: true,
    });
  });
});

describe('SCR-02 register', () => {
  async function fill(password = 'Abcdef12', confirm = password) {
    await userEvent.type(
      await screen.findByLabelText('Display name'),
      'New Trader',
    );
    await userEvent.type(
      screen.getByLabelText('Email address'),
      'new@example.test',
    );
    await userEvent.type(screen.getByLabelText('Password'), password);
    await userEvent.type(screen.getByLabelText('Confirm password'), confirm);
  }

  it('applies BR-02 and the disclaimer on the client', async () => {
    await renderRoutes(guestRoutes(<RegisterForm />, '/register'), '/register');
    await fill('weakpass');
    await userEvent.click(
      screen.getByRole('button', { name: 'Create free account' }),
    );
    expect(
      await screen.findByText(
        'Password must be 8-64 characters and include uppercase, lowercase letters and a digit.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('The confirmation field is required.'),
    ).toBeTruthy();
  });

  it('puts a taken email under the email field (MSG04)', async () => {
    const auth = fakeAuth({
      register: async () => {
        throw refusal(409, 'EMAIL_ALREADY_REGISTERED', 'MSG04', {
          email: 'MSG04',
        });
      },
    });
    await renderRoutes(
      guestRoutes(<RegisterForm />, '/register'),
      '/register',
      auth,
    );
    await fill();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(
      screen.getByRole('button', { name: 'Create free account' }),
    );
    expect(
      await screen.findByText('This email is already registered.'),
    ).toBeTruthy();
  });

  it('never signs in and asks to check the mailbox (MSG05)', async () => {
    const register = vi.fn(async () => ({ messageCode: 'MSG05' }));
    await renderRoutes(
      guestRoutes(<RegisterForm />, '/register'),
      '/register',
      fakeAuth({ register }),
    );
    await fill();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(
      screen.getByRole('button', { name: 'Create free account' }),
    );
    expect(
      await screen.findByText(
        'Account created. Please check new@example.test to verify your account.',
      ),
    ).toBeTruthy();
    expect(register).toHaveBeenCalledWith({
      displayName: 'New Trader',
      email: 'new@example.test',
      password: 'Abcdef12',
      confirmPassword: 'Abcdef12',
      acceptsDisclaimer: true,
    });
    expect(screen.queryByText('Dashboard home')).toBeNull();
  });
});

describe('SCR-03 email verification', () => {
  it('sends the single-use token once even under StrictMode', async () => {
    const verifyEmail = vi.fn(async () => ({ messageCode: 'MSG06' }));
    await renderRoutes(
      [page('/verify-email', <VerifyEmailResult />)],
      '/verify-email?token=abc',
      fakeAuth({ verifyEmail }),
    );
    expect(
      await screen.findByText(
        'Your email has been verified. You can now log in.',
      ),
    ).toBeTruthy();
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(verifyEmail).toHaveBeenCalledWith('abc');
  });

  it('offers resend for an invalid link (MSG07)', async () => {
    await renderRoutes(
      [page('/verify-email', <VerifyEmailResult />)],
      '/verify-email?token=old',
      fakeAuth({
        verifyEmail: async () => {
          throw refusal(400, 'TOKEN_INVALID_OR_EXPIRED', 'MSG07');
        },
      }),
    );
    expect(
      await screen.findByText('This link is invalid or has expired.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Resend verification email' }),
    ).toBeTruthy();
  });
});

describe('SCR-06 reset password', () => {
  it('treats a missing token as an invalid link', async () => {
    await renderRoutes(
      [page('/reset-password', <ResetPasswordForm />)],
      '/reset-password',
    );
    expect(
      await screen.findByText('This link is invalid or has expired.'),
    ).toBeTruthy();
  });

  it('sends the token with the new password and confirms MSG13', async () => {
    const resetPassword = vi.fn(async () => ({ messageCode: 'MSG13' }));
    await renderRoutes(
      [
        page('/reset-password', <ResetPasswordForm />),
        page('/login', <LoginForm />),
      ],
      '/reset-password?token=t1',
      fakeAuth({ resetPassword }),
    );
    await userEvent.type(
      await screen.findByLabelText('New password'),
      'Abcdef12',
    );
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Abcdef12');
    await userEvent.click(
      screen.getByRole('button', { name: 'Set new password' }),
    );
    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith({
        token: 't1',
        newPassword: 'Abcdef12',
        confirmPassword: 'Abcdef12',
      }),
    );
    // MSG13 is a toast that survives the redirect to SCR-04 (SRS 3.2.4).
    expect(
      await screen.findByText(
        'Your password has been changed. Please log in again.',
      ),
    ).toBeTruthy();
    expect(await screen.findByLabelText('Email address')).toBeTruthy();
  });

  it('shows an unexpected sign-in failure as an MSG43 toast', async () => {
    const login = vi.fn(async () => {
      throw new ServiceError('boom', 'HTTP_ERROR', 500, {
        status: 500,
        code: 'INTERNAL_ERROR',
        messageCode: 'MSG43',
        messageArgs: [],
        fieldErrors: {},
        traceId: 'trace-7',
      });
    });
    await renderRoutes(
      [page('/login', <LoginForm />)],
      '/login',
      fakeAuth({ login }),
    );
    await userEvent.type(
      await screen.findByLabelText('Email address'),
      'a@b.test',
    );
    await userEvent.type(screen.getByLabelText('Password'), 'Abcdef12');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const toast = await screen.findByRole('alert');
    expect(toast.textContent).toContain(
      'Something went wrong. Please try again. (Ref: trace-7)',
    );
    expect(toast.closest('ol')).not.toBeNull();
  });
});

describe('guest-only screens', () => {
  it('send a signed-in trader home', async () => {
    await renderRoutes(
      guestRoutes(<LoginForm />, '/login'),
      '/login',
      fakeAuth({ restoreSession: async () => testTrader }),
    );
    expect(await screen.findByText('Dashboard home')).toBeTruthy();
  });
});
