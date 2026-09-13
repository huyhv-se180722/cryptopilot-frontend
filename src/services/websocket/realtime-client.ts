export type ConnectionState =
  'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';
export interface RealtimeProtocol<T> {
  encodeSubscription(topic: string, subscribe: boolean): string;
  decode(data: unknown): { topic: string; payload: T } | null;
}
type Socket = Pick<
  WebSocket,
  | 'readyState'
  | 'send'
  | 'close'
  | 'onopen'
  | 'onclose'
  | 'onerror'
  | 'onmessage'
>;
export interface RealtimeOptions<T> {
  url: string;
  protocol: RealtimeProtocol<T>;
  socketFactory?: (url: string) => Socket;
  maxRetries?: number;
  retryDelayMs?: number;
  onError?: (message: string) => void;
}

/** Owned by an application service/provider, never instantiated in a page. */
export class RealtimeClient<T> {
  private socket: Socket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private retries = 0;
  private stopped = true;
  private state: ConnectionState = 'idle';
  private listeners = new Set<() => void>();
  private topics = new Map<string, Map<symbol, (payload: T) => void>>();

  constructor(private readonly options: RealtimeOptions<T>) {}
  getState = (): ConnectionState => this.state;
  onStateChange = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private setState(state: ConnectionState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  private report(message: string) {
    this.options.onError?.(message);
  }

  connect() {
    if (this.socket || this.retryTimer !== undefined) return;
    if (!this.options.url) {
      this.setState('error');
      this.report('WebSocket URL is not configured.');
      return;
    }
    this.stopped = false;
    this.setState(this.retries ? 'reconnecting' : 'connecting');
    let socket: Socket;
    try {
      socket =
        this.options.socketFactory?.(this.options.url) ??
        new WebSocket(this.options.url);
    } catch {
      this.report('Unable to create the WebSocket connection.');
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.retries = 0;
      this.setState('open');
      for (const topic of this.topics.keys()) {
        if (!this.sendSubscription(topic, true)) break;
      }
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      let message: { topic: string; payload: T } | null;
      try {
        message = this.options.protocol.decode(event.data);
      } catch {
        this.report('Invalid realtime message.');
        return;
      }
      if (!message) return;
      const callbacks = this.topics.get(message.topic);
      if (!callbacks) return;
      for (const listener of callbacks.values()) {
        try {
          listener(message.payload);
        } catch {
          this.report('A realtime subscriber failed.');
        }
      }
    };
    socket.onerror = () => {
      if (this.socket !== socket) return;
      this.report('WebSocket connection failed.');
      this.releaseSocket();
      this.scheduleReconnect();
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.releaseSocket();
      this.scheduleReconnect();
    };
  }

  private sendSubscription(topic: string, subscribe: boolean): boolean {
    if (this.socket?.readyState !== 1) return false;
    try {
      this.socket.send(
        this.options.protocol.encodeSubscription(topic, subscribe),
      );
      return true;
    } catch {
      this.report('Unable to send a realtime subscription.');
      this.releaseSocket();
      this.scheduleReconnect();
      return false;
    }
  }
  subscribe(topic: string, listener: (payload: T) => void): () => void {
    if (!topic.trim()) throw new Error('Realtime topic cannot be empty.');
    let subscribers = this.topics.get(topic);
    const first = !subscribers;
    if (!subscribers) {
      subscribers = new Map();
      this.topics.set(topic, subscribers);
    }
    const token = Symbol(topic);
    subscribers.set(token, listener);
    if (first) this.sendSubscription(topic, true);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      subscribers.delete(token);
      if (subscribers.size === 0 && this.topics.get(topic) === subscribers) {
        this.topics.delete(topic);
        this.sendSubscription(topic, false);
      }
    };
  }
  private scheduleReconnect() {
    if (this.stopped || this.retryTimer !== undefined) return;
    if (this.retries >= (this.options.maxRetries ?? 6)) {
      this.setState('error');
      this.report('Realtime reconnect limit reached.');
      return;
    }
    const delay = Math.min(
      (this.options.retryDelayMs ?? 1_000) * 2 ** this.retries,
      30_000,
    );
    this.retries += 1;
    this.setState('reconnecting');
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.connect();
    }, delay);
  }
  private releaseSocket() {
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      try {
        socket.close();
      } catch {
        this.report('WebSocket cleanup failed.');
      }
    }
  }
  disconnect() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.retries = 0;
    this.releaseSocket();
    this.setState('closed');
  }
  reconnect() {
    this.disconnect();
    this.connect();
  }
  dispose() {
    this.disconnect();
    this.topics.clear();
    this.listeners.clear();
  }
}
