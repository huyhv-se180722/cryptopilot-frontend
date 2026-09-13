import { afterEach, describe, expect, it, vi } from 'vitest';
import { RealtimeClient, type RealtimeProtocol } from './realtime-client';

class FakeSocket {
  readyState = 0;
  onopen: WebSocket['onopen'] = null;
  onclose: WebSocket['onclose'] = null;
  onerror: WebSocket['onerror'] = null;
  onmessage: WebSocket['onmessage'] = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
  });
  open() {
    this.readyState = 1;
    this.onopen?.call(this as unknown as WebSocket, new Event('open'));
  }
  drop() {
    this.readyState = 3;
    this.onclose?.call(
      this as unknown as WebSocket,
      new Event('close') as CloseEvent,
    );
  }
  error() {
    this.onerror?.call(this as unknown as WebSocket, new Event('error'));
  }
  message(data: unknown) {
    this.onmessage?.call(
      this as unknown as WebSocket,
      { data } as MessageEvent<unknown>,
    );
  }
}
// Protocol used ONLY in tests. It is not a proposed backend wire format.
const protocol: RealtimeProtocol<string> = {
  encodeSubscription: (topic, subscribe) => (subscribe ? '+' : '-') + topic,
  decode: (data) => {
    if (typeof data !== 'string') throw new Error('Invalid message');
    return { topic: 'spot:test', payload: data };
  },
};
function setup(maxRetries = 2) {
  const sockets: FakeSocket[] = [];
  const onError = vi.fn();
  const client = new RealtimeClient({
    url: 'wss://example.test',
    protocol,
    maxRetries,
    retryDelayMs: 100,
    onError,
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
  });
  return { client, sockets, onError };
}
afterEach(() => vi.useRealTimers());
describe('realtime lifecycle', () => {
  it('shares subscriptions and unsubscribes only when the last consumer leaves', () => {
    const { client, sockets } = setup();
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = client.subscribe('spot:test', first);
    const stopSecond = client.subscribe('spot:test', second);
    client.connect();
    client.connect();
    const socket = sockets[0]!;
    socket.open();
    expect(sockets).toHaveLength(1);
    expect(socket.send).toHaveBeenCalledExactlyOnceWith('+spot:test');
    socket.message('tick');
    expect(first).toHaveBeenCalledWith('tick');
    expect(second).toHaveBeenCalledWith('tick');
    stopFirst();
    expect(socket.send).toHaveBeenCalledTimes(1);
    stopSecond();
    stopSecond();
    expect(socket.send).toHaveBeenLastCalledWith('-spot:test');
    expect(socket.send).toHaveBeenCalledTimes(2);
    client.dispose();
  });
  it('reconnects and replays active subscriptions, then cleans up timers', async () => {
    vi.useFakeTimers();
    const { client, sockets } = setup();
    client.subscribe('spot:test', vi.fn());
    client.connect();
    sockets[0]!.open();
    sockets[0]!.drop();
    expect(client.getState()).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(100);
    sockets[1]!.open();
    expect(sockets[1]!.send).toHaveBeenCalledWith('+spot:test');
    sockets[1]!.drop();
    client.dispose();
    await vi.runAllTimersAsync();
    expect(sockets).toHaveLength(2);
    expect(client.getState()).toBe('closed');
    expect(sockets[1]!.onmessage).toBeNull();
  });
  it('stops after bounded retries and allows explicit reconnect', async () => {
    vi.useFakeTimers();
    const { client, sockets, onError } = setup(1);
    client.connect();
    sockets[0]!.drop();
    await vi.advanceTimersByTimeAsync(100);
    sockets[1]!.drop();
    expect(client.getState()).toBe('error');
    expect(onError).toHaveBeenCalledWith('Realtime reconnect limit reached.');
    client.reconnect();
    expect(sockets).toHaveLength(3);
    client.dispose();
  });
  it('contains malformed payloads and subscriber failures', () => {
    const { client, sockets, onError } = setup();
    const listener = vi.fn();
    client.subscribe('spot:test', () => {
      throw new Error('consumer error');
    });
    client.subscribe('spot:test', listener);
    client.connect();
    sockets[0]!.open();
    sockets[0]!.message({});
    expect(listener).not.toHaveBeenCalled();
    sockets[0]!.message('tick');
    expect(listener).toHaveBeenCalledWith('tick');
    expect(onError).toHaveBeenCalledTimes(2);
    client.dispose();
  });
  it('recovers from connection errors and subscription send errors', () => {
    vi.useFakeTimers();
    const { client, sockets } = setup();
    client.connect();
    sockets[0]!.error();
    expect(client.getState()).toBe('reconnecting');
    client.reconnect();
    sockets[1]!.open();
    sockets[1]!.send.mockImplementation(() => {
      throw new Error('closed');
    });
    client.subscribe('spot:test', vi.fn());
    expect(client.getState()).toBe('reconnecting');
    client.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not connect without configuration', () => {
    const socketFactory = vi.fn();
    const client = new RealtimeClient({ url: '', protocol, socketFactory });
    client.connect();
    expect(client.getState()).toBe('error');
    expect(socketFactory).not.toHaveBeenCalled();
  });
});
