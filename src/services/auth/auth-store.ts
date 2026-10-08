import type { Session } from '../../types/domain';
import type { AuthService, LoginRequest } from './contracts';

export type AuthState =
  | { status: 'loading'; session: null }
  | {
      status: 'ready';
      session: Session | null;
      /** Set when a live session was ended by the server (MSG44). */
      ended?: 'expired';
    }
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
  /**
   * The sign-in form owns its pending state; the global state only changes
   * on success, so a refused attempt (MSG08…MSG11) leaves the guest as is.
   */
  login = async (request: LoginRequest) => {
    const revision = this.nextRevision();
    const session = await this.service.login(request);
    if (revision === this.revision) this.accept(session);
  };
  logout = async () => {
    this.nextRevision();
    // Clear local access immediately even if backend revocation fails.
    this.accept(null);
    await this.service.logout();
  };
  /** Called when the server reports the session has ended (401). */
  invalidate = () => {
    const hadSession = this.state.session !== null;
    this.nextRevision();
    if (hadSession)
      this.setState({ status: 'ready', session: null, ended: 'expired' });
    else this.accept(null);
  };
  /** The user has seen the session-expired notice. */
  acknowledgeEnded = () => {
    if (this.state.status === 'ready' && this.state.ended)
      this.setState({ status: 'ready', session: this.state.session });
  };
  cancelPending = () => {
    this.nextRevision();
  };
}
