import type { AuthService } from './contracts';
import { integrationPending } from '../api/errors';

/** A missing auth adapter is an integration error, never a fabricated login. */
export const unconfiguredAuth: AuthService = {
  restoreSession: async () => integrationPending(),
  login: async () => integrationPending(),
  register: async () => integrationPending(),
  verifyEmail: async () => integrationPending(),
  resendVerification: async () => integrationPending(),
  forgotPassword: async () => integrationPending(),
  resetPassword: async () => integrationPending(),
  changePassword: async () => integrationPending(),
  logout: async () => integrationPending(),
};
