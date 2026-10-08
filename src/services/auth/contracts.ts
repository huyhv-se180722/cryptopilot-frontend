import type { Session } from '../../types/domain';

/** Field names follow the backend auth contract (SRS 3.2, UC-01…05). */
export interface LoginRequest {
  email: string;
  password: string;
  /** 30-day instead of 7-day session (SRS 3.2.3). */
  rememberMe: boolean;
}
export interface RegisterRequest {
  email: string;
  displayName: string;
  password: string;
  confirmPassword: string;
  /** Confirmation that CryptoPilot gives no investment advice. */
  acceptsDisclaimer: boolean;
}
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}
/** Write operations that only return the SRS message to show. */
export interface MessageResult {
  messageCode: string;
}

/**
 * Registration never signs the user in: the account stays unverified until
 * the emailed link is opened (SRS 3.2.1–3.2.2).
 */
export interface AuthService {
  restoreSession(signal?: AbortSignal): Promise<Session | null>;
  login(request: LoginRequest): Promise<Session>;
  register(request: RegisterRequest): Promise<MessageResult>;
  verifyEmail(token: string, signal?: AbortSignal): Promise<MessageResult>;
  resendVerification(email: string): Promise<MessageResult>;
  forgotPassword(email: string): Promise<MessageResult>;
  resetPassword(request: ResetPasswordRequest): Promise<MessageResult>;
  logout(): Promise<void>;
}
