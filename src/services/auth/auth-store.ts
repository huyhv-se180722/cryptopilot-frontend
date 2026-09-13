import type { Session } from '../../types/domain';
import type { AuthService, LoginRequest, RegisterRequest } from './contracts';

export type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'ready'; session: Session | null }
  | { status: 'error'; session: null; message: string };

export class AuthStore {
  private state: AuthState = { status: 'loading', session: null };
  private listeners = new Set<() => void>();
  private revision = 0;
  private restoration: AbortController | undefined;
  constructor(private readonly service: AuthService) {}
  getSnapshot = (): AuthState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private setState(state: AuthState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  private nextRevision() {
    this.restoration?.abort();
    this.restoration = undefined;
    return ++this.revision;
  }
  private accept(session: Session | null) {
    if (session && session.user.status !== 'active') {
      this.setState({
        status: 'error',
        session: null,
        message: 'This account cannot access protected areas.',
      });
    } else this.setState({ status: 'ready', session });
  }
  restore = async () => {
    const revision = this.nextRevision();
    const controller = new AbortController();
    this.restoration = controller;
    this.setState({ status: 'loading', session: null });
    try {
      const session = await this.service.restoreSession(controller.signal);
      if (revision === this.revision) this.accept(session);
    } catch {
      if (revision === this.revision)
        this.setState({
          status: 'error',
          session: null,
          message:
            'Session restoration is unavailable. Authentication integration may be pending.',
        });
    }
  };
  login = async (request: LoginRequest) => {
    const revision = this.nextRevision();
    this.setState({ status: 'loading', session: null });
    try {
      const session = await this.service.login(request);
      if (revision === this.revision) this.accept(session);
    } catch (error) {
      if (revision === this.revision)
        this.setState({
          status: 'error',
          session: null,
          message: 'Sign in could not be completed.',
        });
      throw error;
    }
  };
  register = (request: RegisterRequest) => this.service.register(request);
  logout = async () => {
    const revision = this.nextRevision();
    // Clear local access immediately even if backend revocation fails.
    this.accept(null);
    try {
      await this.service.logout();
    } catch (error) {
      if (revision === this.revision)
        this.setState({
          status: 'error',
          session: null,
          message:
            'Local session cleared; server logout could not be confirmed.',
        });
      throw error;
    }
  };
  invalidate = () => {
    this.nextRevision();
    this.accept(null);
  };
  cancelPending = () => {
    this.nextRevision();
  };
}
