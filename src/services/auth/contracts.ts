import type { Session } from '../../types/domain';

export interface LoginRequest {
  email: string;
  password: string;
}
export interface RegisterRequest extends LoginRequest {
  fullName: string;
}
/** Registration may require verification; do not assume automatic login. */
export type RegisterResult =
  { status: 'verification-required' } | { status: 'registered' };
export interface AuthService {
  restoreSession(signal?: AbortSignal): Promise<Session | null>;
  login(request: LoginRequest): Promise<Session>;
  register(request: RegisterRequest): Promise<RegisterResult>;
  logout(): Promise<void>;
}
